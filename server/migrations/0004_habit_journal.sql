-- 旧记录默认属于目标；同一账号内相同 ID 的目标与习惯分别保存日记。
ALTER TABLE goal_journal_entries ADD COLUMN subject_type TEXT NOT NULL DEFAULT 'goal' CHECK (subject_type IN ('goal', 'habit'));
CREATE INDEX journal_subject_timeline ON goal_journal_entries(user_id, subject_type, goal_id, date DESC, created_at DESC, id DESC);
