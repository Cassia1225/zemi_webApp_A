<?php
header('Content-Type: application/json; charset=utf-8');

// ===== 送信/受信(ユーザIDで相手を指定して送る) =====
// data/exchange.json の形:
// { names: { "U-AAAAAA": "山田 太郎" },
//   inbox: { "U-宛先": { "U-送信者": { ts, date, data: [{ name:'1Q', courses:[...] }] } } } }
// ※ユーザIDは仮実装。ログイン機能ができたら $me を認証済みIDに置き換える

const Q_NAMES = ['1Q', '2Q', '3Q', '4Q'];
const MAX_SENDERS = 50; // 1人の受信箱に残す送信者数

$dataDir  = __DIR__ . '/data';
$dataFile = $dataDir . '/exchange.json';

// データ保存用ディレクトリの自動作成
if (!file_exists($dataDir)) {
    mkdir($dataDir, 0777, true);
}
// dataフォルダのJSONをURLから直接開けないようにする(Apache)
if (!file_exists($dataDir . '/.htaccess')) {
    file_put_contents(
        $dataDir . '/.htaccess',
        "<IfModule mod_authz_core.c>\nRequire all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\nDeny from all\n</IfModule>\n"
    );
}

function fail($code, $msg) {
    http_response_code($code);
    echo json_encode(['error' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

function respond($payload) {
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function isUserId($id) {
    return is_string($id) && preg_match('/^U-[0-9A-Z]{6}$/', $id) === 1;
}

/** 受け取った時間割を、保存してよい項目・長さだけにする */
function cleanData($data) {
    $out = [];
    if (!is_array($data)) return $out;
    foreach ($data as $q) {
        if (!is_array($q) || !in_array($q['name'] ?? '', Q_NAMES, true)) continue;
        $courses = [];
        foreach ((is_array($q['courses'] ?? null) ? $q['courses'] : []) as $c) {
            if (!is_array($c) || count($courses) >= 60) continue;
            $courses[] = [
                'id'       => mb_substr((string)($c['id'] ?? ''), 0, 20),
                'day'      => mb_substr((string)($c['day'] ?? ''), 0, 1),
                'period'   => (int)($c['period'] ?? 0),
                'name'     => mb_substr((string)($c['name'] ?? ''), 0, 50),
                'teacher'  => mb_substr((string)($c['teacher'] ?? ''), 0, 50),
                'room'     => mb_substr((string)($c['room'] ?? ''), 0, 50),
                'colorIdx' => (int)($c['colorIdx'] ?? 0),
            ];
        }
        $out[] = ['name' => $q['name'], 'courses' => $courses];
    }
    return $out;
}

/** JSONを読む(共有ロック) */
function readStore($file) {
    $fp = fopen($file, 'c+');
    flock($fp, LOCK_SH);
    $store = json_decode(stream_get_contents($fp), true) ?: [];
    flock($fp, LOCK_UN);
    fclose($fp);
    return $store;
}

/** JSONを排他ロックして書き換える($fn が $store を直接変更する) */
function updateStore($file, $fn) {
    $fp = fopen($file, 'c+');
    flock($fp, LOCK_EX);
    $store = json_decode(stream_get_contents($fp), true) ?: [];
    $fn($store);
    rewind($fp);
    ftruncate($fp, 0);
    fwrite($fp, json_encode($store, JSON_UNESCAPED_UNICODE));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
}

$action = $_GET['action'] ?? '';
$me = $_GET['me'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

if (!isUserId($me)) fail(400, 'ユーザIDが正しくありません。');

// ===== 1. 送信 (POST) =====
// 宛先の受信箱に入れる。同じ送信者から同じQを再送した場合は上書き、別のQは追加される
if ($action === 'send' && $method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $to = $input['to'] ?? '';
    if (!isUserId($to)) fail(400, '相手のユーザIDが正しくありません。');
    if ($to === $me) fail(400, '自分自身には送れません。');
    $name = mb_substr(trim((string)($input['name'] ?? '')), 0, 30);
    if ($name === '') fail(400, '表示名を入力してください。');
    $data = cleanData($input['data'] ?? []);
    if (!$data) fail(400, '送信する時間割がありません。');

    updateStore($dataFile, function (&$s) use ($me, $to, $name, $data) {
        $s['names'][$me] = $name;
        $byQ = [];
        foreach (($s['inbox'][$to][$me]['data'] ?? []) as $q) $byQ[$q['name']] = $q;
        foreach ($data as $q) $byQ[$q['name']] = $q;
        ksort($byQ);
        $s['inbox'][$to][$me] = [
            'ts'   => time(),
            'date' => date('Y/m/d H:i'),
            'data' => array_values($byQ),
        ];
        // 送信者が多すぎる場合は古いものから削除
        if (count($s['inbox'][$to]) > MAX_SENDERS) {
            uasort($s['inbox'][$to], function ($a, $b) { return $b['ts'] <=> $a['ts']; });
            $s['inbox'][$to] = array_slice($s['inbox'][$to], 0, MAX_SENDERS, true);
        }
    });
    respond(['success' => true]);
}

// ===== 2. 受信 (GET) =====
// 自分宛てに届いたものだけを新しい順に返す
if ($action === 'inbox' && $method === 'GET') {
    $s = readStore($dataFile);
    $list = [];
    foreach (($s['inbox'][$me] ?? []) as $from => $m) {
        $list[] = [
            'id'   => $from,
            'name' => $s['names'][$from] ?? '',
            'ts'   => $m['ts'],
            'date' => $m['date'],
            'qs'   => array_column($m['data'], 'name'),
            'data' => $m['data'],
        ];
    }
    usort($list, function ($a, $b) { return $b['ts'] <=> $a['ts']; });
    respond($list);
}

// ===== 3. 表示名の取得 (GET) =====
// ids=U-AAAAAA,U-BBBBBB の表示名を返す(名前が登録されていないIDは含まれない)
if ($action === 'names' && $method === 'GET') {
    $s = readStore($dataFile);
    $out = [];
    foreach (array_slice(explode(',', (string)($_GET['ids'] ?? '')), 0, 50) as $id) {
        if (isUserId($id) && !empty($s['names'][$id])) $out[$id] = $s['names'][$id];
    }
    respond((object)$out);
}

fail(400, '無効なリクエストです。');
