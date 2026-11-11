<?php
header('Content-Type: application/json; charset=utf-8');

$dataFile = __DIR__ . '/data/messages.json';

// データ保存用ディレクトリの自動作成
if (!file_exists(__DIR__ . '/data')) {
    mkdir(__DIR__ . '/data', 0777, true);
}
if (!file_exists($dataFile)) {
    file_put_contents($dataFile, json_encode([], JSON_UNESCAPED_UNICODE));
}

$action = $_GET['action'] ?? '';

// ===== 1. 送信処理 (POST) =====
if ($action === 'send' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);

    if (empty($input['sender']) || empty($input['data'])) {
        http_response_code(400);
        echo json_encode(['error' => '送信者名または送信データが不足しています。'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $newMessage = [
        'id' => uniqid('msg_'),
        'sender' => htmlspecialchars($input['sender'], ENT_QUOTES, 'UTF-8'),
        'date' => date('Y/m/d H:i'),
        'data' => $input['data']
    ];

    $messages = json_decode(file_get_contents($dataFile), true) ?? [];
    array_unshift($messages, $newMessage); // 新しい順に追加

    // 直近50件まで保持（サーバー容量圧迫防止）
    if (count($messages) > 50) {
        $messages = array_slice($messages, 0, 50);
    }

    file_put_contents($dataFile, json_encode($messages, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

    echo json_encode(['success' => true, 'message' => '時間割を送信しました。'], JSON_UNESCAPED_UNICODE);
    exit;
}

// ===== 2. 受信処理 (GET) =====
if ($action === 'receive' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $messages = json_decode(file_get_contents($dataFile), true) ?? [];
    echo json_encode($messages, JSON_UNESCAPED_UNICODE);
    exit;
}

http_response_code(400);
echo json_encode(['error' => '無効なリクエストです。'], JSON_UNESCAPED_UNICODE);