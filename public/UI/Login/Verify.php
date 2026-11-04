<?php
declare(strict_types=1);

// メール確認リンクの受け取り
// メールソフトの先読みで消費されないよう、開くだけでは確認せず、ボタンのPOSTで確定する
// 他人が勝手に登録したリンクを本人が開いても有効にならないよう、登録時のパスワードの入力を求める

require __DIR__ . '/../../../src/bootstrap.php';

$token = $_POST['token'] ?? $_GET['token'] ?? '';
$token = is_string($token) ? $token : '';
$errors = [];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_csrf();
    $pending = find_valid_token('email_verification_tokens', $token);

    if ($pending !== null && password_verify(post_string('password'), $pending['pending_password_hash'] ?? '')) {
        $pdo = db();
        $pdo->beginTransaction();
        $row = consume_token('email_verification_tokens', $token);
        if ($row !== null) {
            $pdo->prepare(
                'UPDATE users SET email_verified_at = now(), password_hash = ?
                 WHERE id = ? AND email_verified_at IS NULL'
            )->execute([$row['pending_password_hash'], $row['user_id']]);
            // 同じアカウントに残っている他の確認リンクは使えなくする
            $pdo->prepare('UPDATE email_verification_tokens SET used_at = now() WHERE user_id = ? AND used_at IS NULL')
                ->execute([$row['user_id']]);
        }
        $pdo->commit();

        if ($row !== null) {
            unset($_SESSION['pending_email'], $_SESSION['pending_password_hash']);
            flash('メールアドレスを確認しました。ログインしてください');
            redirect('/UI/Login/Login.php');
        }
    } elseif ($pending !== null) {
        $errors[] = 'パスワードが違います。登録したときのパスワードを入力してください';
    }
}

page_header('メールアドレスの確認');
if (find_valid_token('email_verification_tokens', $token) !== null) {
    show_errors($errors);
    ?>
    <form method="post">
        <?= csrf_field() ?>
        <input type="hidden" name="token" value="<?= h($token) ?>">
        <label for="password">登録したときのパスワード</label>
        <input type="password" id="password" name="password" autocomplete="current-password" required autofocus>
        <button type="submit">確認する</button>
    </form>
    <p>登録した覚えがない場合は、この画面を閉じてください。</p>
    <?php
} else {
    ?>
    <p>このリンクは無効か、期限が切れています。ログインすると確認メールを再送できます。</p>
    <p class="links"><a href="/UI/Login/Login.php">ログイン画面へ</a></p>
    <?php
}
page_footer();
