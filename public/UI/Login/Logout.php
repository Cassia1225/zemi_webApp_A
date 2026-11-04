<?php
declare(strict_types=1);

// ログアウト（POSTのみ受け付ける）

require __DIR__ . '/../../../src/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    require_csrf();
    logout_user();
}
redirect('/UI/Login/Login.php');
