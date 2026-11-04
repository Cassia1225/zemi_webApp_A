<?php
declare(strict_types=1);

// S14 再設定メールの依頼

require __DIR__ . '/../../../src/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_csrf();
    $email = normalize_email(post_string('email'));
    $limitKey = 'mail:' . $email;

    if (!rate_limited($limitKey)) {
        rate_limit_hit($limitKey);
        $user = find_user_by_email($email);
        if ($user !== null) {
            send_reset_mail($user);
        }
    }
    // 登録の有無が分からないよう、どの場合も同じ案内にする
    flash('登録されているメールアドレスなら、再設定のメールを送りました');
    redirect('/UI/Login/ForgotPassword.php');
}

page_header('パスワードの再設定');
?>
<form method="post">
    <?= csrf_field() ?>
    <label for="email">登録したメールアドレス</label>
    <input type="email" id="email" name="email" autocomplete="username" required autofocus>
    <button type="submit">再設定メールを送る</button>
</form>
<p class="links"><a href="/UI/Login/Login.php">ログイン画面へ戻る</a></p>
<?php
page_footer();
