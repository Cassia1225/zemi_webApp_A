<?php
declare(strict_types=1);

// DB接続はここだけで行う。各機能は db() で接続を受け取り、SQLを実行する

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $url = parse_url(env('DATABASE_URL'));
    if (!is_array($url) || !isset($url['host'], $url['path'])) {
        throw new RuntimeException('.env の DATABASE_URL を確認してください');
    }
    parse_str($url['query'] ?? '', $query);

    // PDOは postgresql://... の形式を受け取れないので組み立て直す
    $dsn = sprintf(
        'pgsql:host=%s;port=%d;dbname=%s;sslmode=%s',
        $url['host'],
        $url['port'] ?? 5432,
        ltrim($url['path'], '/'),
        $query['sslmode'] ?? 'require'
    );

    $pdo = new PDO($dsn, urldecode($url['user'] ?? ''), urldecode($url['pass'] ?? ''), [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    return $pdo;
}
