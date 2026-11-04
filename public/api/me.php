<?php
declare(strict_types=1);

// ログイン中の本人を返すAPI。保護が必要なAPIは同じように require_login_api() から始める

require __DIR__ . '/../../src/bootstrap.php';

$user = require_login_api();

header('Content-Type: application/json; charset=utf-8');
echo json_encode(
    ['ok' => true, 'data' => ['display_name' => $user['display_name'], 'csrf_token' => csrf_token()]],
    JSON_UNESCAPED_UNICODE
);
