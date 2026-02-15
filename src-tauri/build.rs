use vcpkg::Config;

fn main() {
    // Windowsの場合のみvcpkgでライブラリを探す
    if std::env::var("CARGO_CFG_TARGET_OS").unwrap() == "windows" {
        let mut config = Config::new();
        config.target_triplet("x64-windows-static");

        // libheif を探してリンク設定を自動追加
        config.probe("libheif").expect("libheif static library not found via vcpkg");

        // 静的リンクを強制するためのフラグ（MSVCの場合）
        println!("cargo:rustc-link-lib=static=libheif");

        // 依存するランタイムを静的に結合する場合の設定
        println!("cargo:rustc-link-search=native={}", "path/to/vcpkg/installed/x64-windows-static/lib");
    }

    tauri_build::build()
}
