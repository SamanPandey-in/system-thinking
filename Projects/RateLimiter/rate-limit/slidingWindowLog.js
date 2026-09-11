// SLIDING WINDOW LOG
// INPUT:
//   - identity key (default: req.ip)
//   - limit     -> max requests allowed in any trailing windowMs interval
//   - windowMs  -> window length in ms
// STATE (per key, Redis SORTED SET "swl:{id}" -> member=request id, score=timestamp_ms):
//   - one entry per request timestamp inside the current trailing window
// OUTPUT:
//   - allow / deny for the current request
//   - X-RateLimit-Remaining = limit - count (after this request, if allowed)
//   - 429 + Retry-After (seconds until the oldest logged entry ages out) when denied
//
// PSEUDOCODE:
//   now = current_time_ms()
//   windowStart = now - windowMs
//   ZREMRANGEBYSCORE log[id], 0, windowStart      // drop entries older than the window
//   count = ZCARD log[id]
//   if count < limit:
//     ZADD log[id], now, uniqueRequestId
//     allow = true
//   else:
//     allow = false
//   return allow
//
// This is the exact, non-approximated sliding window: at any instant the
// count is precisely "requests in the last windowMs ms", so there's no
// boundary-burst weakness like fixed window has. Trade-off: memory grows
// with `limit` (one sorted-set entry per request), unlike the O(1)-per-key
// counters used by the fixed/sliding-window-counter algorithms.

import { randomUUID } from "crypto";
import redisClient from "../redis.js";
import { RATE_LIMIT_CONFIG, defaultKeyGenerator } from "./config.js";
import { sendRateLimited, setRateLimitHeaders, logRateLimiterError } from "./helpers.js";

const SLIDING_WINDOW_LOG_SCRIPT = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window_ms = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local member = ARGV[4]
local ttl = tonumber(ARGV[5])

local window_start = now - window_ms
redis.call("ZREMRANGEBYSCORE", key, 0, window_start)

local count = redis.call("ZCARD", key)
local allowed = 0
if count < limit then
  redis.call("ZADD", key, now, member)
  redis.call("EXPIRE", key, ttl)
  allowed = 1
  count = count + 1
end

local oldest = redis.call("ZRANGE", key, 0, 0, "WITHSCORES")
local oldest_score = 0
if oldest[2] then
  oldest_score = tonumber(oldest[2])
end

return { allowed, tostring(count), tostring(oldest_score) }
`;

export function createSlidingWindowLogLimiter(options = {}) {
  const {
    limit = RATE_LIMIT_CONFIG.limit,
    windowMs = RATE_LIMIT_CONFIG.windowMs,
    keyGenerator = defaultKeyGenerator,
    keyPrefix = RATE_LIMIT_CONFIG.keyPrefix,
  } = options;

  const ttlSec = Math.ceil(windowMs / 1000) + 5;

  return async function slidingWindowLogMiddleware(req, res, next) {
    const id = keyGenerator(req);
    const key = `${keyPrefix}:swl:${id}`;
    const now = Date.now();
    // unique per request so two requests in the same millisecond don't
    // collide as sorted-set members (ZADD would treat them as one entry)
    const member = `${now}-${randomUUID()}`;

    try {
      const result = await redisClient.eval(SLIDING_WINDOW_LOG_SCRIPT, {
        keys: [key],
        arguments: [String(limit), String(windowMs), String(now), member, String(ttlSec)],
      });

      const allowed = Number(result[0]);
      const count = Number(result[1]);
      const oldestScore = Number(result[2]);
      const retryAfterSec = oldestScore > 0 ? (oldestScore + windowMs - now) / 1000 : windowMs / 1000;

      setRateLimitHeaders(res, { limit, remaining: limit - count });

      if (allowed === 1) {
        return next();
      }

      return sendRateLimited(res, retryAfterSec);
    } catch (err) {
      logRateLimiterError("slidingWindowLog", err);
      return next();
    }
  };
}

export const ALGORITHM_NAME = "Sliding Window Log";

export const rateLimiter = createSlidingWindowLogLimiter();
export default rateLimiter;