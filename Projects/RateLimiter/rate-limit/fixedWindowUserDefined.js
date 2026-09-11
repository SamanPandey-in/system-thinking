// FIXED WINDOW, USER-DEFINED START
// (window is anchored to each key's OWN first request, not to the epoch)
// INPUT:
//   - identity key (default: req.ip)
//   - limit     -> max requests allowed per window
//   - windowMs  -> window length in ms
// STATE (per key, Redis HASH "fwu:{id}" -> { window_start, count }):
//   - window_start: ms epoch timestamp when THIS key's current window began
//   - count: requests seen since window_start
// OUTPUT:
//   - allow / deny for the current request
//   - X-RateLimit-Remaining = limit - count
//   - 429 + Retry-After (ms remaining until THIS key's window resets) when denied
//
// PSEUDOCODE:
//   (window_start, count) = HGET state[id]
//   if window_start is unset OR (now - window_start) >= windowMs:
//     window_start = now        // a brand new window starts exactly NOW for this key
//     count = 1
//     allow = true
//   else:
//     count += 1
//     allow = count <= limit
//   HSET state[id] = (window_start, count)
//   return allow
//
// Difference from the epoch-aligned version: every key gets its own clock
// instead of all sharing global buckets like [00:00,00:01), [00:01,00:02).
// A user who first hits the API at 00:00:37 resets at 00:01:37, not 00:01:00.
// This removes the "everyone's window flips at the same instant" behavior,
// at the cost of one extra field (window_start) to track per key.

import redisClient from "../redis.js";
import { RATE_LIMIT_CONFIG, defaultKeyGenerator } from "./config.js";
import { sendRateLimited, setRateLimitHeaders, logRateLimiterError } from "./helpers.js";

const FIXED_WINDOW_USER_DEFINED_SCRIPT = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window_ms = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local ttl = tonumber(ARGV[4])

local data = redis.call("HMGET", key, "window_start", "count")
local window_start = tonumber(data[1])
local count = tonumber(data[2])

if window_start == nil or (now - window_start) >= window_ms then
  window_start = now
  count = 1
  redis.call("HMSET", key, "window_start", tostring(window_start), "count", tostring(count))
  redis.call("EXPIRE", key, ttl)
  return { 1, tostring(count), tostring(window_start) }
end

count = redis.call("HINCRBY", key, "count", 1)
local allowed = 0
if count <= limit then
  allowed = 1
end

return { allowed, tostring(count), tostring(window_start) }
`;

export function createFixedWindowUserDefinedLimiter(options = {}) {
  const {
    limit = RATE_LIMIT_CONFIG.limit,
    windowMs = RATE_LIMIT_CONFIG.windowMs,
    keyGenerator = defaultKeyGenerator,
    keyPrefix = RATE_LIMIT_CONFIG.keyPrefix,
  } = options;

  const ttlSec = Math.ceil(windowMs / 1000) + 5;

  return async function fixedWindowUserDefinedMiddleware(req, res, next) {
    const id = keyGenerator(req);
    const key = `${keyPrefix}:fwu:${id}`;
    const now = Date.now();

    try {
      const result = await redisClient.eval(FIXED_WINDOW_USER_DEFINED_SCRIPT, {
        keys: [key],
        arguments: [String(limit), String(windowMs), String(now), String(ttlSec)],
      });

      const allowed = Number(result[0]);
      const count = Number(result[1]);
      const windowStart = Number(result[2]);
      const msLeftInWindow = windowStart + windowMs - now;

      setRateLimitHeaders(res, {
        limit,
        remaining: limit - count,
        resetSec: msLeftInWindow / 1000,
      });

      if (allowed === 1) {
        return next();
      }

      return sendRateLimited(res, msLeftInWindow / 1000);
    } catch (err) {
      logRateLimiterError("fixedWindowUserDefined", err);
      return next();
    }
  };
}

export const ALGORITHM_NAME = "Fixed Window (user-defined start)";

export const rateLimiter = createFixedWindowUserDefinedLimiter();
export default rateLimiter;