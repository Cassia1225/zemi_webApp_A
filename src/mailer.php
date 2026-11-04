<?php
declare(strict_types=1);

// メール送信はここだけで行う。送信サービスを変えるときはこのファイルだけ直す

function send_mail(string $to, string $subject, string $body): bool
{
    if (env('MAIL_DRIVER', 'log') === 'resend') {
        return send_mail_resend($to, $subject, $body);
    }

    // 開発用：実際には送らず storage/mail.log に書き出す
    $dir = __DIR__ . '/../storage';
    if (!is_dir($dir)) {
        mkdir($dir, 0700, true);
    }
    $text = sprintf("[%s] To: %s\nSubject: %s\n%s\n\n", date('c'), $to, $subject, $body);
    return file_put_contents($dir . '/mail.log', $text, FILE_APPEND | LOCK_EX) !== false;
}

function send_mail_resend(string $to, string $subject, string $body): bool
{
    $curl = curl_init('https://api.resend.com/emails');
    curl_setopt_array($curl, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . env('RESEND_API_KEY'),
            'Content-Type: application/json',
        ],
        CURLOPT_POSTFIELDS => json_encode([
            'from' => env('MAIL_FROM'),
            'to' => [$to],
            'subject' => $subject,
            'text' => $body,
        ]),
    ]);
    curl_exec($curl);
    $status = curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    return $status >= 200 && $status < 300;
}
