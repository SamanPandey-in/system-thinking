// Shared defaults so every algo is configured to use the SAME effective limit (10 reqs/60secs).
// Override per-call via the `options` argument of each createXLimiter() factory to test other values.

export const RATE_LIMIT_CONFIG = {
    keyPrefix: "rl", // redis key namespace, avoids collisions with url/click keys
    windowMs: 60_000, // 60 sec window (fixed / sliding window algos)
    limit: 10, // max reqs allowed per window
    capacity: 10, //bucket size for token / leaky buket algos
    refillRatePerSec: 10 / 60, // token bucket: tokens added per sec
    leakRatePerSec: 10 / 60, // leaky bucket: reqs drained per sec
}

// Idenifies the caller being rate limited.
// Defaults to IP for now, can be overwritten to req.headers["x-api-key"] or req.user.id for other use cases.

// NOTE: req.ip is only reliable behind a proxy if we set `app.set("trust proxy", true)` in index.js.

export function defaultKeyGenerator(req) {
    return req.ip;
}