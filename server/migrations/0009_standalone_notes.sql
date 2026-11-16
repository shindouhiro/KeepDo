-- 扩展记录类型。父子表先完整复制，再删除旧子表，避免外键级联删除历史图片。
CREATE TABLE goal_journal_entries_next (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_id TEXT NOT NULL,
  date TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  mutation_id TEXT NOT NULL,
  write_token TEXT NOT NULL DEFAULT '',
  subject_type TEXT NOT NULL DEFAULT 'goal' CHECK (subject_type IN ('goal', 'habit', 'note')),
  CHECK (subject_type <> 'note' OR goal_id = 'standalone')
);

INSERT INTO goal_journal_entries_next
  (id, user_id, goal_id, date, content, created_at, updated_at, version, mutation_id, write_token, subject_type)
SELECT id, user_id, goal_id, date, content, created_at, updated_at, version, mutation_id, write_token, subject_type
FROM goal_journal_entries;

CREATE TABLE goal_journal_images_next (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_id TEXT NOT NULL REFERENCES goal_journal_entries_next(id) ON DELETE CASCADE,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  position INTEGER NOT NULL,
  data BLOB NOT NULL
);

INSERT INTO goal_journal_images_next (id, user_id, entry_id, mime_type, byte_size, position, data)
SELECT id, user_id, entry_id, mime_type, byte_size, position, data FROM goal_journal_images;

DROP TABLE goal_journal_images;
DROP TABLE goal_journal_entries;
ALTER TABLE goal_journal_entries_next RENAME TO goal_journal_entries;
ALTER TABLE goal_journal_images_next RENAME TO goal_journal_images;

CREATE INDEX goal_journal_timeline ON goal_journal_entries(user_id, goal_id, date DESC, created_at DESC, id DESC);
CREATE INDEX journal_subject_timeline ON goal_journal_entries(user_id, subject_type, goal_id, date DESC, created_at DESC, id DESC);
CREATE INDEX journal_account_timeline ON goal_journal_entries(user_id, date DESC, created_at DESC, id DESC);
CREATE INDEX goal_journal_entry_images ON goal_journal_images(entry_id, position);
CREATE INDEX goal_journal_user_images ON goal_journal_images(user_id);
