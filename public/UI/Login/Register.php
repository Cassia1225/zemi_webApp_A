<?php
declare(strict_types=1);

// S02 新規登録

require __DIR__ . '/../../../src/bootstrap.php';

if (current_user() !== null) {
    redirect('/UI/Home/index.php');
}

function new_share_id(): string
{
    $chars = 'abcdefghjkmnpqrstuvwxyz23456789'; // 紛らわしい文字を除く
    $id = '';
    for ($i = 0; $i < 12; $i++) {
        $id .= $chars[random_int(0, strlen($chars) - 1)];
    }
    return $id;
}

$errors = [];
$email = '';
$displayName = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_csrf();
    $email = normalize_email(post_string('email'));
    $displayName = trim(post_string('display_name'));
    $password = post_string('password');

    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 254) {
        $errors[] = 'メールアドレスの形式を確認してください';
    }
    if ($displayName === '' || mb_strlen($displayName) > 20) {
        $errors[] = '表示名は1〜20文字で入力してください';
    }
    $problem = password_problem($password, post_string('password_confirm'));
    if ($problem !== null) {
        $errors[] = $problem;
    }

    if ($errors === []) {
        $stmt = db()->prepare(
            'INSERT INTO users (email, public_share_id, display_name, password_hash)
             VALUES (?, ?, ?, ?)
             ON CONFLICT (email) DO NOTHING
             RETURNING *'
        );
        $stmt->execute([$email, new_share_id(), $displayName, password_hash($password, PASSWORD_DEFAULT)]);
        $user = $stmt->fetch();

        if (!$user) {
            $errors[] = 'このメールアドレスはすでに登録されています';
        } else {
            $_SESSION['pending_email'] = $email;
            if (!send_verification_mail($user)) {
                flash('確認メールを送れませんでした。下のボタンから再送してください');
            }
            redirect('/UI/Login/VerifyPending.php');
        }
    }
}

page_header('新規登録');
show_errors($errors);
?>
<form method="post">
    <?= csrf_field() ?>
    <label for="email">メールアドレス</label>
    <input type="email" id="email" name="email" value="<?= h($email) ?>" autocomplete="username" required autofocus>
    <label for="display_name">表示名（20文字まで）</label>
    <input type="text" id="display_name" name="display_name" value="<?= h($displayName) ?>" maxlength="20" autocomplete="nickname" required>
    <label for="password">パスワード（8文字以上）</label>
    <input type="password" id="password" name="password" minlength="8" autocomplete="new-password" required>
    <label for="password_confirm">パスワード（確認）</label>
    <input type="password" id="password_confirm" name="password_confirm" minlength="8" autocomplete="new-password" required>
    <button type="submit">登録する</button>
</form>
<p class="links"><a href="/UI/Login/Login.php">ログイン画面へ戻る</a></p>
<?php
page_footer();
