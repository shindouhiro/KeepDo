use base64::{engine::general_purpose::STANDARD, Engine};
use reqwest::{Client, Method, Url};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
    time::Duration,
};
use tauri::State;
use tokio::sync::Notify;

const BODY_LIMIT: usize = 91_000_000;

#[derive(Default)]
pub struct Network {
    pending: Mutex<HashMap<String, Arc<Notify>>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ApiInput {
    id: String,
    path: String,
    method: String,
    content_type: Option<String>,
    body: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiResponse {
    status: u16,
    content_type: String,
    body: String,
}

fn api_url(origin: &str, path: &str, development: bool) -> Result<Url, String> {
    let base = Url::parse(origin).map_err(|_| "API 地址格式不正确")?;
    let local = matches!(base.host_str(), Some("localhost" | "127.0.0.1" | "[::1]"));
    if !(base.scheme() == "https" || development && local && base.scheme() == "http")
        || base.host_str().is_none()
        || !base.username().is_empty()
        || base.password().is_some()
        || base.path() != "/"
        || base.query().is_some()
        || base.fragment().is_some()
    {
        return Err("API 地址必须为 HTTPS 来源；调试时可连接本机 HTTP 服务".into());
    }
    if !path.starts_with("/api/") || path.starts_with("/api/native/") || path.contains(['\\', '#'])
    {
        return Err("只允许访问 KeepDo API".into());
    }
    let url = base
        .join(&path.replacen("/api/", "/api/native/", 1))
        .map_err(|_| "API 路径不正确")?;
    if url.origin() != base.origin() || !url.path().starts_with("/api/native/") {
        return Err("API 路径不正确".into());
    }
    Ok(url)
}

async fn credential<T: Send + 'static>(
    operation: impl FnOnce() -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(operation)
        .await
        .map_err(|_| "系统凭据操作失败")?
}

async fn send(input: ApiInput) -> Result<ApiResponse, String> {
    let url = api_url(
        env!("KEEPDO_API_ORIGIN"),
        &input.path,
        cfg!(debug_assertions),
    )?;
    let method = match input.method.as_str() {
        "GET" => Method::GET,
        "POST" => Method::POST,
        "PUT" => Method::PUT,
        "DELETE" => Method::DELETE,
        _ => return Err("不支持此请求方法".into()),
    };
    let client = Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .connect_timeout(Duration::from_secs(15))
        .timeout(Duration::from_secs(120))
        .build()
        .map_err(|_| "无法创建网络连接")?;
    let mut request = client
        .request(method, url)
        .header("X-KeepDo-Client", "native-v1");
    if let Some(token) = credential(crate::vault::read).await? {
        request = request.bearer_auth(token);
    }
    if let Some(content_type) = &input.content_type {
        if !(content_type.starts_with("application/json")
            || content_type.starts_with("multipart/form-data;"))
        {
            return Err("不支持此内容类型".into());
        }
        request = request.header("Content-Type", content_type);
    }
    if let Some(body) = input.body {
        if body.len() > BODY_LIMIT.div_ceil(3) * 4 {
            return Err("请求内容过大".into());
        }
        let bytes = STANDARD.decode(body).map_err(|_| "请求编码不正确")?;
        if bytes.len() > BODY_LIMIT {
            return Err("请求内容过大".into());
        }
        request = request.body(bytes);
    }
    let mut response = request.send().await.map_err(|error| {
        if cfg!(debug_assertions) {
            format!("账号服务连接诊断：{:?}", error.without_url())
        } else {
            "网络连接失败，请检查网络后重试，未保存的内容仍保留在当前页面".to_owned()
        }
    })?;
    let status = response.status().as_u16();
    if (300..400).contains(&status) {
        return Err("服务地址发生重定向，请检查客户端 API 配置".into());
    }
    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|value| value.to_str().ok())
        .unwrap_or("application/octet-stream")
        .to_owned();
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await.map_err(|_| "服务响应中断，请重试")? {
        if bytes.len() + chunk.len() > BODY_LIMIT {
            return Err("服务响应过大".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    let auth = input.path.split('?').next().unwrap_or_default();
    if status < 300 && matches!(auth, "/api/auth/login" | "/api/auth/register") {
        let mut result: serde_json::Value =
            serde_json::from_slice(&bytes).map_err(|_| "登录响应格式不正确")?;
        let token = result
            .as_object_mut()
            .and_then(|object| object.remove("token"))
            .and_then(|token| token.as_str().map(str::to_owned))
            .filter(|token| {
                token.len() == 43
                    && token
                        .bytes()
                        .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'-')
            })
            .ok_or("服务端未提供原生会话，请更新 KeepDo 服务端")?;
        // 先安全存储再向界面返回登录成功；凭据始终不进入 WebView。
        let stored_token = token.clone();
        if let Err(error) = credential(move || crate::vault::save(&stored_token)).await {
            // 安全存储失败时撤销刚创建的会话，不留下无法使用的长期授权。
            if let Ok(logout) = api_url(
                env!("KEEPDO_API_ORIGIN"),
                "/api/auth/logout",
                cfg!(debug_assertions),
            ) {
                let _ = client
                    .post(logout)
                    .header("X-KeepDo-Client", "native-v1")
                    .bearer_auth(token)
                    .timeout(Duration::from_secs(10))
                    .send()
                    .await;
            }
            return Err(error);
        }
        bytes = serde_json::to_vec(&result).map_err(|_| "登录响应格式不正确")?;
    }
    if status == 401 || status < 300 && auth == "/api/auth/logout" {
        credential(crate::vault::clear).await?;
    }
    if status < 300 && auth == "/api/auth/session" {
        if let Ok(result) = serde_json::from_slice::<serde_json::Value>(&bytes) {
            if result.get("user").is_some_and(|user| user.is_null()) {
                credential(crate::vault::clear).await?;
            }
        }
    }
    Ok(ApiResponse {
        status,
        content_type,
        body: STANDARD.encode(bytes),
    })
}

#[tauri::command]
pub async fn api_request(
    input: ApiInput,
    network: State<'_, Network>,
) -> Result<ApiResponse, String> {
    if input.id.len() > 64 || input.id.is_empty() {
        return Err("请求标识不正确".into());
    }
    let id = input.id.clone();
    let cancel = Arc::new(Notify::new());
    {
        let mut pending = network.pending.lock().map_err(|_| "请求状态异常")?;
        if pending.contains_key(&id) {
            return Err("请求标识重复".into());
        }
        pending.insert(id.clone(), cancel.clone());
    }
    let result = tokio::select! {
        result = send(input) => result,
        _ = cancel.notified() => Err("请求已取消".into()),
    };
    network
        .pending
        .lock()
        .map_err(|_| "请求状态异常")?
        .remove(&id);
    result
}

#[tauri::command]
pub fn cancel_request(id: String, network: State<'_, Network>) -> Result<(), String> {
    if let Some(cancel) = network.pending.lock().map_err(|_| "请求状态异常")?.get(&id) {
        cancel.notify_one();
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::api_url;

    #[test]
    fn 请求只能到达固定来源的原生接口() {
        let origin = "https://keepdo.example";
        assert_eq!(
            api_url(origin, "/api/journal?type=goal", false)
                .unwrap()
                .as_str(),
            "https://keepdo.example/api/native/journal?type=goal"
        );
        for path in [
            "https://evil.test/api/data",
            "//evil.test/api/data",
            "/api/../../data",
            "/api/%2e%2e/%2e%2e/data",
            "/api/native/data",
            "/api/data#fragment",
            "/api/\\evil",
        ] {
            assert!(api_url(origin, path, false).is_err(), "{path}");
        }
        assert!(api_url("http://localhost:8787", "/api/data", true).is_ok());
        assert!(api_url("http://localhost:8787", "/api/data", false).is_err());
        assert!(api_url("http://evil.test", "/api/data", true).is_err());
        assert!(api_url("https://user:password@keepdo.example", "/api/data", false).is_err());
    }
}
