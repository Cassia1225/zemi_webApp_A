<?php
declare(strict_types=1);

// 画面表示の共通部分

/** HTMLに出す値は必ずこれを通す */
function h(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
}

function redirect(string $path): never
{
    header('Location: ' . $path, true, 303);
    exit;
}

/** POSTの文字列を受け取る（配列などが送られても壊れないように） */
function post_string(string $key): string
{
    $value = $_POST[$key] ?? '';
    return is_string($value) ? $value : '';
}

function flash(string $message): void
{
    $_SESSION['flash'] = $message;
}

function page_header(string $title): void
{
    $flash = $_SESSION['flash'] ?? null;
    unset($_SESSION['flash']);
    ?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= h($title) ?> | 学生サポートアプリ</title>
    <link rel="stylesheet" href="/css/Login.css">
</head>
<body>
<main class="auth-card">
    <p class="app-name">学生サポートアプリ</p>
    <h1><?= h($title) ?></h1>
    <?php if ($flash !== null): ?>
        <p class="notice"><?= h($flash) ?></p>
    <?php endif; ?>
    <?php
}

function page_footer(): void
{
    echo "</main>\n</body>\n</html>\n";
}

/** 入力エラーを一覧で表示する */
function show_errors(array $errors): void
{
    if ($errors === []) {
        return;
    }
    echo '<ul class="errors" role="alert">';
    foreach ($errors as $error) {
        echo '<li>' . h($error) . '</li>';
    }
    echo '</ul>';
}
