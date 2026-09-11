import express from "express";
import crypto from "crypto";
import { 
  getShortURLByLong, 
  getLongURLByShort, 
  saveURLMapping, 
  recordClickInDb 
} from "./urlService.js";

import { rateLimiter, ALGORITHM_NAME } from "./rate-limit/tokenBucket.js";
// import { rateLimiter, ALGORITHM_NAME } from "./rate-limit/leakyBucket.js";
// import { rateLimiter, ALGORITHM_NAME } from "./rate-limit/fixedWindowCounter.js";
// import { rateLimiter, ALGORITHM_NAME } from "./rate-limit/fixedWindowUserDefined.js";
// import { rateLimiter, ALGORITHM_NAME } from "./rate-limit/slidingWindowLog.js";
// import { rateLimiter, ALGORITHM_NAME } from "./rate-limit/slidingWindowCounter.js";
import { RATE_LIMIT_CONFIG } from "./rate-limit/config.js";

const app = express();
const PORT = 9000;

app.use(express.json());
app.use(express.static("public"));

// Metadata only, deliberately mounted BEFORE the limiter so the demo page
// (public/rate-limit-demo.html) can always read which algorithm/limit is
// active without burning the caller's own quota just to check.
app.get("/api/v1/rate-limit-info", (req, res) => {
  res.json({
    algorithm: ALGORITHM_NAME,
    limit: RATE_LIMIT_CONFIG.limit,
    windowMs: RATE_LIMIT_CONFIG.windowMs,
  });
});

// we are applying rate limiter globall to all routes, if we want a specific route to be rate limited we can apply it to that route only.
// e.g. app.post("/api/v1/data", rateLimiter, async (req, res) => { ... });
app.use(rateLimiter);

function generateHash(longURL) {
  return crypto.createHash("sha256").update(longURL).digest("hex").slice(0, 8);
}

app.post("/api/v1/data", async (req, res) => {
  const { longURL } = req.body;

  if (!longURL) {
    return res.status(400).json({ error: "No URL given" });
  }

  try {
    new URL(longURL);
  } catch {
    return res.status(400).json({ error: "Invalid URL" });
  }

  try {
    // Idempotency check using PostgreSQL
    const existingShort = await getShortURLByLong(longURL);
    if (existingShort) {
      return res.json({
        shortURL: `http://localhost:${PORT}/${existingShort}`,
      });
    }

    // Generate short URL hash
    let shortURL = generateHash(longURL);

    // Collision handling verified against the database
    let isCollision = await getLongURLByShort(shortURL);
    while (isCollision && isCollision !== longURL) {
      shortURL = crypto.randomBytes(4).toString("hex");
      isCollision = await getLongURLByShort(shortURL);
    }

    // Persist data maps to Postgres
    await saveURLMapping(longURL, shortURL);

    return res.status(201).json({
      shortURL: `http://localhost:${PORT}/${shortURL}`,
    });
  } catch (err) {
    console.error("Error creating short URL:", err);
    return res.status(500).json({ error: "Internal Database Error" });
  }
});

app.get("/:shortURL", async (req, res) => {
  const { shortURL } = req.params;

  try {
    // Look up original URL from database
    const longURL = await getLongURLByShort(shortURL);

    if (!longURL) {
      return res.status(404).json({ error: "Short URL not found" });
    }

    // Asynchronously log analytics into database before redirecting
    await recordClickInDb({ shortURL, longURL, req });

    return res.redirect(302, longURL);
  } catch (err) {
    console.error("Error logging redirection:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
