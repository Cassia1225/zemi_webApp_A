<?php
declare(strict_types=1);

// sql/ の中のファイルを名前順に実行する： php bin/migrate.php

require __DIR__ . '/../src/env.php';
require __DIR__ . '/../src/db.php';

foreach (glob(__DIR__ . '/../sql/*.sql') as $file) {
    db()->exec(file_get_contents($file));
    echo '実行しました: ' . basename($file) . PHP_EOL;
}
