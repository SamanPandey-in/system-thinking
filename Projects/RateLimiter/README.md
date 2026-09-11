# /rate-limit

Six rate limiting algorithms, each keyed on Redis so state is shared correctly across multiple API server instances (not per-process memory). All are configured to the same effective limit of
**10 requests / 60 seconds per IP** via `config.js`.

| File | Algorithm |
|---|---|
| `tokenBucket.js` | Token Bucket |
| `leakyBucket.js` | Leaky Bucket |
| `fixedWindowCounter.js` | Fixed Window Counter (epoch-aligned) |
| `fixedWindowUserDefined.js` | Fixed Window Counter (window starts at each key's first request) |
| `slidingWindowLog.js` | Sliding Window Log |
| `slidingWindowCounter.js` | Sliding Window Counter (weighted two-window approximation) |

Every file exports the same shape:

```js
export function createXLimiter(options) { ... }  // factory, for custom limit/window/keyGenerator
export const rateLimiter = createXLimiter();      // ready-to-use instance with config.js defaults
export default rateLimiter;
```

## Switching algorithms

`index.js` imports exactly one of these files. To change the active
algorithm, change ONE import line:

```js
import { rateLimiter } from "./rate-limit/tokenBucket.js";
// import { rateLimiter } from "./rate-limit/leakyBucket.js";
// import { rateLimiter } from "./rate-limit/fixedWindowCounter.js";
// import { rateLimiter } from "./rate-limit/fixedWindowUserDefined.js";
// import { rateLimiter } from "./rate-limit/slidingWindowLog.js";
// import { rateLimiter } from "./rate-limit/slidingWindowCounter.js";

app.use(rateLimiter);
```

Nothing else in `index.js` needs to change. Every file returns an Express
middleware with the same `(req, res, next)` signature and the same response contract:

- Allowed: request proceeds, response carries `X-RateLimit-Limit` / `X-RateLimit-Remaining` (and `X-RateLimit-Reset` where the algorithm has a well-defined window boundary).
- Denied: `429` JSON body `{ "error": "Too Many Requests" }` + `Retry-After` header (seconds).

## Design decisions here:

- **Keyed by `req.ip`.** Swap `keyGenerator` in the options object to key by API key / user id etc. `req.ip` is only correct behind a reverse proxy if we configure `app.set("trust proxy", ...)`.
- **Applied globally, before the routes**, so it covers both `POST /api/v1/data` and `GET /:shortURL`. We can mount it independently for different APIs.
- **Fails open.** If Redis is unreachable, each middleware logs the error and calls `next()` rather than blocking all traffic. For the opposite (fail closed — block everything when Redis is down), we just need to change the `catch` block in each file to call `sendRateLimited(res, ...)` instead of  `next()`.
- **Atomicity.** Every algorithm's read-check-write sequence runs as a single Redis Lua script (`EVAL`) so concurrent requests from the same key can't race past the limit; without it, two simultaneous requests can both read "9 used, limit 10" and both get allowed.
