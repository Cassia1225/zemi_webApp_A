<?php
declare(strict_types=1);

// メール確認リンクの受け取り
// メールソフトの先読みで消費されないよう、開くだけでは確認せず、ボタンのPOSTで確定する

require __DIR__ . '/../../../src/bootstrap.php';

$token = $_POST['token'] ?? $_GET['token'] ?? '';
$token = is_string($token) ? $token : '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_csrf();
    $pdo = db();
    $pdo->beginTransaction();
    $userId = consume_token('email_verification_tokens', $token);
    if ($userId !== null) {
        $pdo->prepare('UPDATE users SET email_verified_at = now() WHERE id = ?')->execute([$userId]);
    }
    $pdo->commit();

    if ($userId !== null) {
        unset($_SESSION['pending_email']);
        flash('メールアドレスを確認しました。ログインしてください');
        redirect('/UI/Login/Login.php');
    }
}

page_header('メールアドレスの確認');
if (token_is_valid('email_verification_tokens', $token)) {
    ?>
    <p>下のボタンを押すと確認が完了します。</p>
    <form method="post">
        <?= csrf_field() ?>
        <input type="hidden" name="token" value="<?= h($token) ?>">
        <button type="submit">確認する</button>
    </form>
    <?php
} else {
    ?>
    <p>このリンクは無効か、期限が切れています。ログインすると確認メールを再送できます。</p>
    <p class="links"><a href="/UI/Login/Login.php">ログイン画面へ</a></p>
    <?php
}
page_footer();
