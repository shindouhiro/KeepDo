CREATE TABLE github_backup_connections (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  owner TEXT NOT NULL,
  repo TEXT NOT NULL,
  branch TEXT NOT NULL,
  token_encrypted TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
