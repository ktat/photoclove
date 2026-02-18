fn main() {
    // libheif-rs の compile-libheif feature がソースから自動ビルドするため
    // vcpkg によるシステムライブラリ検索は不要
    tauri_build::build()
}
