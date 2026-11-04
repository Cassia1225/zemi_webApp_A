<?php
declare(strict_types=1);

// 登録・ログイン・トークン処理の共通部分

const VERIFY_TOKEN_HOURS = 24;
const RESET_TOKEN_MINUTES = 30;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_BYTES = 72; // bcryptは72バイトより後を無視するため

// 存在しないメールでも同じ時間がかかるよう照合に使う、誰のものでもないハッシュ
const DUMMY_PASSWORD_HASH = '$2y$12$LaeokbNBHCpyhmk3Klt4iemS5ig2v05uSYiLFPJ8/spY8qG9cUPOi';

function normalize_email(string $email): string
{
    return mb_strtolower(trim($email));
}

function client_ip(): string
{
    return $_SERVER['REMOTE_ADDR'] ?? 'unknown';
}

/** パスワードの問題があれば理由を返す。問題なければ null */
function password_problem(string $password, string $confirm): ?string
{
    if (mb_strlen($password) < PASSWORD_MIN_LENGTH) {
        return 'パスワードは' . PASSWORD_MIN_LENGTH . '文字以上にしてください';
    }
    if (strlen($password) > PASSWORD_MAX_BYTES) {
        return 'パスワードが長すぎます（半角で' . PASSWORD_MAX_BYTES . '文字まで）';
    }
    if ($password !== $confirm) {
        return '確認用のパスワードが一致しません';
    }
    return null;
}

function find_user_by_email(string $email): ?array
{
    $stmt = db()->prepare('SELECT * FROM users WHERE email = ?');
    $stmt->execute([$email]);
    return $stmt->fetch() ?: null;
}

/** 今ログインしている本人を返す。ログインしていなければ null */
function current_user(): ?array
{
    static $user = false;
    if ($user !== false) {
        return $user;
    }
    $user = null;

    if (!isset($_SESSION['user_id'])) {
        return null;
    }
    if (time() - ($_SESSION['last_seen'] ?? 0) > SESSION_IDLE_SECONDS) {
        logout_user();
        return null;
    }

    $stmt = db()->prepare('SELECT * FROM users WHERE id = ?');
    $stmt->execute([$_SESSION['user_id']]);
    $row = $stmt->fetch();

    // パスワード再設定後の古いログインや、削除済みアカウントを通さない
    if (!$row || $row['email_verified_at'] === null
        || (int) $row['session_version'] !== ($_SESSION['session_version'] ?? -1)) {
        logout_user();
        return null;
    }

    $_SESSION['last_seen'] = time();
    $user = $row;
    return $user;
}

/** 画面用：未ログインならログイン画面へ移動する */
function require_login(): array
{
    $user = current_user();
    if ($user === null) {
        redirect('/UI/Login/Login.php');
    }
    return $user;
}

/** API用：未ログインなら401のJSONを返して終了する */
function require_login_api(): array
{
    $user = current_user();
    if ($user === null) {
        http_response_code(401);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(
            ['ok' => false, 'error' => ['code' => 'UNAUTHENTICATED', 'message' => 'ログインしてください']],
            JSON_UNESCAPED_UNICODE
        );
        exit;
    }
    return $user;
}

function login_user(array $user): void
{
    session_regenerate_id(true); // ログイン前のセッションIDを使い回させない
    unset($_SESSION['csrf_token'], $_SESSION['pending_email']);
    $_SESSION['user_id'] = (int) $user['id'];
    $_SESSION['session_version'] = (int) $user['session_version'];
    $_SESSION['last_seen'] = time();
}

function logout_user(): void
{
    $_SESSION = [];
    session_regenerate_id(true); // 古いセッションを消して、空の新しいセッションに切り替える
}

function token_hash(string $token): string
{
    return hash('sha256', $token);
}

/** メール確認用のトークンを作り直して、確認メールを送る */
function send_verification_mail(array $user): bool
{
    $token = bin2hex(random_bytes(32));
    $pdo = db();
    $pdo->prepare('UPDATE email_verification_tokens SET used_at = now() WHERE user_id = ? AND used_at IS NULL')
        ->execute([$user['id']]);
    $pdo->prepare(
        'INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
         VALUES (?, ?, now() + make_interval(hours => ?))'
    )->execute([$user['id'], token_hash($token), VERIFY_TOKEN_HOURS]);

    $url = rtrim(env('APP_URL'), '/') . '/UI/Login/Verify.php?token=' . $token;
    return send_mail(
        $user['email'],
        '【学生サポートアプリ】メールアドレスの確認',
        "下のリンクを開いて、メールアドレスの確認を完了してください。\n\n{$url}\n\n"
        . 'リンクの有効期限は' . VERIFY_TOKEN_HOURS . "時間です。\n心当たりがない場合は、このメールを無視してください。"
    );
}

function send_reset_mail(array $user): bool
{
    $token = bin2hex(random_bytes(32));
    $pdo = db();
    $pdo->prepare('UPDATE password_reset_tokens SET used_at = now() WHERE user_id = ? AND used_at IS NULL')
        ->execute([$user['id']]);
    $pdo->prepare(
        'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES (?, ?, now() + make_interval(mins => ?))'
    )->execute([$user['id'], token_hash($token), RESET_TOKEN_MINUTES]);

    $url = rtrim(env('APP_URL'), '/') . '/UI/Login/ResetPassword.php?token=' . $token;
    return send_mail(
        $user['email'],
        '【学生サポートアプリ】パスワードの再設定',
        "下のリンクから新しいパスワードを設定してください。\n\n{$url}\n\n"
        . 'リンクの有効期限は' . RESET_TOKEN_MINUTES . "分です。\n心当たりがない場合は、このメールを無視してください。"
    );
}

/** トークンが今も使えるか確認する（消費はしない） */
function token_is_valid(string $table, string $token): bool
{
    $stmt = db()->prepare(
        "SELECT 1 FROM {$table} WHERE token_hash = ? AND used_at IS NULL AND expires_at > now()"
    );
    $stmt->execute([token_hash($token)]);
    return (bool) $stmt->fetchColumn();
}

/** トークンを1回だけ消費して user_id を返す。無効なら null */
function consume_token(string $table, string $token): ?int
{
    $stmt = db()->prepare(
        "UPDATE {$table} SET used_at = now()
         WHERE token_hash = ? AND used_at IS NULL AND expires_at > now()
         RETURNING user_id"
    );
    $stmt->execute([token_hash($token)]);
    $userId = $stmt->fetchColumn();
    return $userId === false ? null : (int) $userId;
}
