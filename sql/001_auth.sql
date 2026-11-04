-- ログイン機能で使うテーブル（何度実行しても壊れないよう IF NOT EXISTS にしている）

CREATE TABLE IF NOT EXISTS users (
    id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email             text        NOT NULL UNIQUE,       -- 小文字にそろえて保存する
    public_share_id   text        NOT NULL UNIQUE,       -- 時間割共有用のID（認証には使わない）
    display_name      text        NOT NULL,
    password_hash     text        NOT NULL,
    email_verified_at timestamptz,                       -- NULLならメール未確認
    current_year      integer,
    current_quarter   smallint CHECK (current_quarter BETWEEN 1 AND 4),
    session_version   integer     NOT NULL DEFAULT 0,    -- 増やすと既存のログインが無効になる
    created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    bigint      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash text        NOT NULL UNIQUE,              -- トークン本体は保存しない
    expires_at timestamptz NOT NULL,
    used_at    timestamptz
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    bigint      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash text        NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    used_at    timestamptz
);

-- ログイン失敗やメール送信の回数制限
CREATE TABLE IF NOT EXISTS rate_limits (
    key_hash     text        PRIMARY KEY,
    attempts     integer     NOT NULL DEFAULT 0,
    window_start timestamptz NOT NULL DEFAULT now()
);
