-- 登録時のパスワードを、メール確認が終わるまで確認トークン側に持たせる
ALTER TABLE email_verification_tokens ADD COLUMN IF NOT EXISTS pending_password_hash text;
