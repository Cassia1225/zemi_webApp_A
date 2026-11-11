<?php
declare(strict_types=1);

// S15 新しいパスワードの設定

require __DIR__ . '/../../../src/bootstrap.php';

$token = $_POST['token'] ?? $_GET['token'] ?? '';
$token = is_string($token) ? $token : '';
$errors = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_csrf();
    $password = post_string('password');
    $problem = password_problem($password, post_string('password_confirm'));

    if ($problem !== null) {
        $errors[] = $problem;
    } else {
        // トークン消費とパスワード変更は、必ず両方成功させる
        $pdo = db();
        $pdo->beginTransaction();
        $row = consume_token('password_reset_tokens', $token);
        if ($row !== null) {
            // session_version を増やして、他の端末のログインも無効にする
            $pdo->prepare('UPDATE users SET password_hash = ?, session_version = session_version + 1 WHERE id = ?')
                ->execute([password_hash($password, PASSWORD_DEFAULT), $row['user_id']]);
        }
        $pdo->commit();

        if ($row !== null) {
            flash('パスワードを変更しました。ログインしてください');
            redirect('/UI/Login/Login.php');
        }
    }
}

page_header('新しいパスワードの設定');
if (find_valid_token('password_reset_tokens', $token) !== null) {
    show_errors($errors);
    ?>
    <form method="post">
        <?= csrf_field() ?>
        <input type="hidden" name="token" value="<?= h($token) ?>">
        <label for="password">新しいパスワード（8文字以上）</label>
        <input type="password" id="password" name="password" minlength="8" autocomplete="new-password" required autofocus>
        <label for="password_confirm">新しいパスワード（確認）</label>
        <input type="password" id="password_confirm" name="password_confirm" minlength="8" autocomplete="new-password" required>
        <button type="submit">変更する</button>
    </form>
    <?php
} else {
    ?>
    <p>このリンクは無効か、期限が切れています。もう一度再設定を依頼してください。</p>
    <p class="links"><a href="/UI/Login/ForgotPassword.php">再設定を依頼する</a></p>
    <?php
}
page_footer();
