// LEAKY BUCKET
// INPUT:
//   - identity key (default: req.ip)
//   - capacity        -> max "volume" the bucket can hold before overflow
//   - leakRatePerSec  -> volume drained per second
// STATE (per key, Redis HASH "lb:{id}" -> { volume, last_leak }):
//   - volume: float, current queued volume
//   - last_leak: ms epoch timestamp of the last leak calculation
// OUTPUT:
//   - allow / deny for the current request
//   - X-RateLimit-Remaining = floor(capacity - volume) after this request
//   - 429 + Retry-After (seconds until 1 unit of space frees up) when denied
//
// PSEUDOCODE:
//   now = current_time_ms()
//   (volume, last_leak) = HGET bucket[id] or (0, now)
//   elapsed = (now - last_leak) / 1000
//   volume = max(0, volume - elapsed * leakRatePerSec)   // drain what leaked out
//   if volume + 1 <= capacity:
//     volume += 1
//     allow = true
//   else:
//     allow = false
//   HSET bucket[id] = (volume, now)
//   return allow
//
// Difference from token bucket: token bucket ADDS capacity over time and
// lets you burst up to full capacity instantly; leaky bucket enforces a
// strictly constant outflow rate... it smooths bursts rather than allowing
// them. Same atomicity requirement, same reason for using Lua.

import redisClient from "../redis.js";
import { RATE_LIMIT_CONFIG, defaultKeyGenerator } from "./config.js";
import { sendRateLimited, setRateLimitHeaders, logRateLimiterError } from "./helpers.js";

const LEAKY_BUCKET_SCRIPT = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local leak_rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local ttl = tonumber(ARGV[4])

local data = redis.call("HMGET", key, "volume", "last_leak")
local volume = tonumber(data[1])
local last_leak = tonumber(data[2])

if volume == nil then
  volume = 0
  last_leak = now
end

local elapsed_sec = (now - last_leak) / 1000
if elapsed_sec > 0 then
  volume = math.max(0, volume - elapsed_sec * leak_rate)
  last_leak = now
end

local allowed = 0
if volume + 1 <= capacity then
  volume = volume + 1
  allowed = 1
end

redis.call("HMSET", key, "volume", tostring(volume), "last_leak", tostring(last_leak))
redis.call("EXPIRE", key, ttl)

return { allowed, tostring(volume) }
`;

export function createLeakyBucketLimiter(options = {}) {
  const {
    capacity = RATE_LIMIT_CONFIG.capacity,
    leakRatePerSec = RATE_LIMIT_CONFIG.leakRatePerSec,
    keyGenerator = defaultKeyGenerator,
    keyPrefix = RATE_LIMIT_CONFIG.keyPrefix,
  } = options;

  const ttlSec = Math.ceil(capacity / leakRatePerSec) + 10;

  return async function leakyBucketMiddleware(req, res, next) {
    const id = keyGenerator(req);
    const key = `${keyPrefix}:lb:${id}`;
    const now = Date.now();

    try {
      const result = await redisClient.eval(LEAKY_BUCKET_SCRIPT, {
        keys: [key],
        arguments: [String(capacity), String(leakRatePerSec), String(now), String(ttlSec)],
      });

      const allowed = Number(result[0]);
      const volume = Number(result[1]);
      const remaining = capacity - volume;

      setRateLimitHeaders(res, { limit: capacity, remaining });

      if (allowed === 1) {
        return next();
      }

      const overflowBy = volume + 1 - capacity;
      const retryAfterSec = overflowBy / leakRatePerSec;
      return sendRateLimited(res, retryAfterSec);
    } catch (err) {
      logRateLimiterError("leakyBucket", err);
      return next();
    }
  };
}

export const ALGORITHM_NAME = "Leaky Bucket";

export const rateLimiter = createLeakyBucketLimiter();
export default rateLimiter;