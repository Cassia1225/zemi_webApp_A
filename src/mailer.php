<?php
declare(strict_types=1);

// メール送信はここだけで行う。送信サービスが決まったら send_mail の中身を差し替える

function send_mail(string $to, string $subject, string $body): bool
{
    // 開発用：実際には送らず storage/mail.log に書き出す
    $dir = __DIR__ . '/../storage';
    if (!is_dir($dir)) {
        mkdir($dir, 0700, true);
    }
    $text = sprintf("[%s] To: %s\nSubject: %s\n%s\n\n", date('c'), $to, $subject, $body);
    return file_put_contents($dir . '/mail.log', $text, FILE_APPEND | LOCK_EX) !== false;
}
