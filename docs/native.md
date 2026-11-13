# KeepDo 原生客户端

KeepDo 使用同一套 Vue 业务界面构建 Web、Windows、macOS、Linux、Android 和 iOS。原生包内置界面，通过 Rust 请求桥连接 Cloudflare Workers/D1。首版需要联网，不包含完整离线编辑和自动冲突合并。

## 服务端先决条件

安装版需要服务端包含 `0008_native_sessions.sql` 及 `/api/native/*` 路由。先在部署环境运行项目原有的完整部署命令：

```sh
pnpm run deploy
```

此命令会构建、迁移线上数据库并发布；只在准备正式更新服务时执行。请保留 `run`，避免执行 pnpm 自带的工作区部署命令。单独构建安装包不会升级云端服务。

## 本地开发

使用 Node.js 24、pnpm 10、Rust stable（至少 1.90，建议使用当前稳定版）。确保 `cargo`、`rustc` 和 `rustup` 来自同一套 Rust 工具链。首次运行安装平台依赖，见 [Tauri 环境要求](https://v2.tauri.app/start/prerequisites/)。

```sh
pnpm install --frozen-lockfile
pnpm db:migrate:local
pnpm dev:api
```

另一个终端运行桌面版：

```sh
KEEPDO_API_ORIGIN=http://localhost:8787 pnpm dev:native
```

默认连接 `https://keepdo.shindouhiro.workers.dev`。`KEEPDO_API_ORIGIN` 在 Rust 编译时固定，不能通过页面输入改写；发布包只接受 HTTPS 来源，HTTP 仅允许调试构建连接 localhost/127.0.0.1。更换来源需重新编译。不同来源的系统凭据独立保存，禁止将开发服务器地址用于正式分发。

## 打包

| 平台 | 命令 | 产物与要求 |
|---|---|---|
| Web | `pnpm build:cloudflare` | `dist/`，现有 Workers 发布流程 |
| Windows | `pnpm build:desktop --bundles nsis` | `.exe`，Windows MSVC + WebView2 |
| macOS | `pnpm build:desktop --bundles app,dmg` | `.app`、`.dmg`，macOS + Xcode |
| Linux | `pnpm build:desktop --bundles appimage,deb` | `.AppImage`、`.deb`，WebKitGTK 4.1 + Secret Service |
| Android | `pnpm build:android --debug --target aarch64 --apk` | 调试签名 APK，可直接安装测试 |
| iOS 模拟器 | `pnpm build:ios --debug --target aarch64-sim --no-sign --archive-only --ci` | 模拟器 `.xcarchive`，不适用于真机 |
| iOS 真机 | `pnpm build:ios --export-method release-testing --ci` | 需要 Apple 团队、证书、描述文件及 Xcode 签名配置 |

桌面产物位于 `src-tauri/target/release/bundle/`；显式传入 Rust target 时位于 `src-tauri/target/<target>/release/bundle/`。

macOS 可分别安装 `aarch64-apple-darwin`、`x86_64-apple-darwin` Rust target，并用 `--target` 分别构建；也可安装两者后构建 `universal-apple-darwin`。Linux 首版发布 x64，不承诺覆盖所有发行版和旧版系统。

### Android 初始化与签名

安装 JDK 17、Android SDK/NDK，配置 `JAVA_HOME`、`ANDROID_HOME`、`NDK_HOME` 后：

```sh
pnpm tauri android init --ci
pnpm build:android --debug --target aarch64 --apk --ci
```

生成工程位于 `src-tauri/gen/android/`，不提交本机路径和生成文件。SDK/NDK 版本与 CI 保持一致。首次生成或重新生成工程后，发布构建需重新配置签名：

1. 在本机或 CI 密钥管理中设置 `KEEPDO_ANDROID_KEYSTORE`（绝对路径）、`KEEPDO_ANDROID_KEY_ALIAS`、`KEEPDO_ANDROID_STORE_PASSWORD`、`KEEPDO_ANDROID_KEY_PASSWORD`。
2. 执行 `pnpm android:signing`，只把环境变量引用写入 Gradle。
3. 执行 `pnpm build:android --target aarch64 --apk --aab --ci`。

签名密钥、密码、`.jks`、`.keystore` 均不得提交。妥善备份密钥，应用后续升级必须使用相同的签名。

### iOS 初始化与签名

只能在 macOS + 完整 Xcode 上运行：

```sh
pnpm tauri ios init --ci
pnpm build:ios --debug --target aarch64-sim --no-sign --archive-only --ci
```

首次初始化可能安装 XcodeGen、CocoaPods、libimobiledevice 等工具。模拟器构建无需开发者团队；真机与商店分发需设置 `APPLE_DEVELOPMENT_TEAM`，并在 Xcode 中配置团队签名。照片与相机用途说明由 `src-tauri/Info.ios.plist` 合并。

生成工程位于 `src-tauri/gen/apple/`，原始配置保留在 `src-tauri/`。修改应用标识或最低系统版本后，先备份并移走已有生成目录，再重新初始化；CLI 会保留已有工程，直接再次 init 不会可靠更新旧配置。

## 平台适配

- **会话**：Web 保持 HttpOnly Cookie 与同源保护。原生使用独立表中的 30 天会话，数据库只存摘要；不接受 Web Cookie 或 Web 会话令牌替代。
- **凭据**：Rust 直接访问 macOS Keychain、iOS Keychain、Windows Credential Manager、Android Keystore 及 Linux Secret Service。令牌不会返回 WebView，不使用 localStorage 保存。Linux 需有可用且已解锁的 GNOME Keyring/KWallet 等服务；不可用时显示错误。
- **网络**：界面只能向固定服务器的 `/api/native/*` 发请求；Rust 禁止跟随重定向，不提供任意 URL 或任意请求头入口。原生接口拒绝浏览器 Origin/Sec-Fetch 请求，不开放 CORS。
- **图片**：列表、预览、编辑器、长图及备份均通过鉴权通道读取。原生图片以临时数据地址展示，便于 WebKit 将其嵌入导出 SVG，不持久保存。
- **文件**：备份与 PNG/SVG 使用系统保存对话框，只写用户选择的路径；取消保存显示取消状态。
- **剪贴板**：桌面支持 PNG 复制。官方插件暂不支持 Android/iOS 图片复制，手机版明确提示保存 PNG 后分享。
- **交互**：沿用原生 HTML dialog、草稿保护与危险操作确认，适配安全区域和软键盘。外部 HTTPS 链接交给系统浏览器。

## CI 与发布边界

`.github/workflows/native.yml` 会先运行单元测试、Web 构建和真实本地 D1 的 Web/原生 API 集成测试，然后构建：

- Windows x64 NSIS 安装包；
- Linux x64 AppImage/deb；
- macOS Apple Silicon 与 Intel 包；
- Android arm64 调试 APK；
- iOS arm64 模拟器归档。

产物上传到该次 GitHub Actions 的 Artifacts。默认产物用于测试，工作流不会部署 Workers、发布商店或创建公开 Release。Windows/macOS 的正式发行签名、macOS 公证、Android 发布签名和 iOS 真机分发依赖各自凭据。当前版本通过重新安装新版升级，尚未启用桌面自动更新。

## 验证

```sh
pnpm test
pnpm build:cloudflare
pnpm build:native:web
pnpm check:native
pnpm test:native
pnpm lint:native
pnpm test:api
```

API 测试默认连接本地 8787，可设置 `KEEPDO_TEST_ORIGIN` 切换到另一个本地端口。不要对生产账号执行集成测试。

### 系统版本与退出保护

原生界面使用现有项目的现代 Web API（包括 `AbortSignal.any`），最低版本设为 macOS 14.4、iOS 17.4；Android 要求 API 24+ 并保持系统 WebView 更新。Windows 使用系统 WebView2，Linux 使用较新的 WebKitGTK 4.1，需在目标发行版验证。

桌面关闭窗口、菜单退出与 Android 返回键统一经过退出保护：打开抽屉时先请求关闭当前抽屉，保留已有草稿确认；恢复备份期间阻止退出；有未同步修改时先保存，失败则保留窗口并提示重试或导出。操作系统强制终止进程不属于可拦截的正常退出流程。
