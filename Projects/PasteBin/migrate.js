import { query } from "./pg.js";

async function runMigrations() {
  console.log("Running migrations...");

  const createPastesTable = `
    CREATE TABLE IF NOT EXISTS pastes (
      id SERIAL PRIMARY KEY,
      short_url VARCHAR(16) UNIQUE NOT NULL,
      text_content TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createAnalyticsTable = `
    CREATE TABLE IF NOT EXISTS click_analytics (
      id SERIAL PRIMARY KEY,
      short_url VARCHAR(16) NOT NULL,
      user_agent TEXT,
      ip_address VARCHAR(45),
      accessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    await query(createPastesTable);
    await query(createAnalyticsTable);
    console.log("Migrations completed successfully.");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

runMigrations();
