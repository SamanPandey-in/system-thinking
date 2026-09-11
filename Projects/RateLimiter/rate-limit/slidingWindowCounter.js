// SLIDING WINDOW COUNTER (weighted average of two fixed windows, the
// standard approximation used in production, e.g. this is the Cloudflare
// blog's documented algorithm;)
// INPUT:
//   - identity key (default: req.ip)
//   - limit     -> max requests allowed per window
//   - windowMs  -> window length in ms
// STATE (per key, two Redis STRING counters):
//   - "swc:{id}:{currentWindowId}"  -> count in the current fixed window
//   - "swc:{id}:{previousWindowId}" -> count in the immediately prior window
// OUTPUT:
//   - allow / deny for the current request
//   - X-RateLimit-Remaining = limit - estimatedCount (rounded down)
//   - 429 + Retry-After (seconds left in the current fixed window) when denied
//
// PSEUDOCODE:
//   currentWindowId  = floor(now / windowMs)
//   previousWindowId = currentWindowId - 1
//   currentCount  = GET counter[id, currentWindowId]  or 0
//   previousCount = GET counter[id, previousWindowId] or 0
//   elapsedInCurrent = now mod windowMs
//   weight = (windowMs - elapsedInCurrent) / windowMs   // how much of the previous window "overlaps" the trailing windowMs
//   estimatedCount = previousCount * weight + currentCount
//   if estimatedCount < limit:
//     currentCount = INCR counter[id, currentWindowId]
//     allow = true
//   else:
//     allow = false
//   return allow
//
// This approximates the sliding window log's precision at O(1) storage per
// key (two counters instead of one entry per request), assuming requests
// are ~evenly distributed within the previous window. It can under- or
// over-count slightly versus the true sliding window log when traffic is
// bursty within a single window rather than evenly spread.

import redisClient from "../redis.js";
import { RATE_LIMIT_CONFIG, defaultKeyGenerator } from "./config.js";
import { sendRateLimited, setRateLimitHeaders, logRateLimiterError } from "./helpers.js";

const SLIDING_WINDOW_COUNTER_SCRIPT = `
local current_key = KEYS[1]
local previous_key = KEYS[2]
local limit = tonumber(ARGV[1])
local window_ms = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local ttl = tonumber(ARGV[4])

local current_count = tonumber(redis.call("GET", current_key)) or 0
local previous_count = tonumber(redis.call("GET", previous_key)) or 0

local elapsed_in_current = now % window_ms
local weight = (window_ms - elapsed_in_current) / window_ms

local estimated = previous_count * weight + current_count

local allowed = 0
if estimated < limit then
  current_count = redis.call("INCR", current_key)
  redis.call("EXPIRE", current_key, ttl)
  allowed = 1
  estimated = estimated + 1
end

return { allowed, tostring(estimated) }
`;

export function createSlidingWindowCounterLimiter(options = {}) {
  const {
    limit = RATE_LIMIT_CONFIG.limit,
    windowMs = RATE_LIMIT_CONFIG.windowMs,
    keyGenerator = defaultKeyGenerator,
    keyPrefix = RATE_LIMIT_CONFIG.keyPrefix,
  } = options;

  // must outlive 2 windows so the "previous" counter is still readable
  const ttlSec = Math.ceil((windowMs * 2) / 1000);

  return async function slidingWindowCounterMiddleware(req, res, next) {
    const id = keyGenerator(req);
    const now = Date.now();
    const currentWindowId = Math.floor(now / windowMs);
    const previousWindowId = currentWindowId - 1;
    const currentKey = `${keyPrefix}:swc:${id}:${currentWindowId}`;
    const previousKey = `${keyPrefix}:swc:${id}:${previousWindowId}`;

    try {
      const result = await redisClient.eval(SLIDING_WINDOW_COUNTER_SCRIPT, {
        keys: [currentKey, previousKey],
        arguments: [String(limit), String(windowMs), String(now), String(ttlSec)],
      });

      const allowed = Number(result[0]);
      const estimated = Number(result[1]);
      const msLeftInWindow = (currentWindowId + 1) * windowMs - now;

      setRateLimitHeaders(res, {
        limit,
        remaining: limit - estimated,
        resetSec: msLeftInWindow / 1000,
      });

      if (allowed === 1) {
        return next();
      }

      return sendRateLimited(res, msLeftInWindow / 1000);
    } catch (err) {
      logRateLimiterError("slidingWindowCounter", err);
      return next();
    }
  };
}

export const ALGORITHM_NAME = "Sliding Window Counter";

export const rateLimiter = createSlidingWindowCounterLimiter();
export default rateLimiter;