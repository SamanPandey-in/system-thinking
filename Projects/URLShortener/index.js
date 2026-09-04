import express from "express";
import crypto from "crypto";
import { 
  getShortURLByLong, 
  getLongURLByShort, 
  saveURLMapping, 
  recordClickInDb 
} from "./urlService.js";

const app = express();
const PORT = 9000;

app.use(express.json());
app.use(express.static("public"));

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
