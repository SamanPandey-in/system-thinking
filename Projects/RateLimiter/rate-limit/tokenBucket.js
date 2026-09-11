// TOKEN BUCKET
// INPUT:
//   - identity key (default: req.ip)
//   - capacity            -> max tokens the bucket can hold
//   - refillRatePerSec    -> tokens added back per second
// STATE (per key, stored as a Redis HASH "tb:{id}" -> { tokens, last_refill }):
//   - tokens: float, current tokens available
//   - last_refill: ms epoch timestamp of the last refill calculation
// OUTPUT:
//   - allow / deny for the current request
//   - X-RateLimit-Remaining = floor(tokens left after this request)
//   - 429 + Retry-After (seconds until >=1 token is available) when denied
//
// PSEUDOCODE:
//   now = current_time_ms()
//   (tokens, last_refill) = HGET bucket[id] or (capacity, now)
//   elapsed = (now - last_refill) / 1000
//   tokens = min(capacity, tokens + elapsed * refillRatePerSec)
//   if tokens >= 1:
//     tokens -= 1
//     allow = true
//   else:
//     allow = false
//   HSET bucket[id] = (tokens, now)
//   return allow
//
// Why Lua: "read tokens, compute refill, decide, write back" has to be one
// atomic step, or two concurrent requests can both read the same token
// count and both get allowed. EVAL runs the whole script atomically on
// the Redis server, so there's no read-modify-write race.

import redisClient from "../redis.js";
import { RATE_LIMIT_CONFIG, defaultKeyGenerator } from "./config.js";
import { sendRateLimited, setRateLimitHeaders, logRateLimiterError } from "./helpers.js";

const TOKEN_BUCKET_SCRIPT = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local ttl = tonumber(ARGV[4])

local data = redis.call("HMGET", key, "tokens", "last_refill")
local tokens = tonumber(data[1])
local last_refill = tonumber(data[2])

if tokens == nil then
  tokens = capacity
  last_refill = now
end

local elapsed_sec = (now - last_refill) / 1000
if elapsed_sec > 0 then
  tokens = math.min(capacity, tokens + elapsed_sec * refill_rate)
  last_refill = now
end

local allowed = 0
if tokens >= 1 then
  tokens = tokens - 1
  allowed = 1
end

redis.call("HMSET", key, "tokens", tostring(tokens), "last_refill", tostring(last_refill))
redis.call("EXPIRE", key, ttl)

return { allowed, tostring(tokens) }
`;

export function createTokenBucketLimiter(options = {}) {
  const {
    capacity = RATE_LIMIT_CONFIG.capacity,
    refillRatePerSec = RATE_LIMIT_CONFIG.refillRatePerSec,
    keyGenerator = defaultKeyGenerator,
    keyPrefix = RATE_LIMIT_CONFIG.keyPrefix,
  } = options;

  // enough time for a fully-drained bucket to refill, plus slack
  const ttlSec = Math.ceil(capacity / refillRatePerSec) + 10;

  return async function tokenBucketMiddleware(req, res, next) {
    const id = keyGenerator(req);
    const key = `${keyPrefix}:tb:${id}`;
    const now = Date.now();

    try {
      const result = await redisClient.eval(TOKEN_BUCKET_SCRIPT, {
        keys: [key],
        arguments: [String(capacity), String(refillRatePerSec), String(now), String(ttlSec)],
      });

      const allowed = Number(result[0]);
      const tokensLeft = Number(result[1]);

      setRateLimitHeaders(res, { limit: capacity, remaining: tokensLeft });

      if (allowed === 1) {
        return next();
      }

      const retryAfterSec = (1 - tokensLeft) / refillRatePerSec;
      return sendRateLimited(res, retryAfterSec);
    } catch (err) {
      logRateLimiterError("tokenBucket", err);
      return next();
    }
  };
}

export const ALGORITHM_NAME = "Token Bucket";

export const rateLimiter = createTokenBucketLimiter();
export default rateLimiter;