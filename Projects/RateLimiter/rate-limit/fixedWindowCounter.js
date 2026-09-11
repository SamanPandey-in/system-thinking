// FIXED WINDOW COUNTER (window aligned to the Unix epoch)

// i/p:
// 1. identity key (default: ip address)
// 2. limit -> max allowed requests per window
// 3. windowMs -> window size in ms

// State: (per key+window, Redis STRING counter "fw:{id}:{windowId}"):
// windowId = floow(now / windowMs) -> same for every req in same global time slice
// e.g. every request in [00:00,00:01) shares
// windowId regardless of when each user made their first request.

// Output:
// 1. allow / deny for current request
// 2. X-RateLimit-Remaining = limit - count
// 3. 429 + Retry-After = seconds until next window (if denied)

// PSEUDOCODE:
//   windowId = floor(now / windowMs)
//   key = "fw:{id}:{windowId}"
//   count = INCR key
//   if count == 1: EXPIRE key, windowMs/1000   // first hit in this window starts the TTL
//   allow = count <= limit
//   return allow
//
// Known weakness (why sliding window variants exist): a burst at the very
// end of one window plus a burst at the very start of the next can total
// up to 2x `limit` requests in a short span, because the boundary is fixed
// to the clock, not to when traffic actually started.

import redisClient from "../redis.js";
import { RATE_LIMIT_CONFIG, defaultKeyGenerator } from "./config.js";
import {
  sendRateLimited,
  setRateLimitHeaders,
  logRateLimiterError,
} from "./helpers.js";

const FIXED_WINDOW_SCRIPT = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window_sec = tonumber(ARGV[2])

local count = redis.call("INCR", key)
if count == 1 then
    redis.call("EXPIRE", key, window_sec)
end

local ttl = redis.call("TTL", key)
local allowed = 0
if count <= limit then
    allowed = 1
end

return { allowed, tostring(count), tostring(ttl) }
`;

export function createFixedWindowCounterLimiter(options = {}) {
  const {
    limit = RATE_LIMIT_CONFIG.limit,
    windowMs = RATE_LIMIT_CONFIG.windowMs,
    keyGenerator = defaultKeyGenerator,
    keyPrefix = RATE_LIMIT_CONFIG.keyPrefix,
  } = options;

  const windowSec = Math.ceil(windowMs / 1000);

  return async function fixedWindowMiddleware(req, res, next) {
    const id = keyGenerator(req);
    const now = Date.now();
    const windowId = Math.floor(now / windowMs);
    const key = `${keyPrefix}:fw:${id}:${windowId}`;

    try {
      const result = await redisClient.eval(FIXED_WINDOW_SCRIPT, {
        keys: [key],
        arguments: [String(limit), String(windowSec)],
      });

      const allowed = Number(result[0]);
      const count = Number(result[1]);
      const ttl = Number(result[2]); // seconds left in this window

      setRateLimitHeaders(res, { limit, remaining: limit - count, resetSec: ttl });

      if (allowed === 1) {
        return next();
      }

      return sendRateLimited(res, ttl);
    } catch (err) {
      logRateLimiterError("fixedWindowCounter", err);
      return next();
    }
  };
}

export const ALGORITHM_NAME = "Fixed Window Counter";

export const rateLimiter = createFixedWindowCounterLimiter();
export default rateLimiter;