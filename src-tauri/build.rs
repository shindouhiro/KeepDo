fn main() {
    println!("cargo:rerun-if-env-changed=KEEPDO_API_ORIGIN");
    let origin = std::env::var("KEEPDO_API_ORIGIN")
        .unwrap_or_else(|_| "https://keepdo.shindouhiro.workers.dev".into());
    println!("cargo:rustc-env=KEEPDO_API_ORIGIN={origin}");
    tauri_build::build()
}
