CREATE TABLE IF NOT EXISTS urls (
    id SERIAL PRIMARY KEY,
    long_url TEXT UNIQUE NOT NULL,
    short_url TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS click_analytics (
    id UUID PRIMARY KEY,
    short_url TEXT NOT NULL,
    long_url TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    ip TEXT,
    user_agent TEXT,
    referer TEXT
);
