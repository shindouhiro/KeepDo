-- 分享保存独立快照；删除原记录不会扩大或改变已分享的内容。
CREATE TABLE journal_shares (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  snapshot TEXT NOT NULL,
  created_at TEXT NOT NULL,
  image_bytes INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX journal_shares_owner ON journal_shares(user_id, created_at DESC);

CREATE TABLE journal_share_images (
  share_token TEXT NOT NULL REFERENCES journal_shares(token) ON DELETE CASCADE,
  id TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  data BLOB NOT NULL,
  PRIMARY KEY (share_token, id)
);
