-- 将完整恢复中的所有写操作绑定到同一次成功的版本检查。
ALTER TABLE user_data ADD COLUMN restore_token TEXT NOT NULL DEFAULT '';
