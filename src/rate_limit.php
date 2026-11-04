<?php
declare(strict_types=1);

// 試行回数の制限。$key には "login:メール:IP" のような文字列を渡す

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MINUTES = 15;

/**
 * 試行を1回記録し、上限以内なら true を返す。
 * 記録と回数の確認を1つのSQLで行うので、同時に送られても上限を超えて通らない。
 */
function rate_limit_allow(string $key, int $max = RATE_LIMIT_MAX): bool
{
    $stmt = db()->prepare(
        'INSERT INTO rate_limits (key_hash, attempts, window_start) VALUES (?, 1, now())
         ON CONFLICT (key_hash) DO UPDATE SET
           attempts = CASE WHEN rate_limits.window_start > now() - make_interval(mins => ?)
                           THEN rate_limits.attempts + 1 ELSE 1 END,
           window_start = CASE WHEN rate_limits.window_start > now() - make_interval(mins => ?)
                               THEN rate_limits.window_start ELSE now() END
         RETURNING attempts'
    );
    $stmt->execute([hash('sha256', $key), RATE_LIMIT_WINDOW_MINUTES, RATE_LIMIT_WINDOW_MINUTES]);
    return (int) $stmt->fetchColumn() <= $max;
}

function rate_limit_clear(string $key): void
{
    db()->prepare('DELETE FROM rate_limits WHERE key_hash = ?')->execute([hash('sha256', $key)]);
}
