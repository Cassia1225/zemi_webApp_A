<?php
declare(strict_types=1);

require __DIR__ . '/../../../src/bootstrap.php';

$user = require_login();
?>
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>学生サポートアプリ</title>
<link rel="stylesheet" href="./../../css/Home.css">
<script src="./Home.js" defer></script>
</head>
<body>

<header>
  <span>学生サポートアプリ</span>
  <form class="account" action="/UI/Login/Logout.php" method="post">
    <span><?= h($user['display_name']) ?> さん</span>
    <?= csrf_field() ?>
    <button type="submit">ログアウト</button>
  </form>
</header>

<main>
  <nav>
    <button>Home</button>
    <button data-src="./../TimeTable/timetable.html">時間割</button>
    <button data-src="./../Relux/relax.html">休憩</button>
    <button data-src="./../Data_Transfer/transfer.html">転送</button>
    <button data-src="./../Setting/settings.html">設定</button>
  </nav>

  <div id="content">
    <div id="home">
      <h2>Home</h2>
      <p>利用する機能を選択してください。</p>
    </div>
  </div>
</main>
</body>
</html>