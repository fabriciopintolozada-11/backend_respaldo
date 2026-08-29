-- US-00 / BE-T00.1: users table for authentication, logical deletion and RBAC.
-- Tables follow the snake_case convention (BE-21). Idempotent for a clean
-- deployment or an existing database.
CREATE TABLE IF NOT EXISTS users (
    id            UUID        NOT NULL DEFAULT gen_random_uuid(),
    username      VARCHAR(80) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name     VARCHAR(150) NOT NULL,
    role          VARCHAR(30) NOT NULL,
    is_active     BOOLEAN     NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT users_pkey PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS users_username_key ON users (username);
CREATE INDEX IF NOT EXISTS users_username_idx ON users (username);
