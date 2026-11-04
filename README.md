ゼミでのアプリ開発に使うディレクトリです。

#技術スタック

##フロントエンドの技術と、行うこと
 - javascript・typescript / React

###行うこと
 - 画面表示

##バックエンドの技術と、行うこと
 - php
 - javascript
 - typescript

###行うこと
 - ログイン機能
 - SQLによるCRUD処理
 -

#起動方法（ログイン機能）

 1. `.env.example` をコピーして `.env` を作り、`DATABASE_URL` にNeonの接続文字列を入れる
 2. `php bin/migrate.php` でテーブルを作る
 3. `php -S localhost:8000 -t public` で起動し、http://localhost:8000 を開く

`public/` の中だけがブラウザから見える。`.env` や `src/` を `public/` に入れないこと。
確認メールはまだ送信されず、`storage/mail.log` に書き出される。
