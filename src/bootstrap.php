<?php

declare(strict_types=1);

// すべてのPHPページの先頭で読み込む共通処理

require_once __DIR__ . '/env.php';

const SESSION_IDLE_SECONDS = 2 * 60 * 60; // 無操作2時間でログアウト

function start_session(): void
{
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.gc_maxlifetime', (string) SESSION_IDLE_SECONDS);
    session_name('zemi_session');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => env('APP_ENV') === 'production',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

// 想定外のエラーは内容を画面に出さず、サーバーのログに出力する。
set_exception_handler(function (Throwable $e): void {
    error_log((string) $e);
    http_response_code(500);
    exit('エラーが発生しました。時間をおいてもう一度お試しください。');
});

header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('Referrer-Policy: no-referrer'); // URL内のトークンを外部へ渡さない
header('Cache-Control: no-store');

start_session();

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/csrf.php';
require_once __DIR__ . '/rate_limit.php';
require_once __DIR__ . '/mailer.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/view.php';
