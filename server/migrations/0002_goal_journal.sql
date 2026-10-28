CREATE TABLE goal_journal_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_id TEXT NOT NULL,
  date TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  mutation_id TEXT NOT NULL
);
CREATE INDEX goal_journal_timeline ON goal_journal_entries(user_id, goal_id, date DESC, created_at DESC, id DESC);

CREATE TABLE goal_journal_images (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_id TEXT NOT NULL REFERENCES goal_journal_entries(id) ON DELETE CASCADE,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  position INTEGER NOT NULL,
  data BLOB NOT NULL
);
CREATE INDEX goal_journal_entry_images ON goal_journal_images(entry_id, position);
CREATE INDEX goal_journal_user_images ON goal_journal_images(user_id);
