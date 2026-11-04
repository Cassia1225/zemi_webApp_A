<?php
declare(strict_types=1);

// S01 ログイン

require __DIR__ . '/../../../src/bootstrap.php';

if (current_user() !== null) {
    redirect('/UI/Home/index.php');
}

$errors = [];
$email = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_csrf();
    $email = normalize_email(post_string('email'));
    $password = post_string('password');
    $limitKey = 'login:' . $email . ':' . client_ip();

    if (rate_limited($limitKey)) {
        $errors[] = 'ログインの試行回数が多すぎます。しばらくしてからお試しください';
    } else {
        $user = find_user_by_email($email);
        // メールが存在しないときもハッシュ照合を行い、応答時間の差を減らす
        $matched = password_verify($password, $user['password_hash'] ?? DUMMY_PASSWORD_HASH);

        if ($user === null || !$matched) {
            rate_limit_hit($limitKey);
            $errors[] = 'メールアドレスまたはパスワードが違います';
        } elseif ($user['email_verified_at'] === null) {
            $_SESSION['pending_email'] = $user['email'];
            redirect('/UI/Login/VerifyPending.php');
        } else {
            rate_limit_clear($limitKey);
            if (password_needs_rehash($user['password_hash'], PASSWORD_DEFAULT)) {
                db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?')
                    ->execute([password_hash($password, PASSWORD_DEFAULT), $user['id']]);
            }
            login_user($user);
            redirect('/UI/Home/index.php');
        }
    }
}

page_header('ログイン');
show_errors($errors);
?>
<form method="post">
    <?= csrf_field() ?>
    <label for="email">メールアドレス</label>
    <input type="email" id="email" name="email" value="<?= h($email) ?>" autocomplete="username" required autofocus>
    <label for="password">パスワード</label>
    <input type="password" id="password" name="password" autocomplete="current-password" required>
    <button type="submit">ログイン</button>
</form>
<p class="links">
    <a href="/UI/Login/Register.php">新規登録</a>
    <a href="/UI/Login/ForgotPassword.php">パスワードを忘れた場合</a>
</p>
<?php
page_footer();
