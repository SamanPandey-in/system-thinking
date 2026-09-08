import { query } from "./pg.js";

// 1. Save original text content alongside its generated short URL identifier
export async function saveTextContentToDatabase(textContent, shortURL) {
  const text = `INSERT INTO pastes (short_url, text_content) VALUES ($1, $2)
    ON CONFLICT (short_url) DO UPDATE
    SET text_content = EXCLUDED.text_content
    RETURNING *;
  `;
  const values = [shortURL, textContent];

  const res = await query(text, values);
  return res.rows[0];
}

// 2. Retrieves the stored text content by its short URL identifier
export async function getTextContentByShort(shortURL) {
  const text = `SELECT text_content FROM pastes WHERE short_url = $1;`;
  const values = [shortURL];

  const res = await query(text, values);
  
  if (res.rows.length === 0) {
    return null;
  }

  return res.rows[0].text_content;
}

// 3. Asynchronously logs analytics/click details for a given short link access
export async function recordClickInDb({ shortURL, req }) {
  const userAgent = req.headers["user-agent"] || null;
  const ipAddress = req.headers["x-forwarded-for"] || req.socket.remoteAddress || null;

  const text = `INSERT INTO click_analytics (short_url, user_agent, ip_address) VALUES ($1, $2, $3);`;
  const values = [shortURL, userAgent, ipAddress];

  await query(text, values);
}
