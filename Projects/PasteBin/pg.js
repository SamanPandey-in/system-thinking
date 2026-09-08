import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  user: 'postgres',
  password: 'postgres',
  database: 'pastebin',
  host: 'localhost',
  port: 5433,
});

export const query = (text, params) => pool.query(text, params);
