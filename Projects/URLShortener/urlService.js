import { query } from "./pg.js";
import redisClient from "./redis.js";
import crypto from "crypto";

const CACHE_TTL_SECONDS = 86400; // 24hrs

// 1. fetch shortURL from longURL (Idempotency check)
export async function getShortURLByLong(longURL) {
  const cachedShort = await redisClient.get(`long:${longURL}`);
  if (cachedShort) return cachedShort;

  // fallback to Postgresql
  const result = await query("SELECT short_url FROM urls WHERE long_url = $1", [longURL]);
  const shortURL = result.rows[0]?.short_url || null;

  if (shortURL) {
    await redisClient.setEx(`long:${longURL}`, CACHE_TTL_SECONDS, shortURL);
  }
  return shortURL;
};


// 2. fetch longURL from shortURL (redirect lookup)
export async function getLongURLByShort(shortURL) {
  const cachedLong = await redisClient.get(`short:${shortURL}`);
  if (cachedLong) return cachedLong;

  const result = await query("SELECT long_url FROM urls WHERE short_url = $1", [shortURL]);
  const longURL = result.rows[0]?.long_url || null;

  if (longURL) {
    await redisClient.setEx(`short:${shortURL}`, CACHE_TTL_SECONDS, longURL);
  }
  return longURL;
}

// 3. save a new URL mapping
export async function saveURLMapping(longURL, shortURL) {
  await query("INSERT INTO urls (long_url, short_url) VALUES ($1, $2)", [longURL, shortURL]);
  await Promise.all([
    redisClient.setEx(`short:${shortURL}`, CACHE_TTL_SECONDS, longURL),
    redisClient.setEx(`long:${longURL}`, CACHE_TTL_SECONDS, shortURL),
  ]);
}

// 4. save click analytics data into the db
export async function recordClickInDb({ shortURL, longURL, req}) {
    const clickId = crypto.randomUUID();
    const timestamp = new Date();
    const ip = req.ip;
    const userAgent = req.get("user-agent") || null;
    const referer = req.get("referer") || null;

    await query(
        `INSERT INTO click_analytics (id, short_url, long_url, timestamp, ip, user_agent, referer) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [clickId, shortURL, longURL, timestamp, ip, userAgent, referer]
    );

    return { id: clickId, shortURL, longURL, timestamp, ip, userAgent, referer };
}
