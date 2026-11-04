<?php
declare(strict_types=1);

// 試行回数の制限。$key には "login:メール:IP" のような文字列を渡す

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MINUTES = 15;

function rate_limited(string $key): bool
{
    $stmt = db()->prepare(
        'SELECT attempts FROM rate_limits
         WHERE key_hash = ? AND window_start > now() - make_interval(mins => ?)'
    );
    $stmt->execute([hash('sha256', $key), RATE_LIMIT_WINDOW_MINUTES]);
    return (int) $stmt->fetchColumn() >= RATE_LIMIT_MAX;
}

function rate_limit_hit(string $key): void
{
    $stmt = db()->prepare(
        'INSERT INTO rate_limits (key_hash, attempts, window_start) VALUES (?, 1, now())
         ON CONFLICT (key_hash) DO UPDATE SET
           attempts = CASE WHEN rate_limits.window_start > now() - make_interval(mins => ?)
                           THEN rate_limits.attempts + 1 ELSE 1 END,
           window_start = CASE WHEN rate_limits.window_start > now() - make_interval(mins => ?)
                               THEN rate_limits.window_start ELSE now() END'
    );
    $stmt->execute([hash('sha256', $key), RATE_LIMIT_WINDOW_MINUTES, RATE_LIMIT_WINDOW_MINUTES]);
}

function rate_limit_clear(string $key): void
{
    db()->prepare('DELETE FROM rate_limits WHERE key_hash = ?')->execute([hash('sha256', $key)]);
}
