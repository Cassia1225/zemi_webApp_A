<?php
declare(strict_types=1);

// .env の読み込み

function load_env(string $path): void
{
    if (!is_file($path)) {
        return;
    }
    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) {
            continue;
        }
        [$key, $value] = explode('=', $line, 2);
        $_ENV[trim($key)] = trim(trim($value), "\"'");
    }
}

function env(string $key, string $default = ''): string
{
    $value = $_ENV[$key] ?? '';
    return $value === '' ? $default : $value;
}

load_env(__DIR__ . '/../.env');
