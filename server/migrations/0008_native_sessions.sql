CREATE TABLE native_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX native_sessions_user_id ON native_sessions(user_id);
CREATE INDEX native_sessions_expires_at ON native_sessions(expires_at);
