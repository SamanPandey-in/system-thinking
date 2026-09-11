// shared helpers so every algo returns a consistent HTTP contract
// a 429 + Retry-After when blocked, X-RateLimit-* headers always

export function sendRateLimited(res, retryAfterSec) {
    res.set("Retry-After", String(Math.max(0, Math.ceil(retryAfterSec))));

    return res.status(429).json({ error: "Too Many Requests"});
}

export function setRateLimitHeaders(res, { limit, remaining, resetSec }) { 
    res.set("X-RateLimit-Limit", String(limit));
    res.set("X-RateLimit-Remaining", String(Math.max(0, remaining)));

    if (resetSec !== undefined) {
        res.set("X-RateLimit-Reset", String(Math.max(0, Math.ceil(resetSec))));
    }
}


// every algo fails OPEN on a redis server, so a redis outage degrades to a "no rate limit" mode
// instead of taking the whole service down, we just log the error and let the req through..
// to change to fail CLOSED, (block traffic on redis outage), change the catch block in each algo
// from `return next()` to `return sendRateLimited(...)`

export function logRateLimiterError(algoName, err) {
    console.error(`[[rate-limit]:${algoName}] Redis error, failing open:`, err);
}