use keyring_core::{Entry, Error};
use std::sync::{Mutex, OnceLock};

static READY: OnceLock<()> = OnceLock::new();
static INITIALIZATION: Mutex<()> = Mutex::new(());

fn initialize() -> Result<(), String> {
    if READY.get().is_some() {
        return Ok(());
    }
    let _guard = INITIALIZATION.lock().map_err(|_| "系统凭据初始化失败")?;
    if READY.get().is_none() {
        #[cfg(target_os = "ios")]
        let store = apple_native_keyring_store::protected::Store::new();
        #[cfg(target_os = "macos")]
        let store = apple_native_keyring_store::keychain::Store::new();
        #[cfg(target_os = "windows")]
        let store = windows_native_keyring_store::Store::new();
        #[cfg(target_os = "android")]
        let store = android_native_keyring_store::Store::new();
        #[cfg(target_os = "linux")]
        let store = dbus_secret_service_keyring_store::Store::new();
        let store =
            store.map_err(|_| "无法打开系统凭据存储，请解锁钥匙串或启用系统密钥环后重试")?;
        keyring_core::set_default_store(store);
        let _ = READY.set(());
    }
    Ok(())
}

fn entry() -> Result<Entry, String> {
    initialize()?;
    // 不同服务器使用独立凭据，测试构建不能读取生产会话。
    Entry::new("dev.keepdo.client", env!("KEEPDO_API_ORIGIN"))
        .map_err(|_| "无法访问系统凭据存储".into())
}

pub fn read() -> Result<Option<String>, String> {
    match entry()?.get_password() {
        Ok(token) => Ok(Some(token)),
        Err(Error::NoEntry) => Ok(None),
        Err(_) => Err("无法读取登录凭据，请解锁系统密钥环后重试".into()),
    }
}

pub fn save(token: &str) -> Result<(), String> {
    entry()?
        .set_password(token)
        .map_err(|_| "无法安全保存登录凭据，请检查系统密钥环后重试".into())
}

pub fn clear() -> Result<(), String> {
    match entry()?.delete_credential() {
        Ok(()) | Err(Error::NoEntry) => Ok(()),
        Err(_) => Err("无法清除系统登录凭据，请解锁系统密钥环后重试".into()),
    }
}
