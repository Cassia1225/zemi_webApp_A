<?php
declare(strict_types=1);

// S13 メール確認待ち

require __DIR__ . '/../../../src/bootstrap.php';

$email = $_SESSION['pending_email'] ?? null;
if ($email === null) {
    redirect('/UI/Login/Login.php');
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_csrf();
    if (rate_limit_allow('mail:' . $email)) {
        $user = find_user_by_email($email);
        if ($user !== null && $user['email_verified_at'] === null) {
            send_verification_mail($user);
        }
        flash('確認メールを再送しました');
    } else {
        flash('再送の回数が多すぎます。しばらくしてからお試しください');
    }
    redirect('/UI/Login/VerifyPending.php');
}

page_header('メールを確認してください');
?>
<p><?= h($email) ?> に確認メールを送りました。メール内のリンクを開いて手続きを進めてください。</p>
<form method="post">
    <?= csrf_field() ?>
    <button type="submit">確認メールを再送する</button>
</form>
<p class="links"><a href="/UI/Login/Login.php">ログイン画面へ戻る</a></p>
<?php
page_footer();
