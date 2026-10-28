CREATE INDEX journal_account_timeline ON goal_journal_entries(user_id, date DESC, created_at DESC, id DESC);
