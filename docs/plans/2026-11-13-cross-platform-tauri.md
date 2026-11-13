# KeepDo 跨平台实施计划

**目标**：复用 Vue 界面，提供 Web、Windows、macOS、Linux、Android、iOS 构建。

**架构**：Web 保持同源 Cookie；原生容器内置静态资源，通过 Rust 请求桥连接同一 Workers 服务。原生会话与 Web 会话隔离，平台适配层统一图片、文件、剪贴板与外部链接。

**技术栈**：Vue 3、TypeScript、pnpm Catalogs、Tauri 2 稳定版、Rust、Cloudflare Workers/D1。

## 实施步骤

1. 在 `server/migrations/0008_native_sessions.sql` 增加原生会话；修改 `server/auth.ts`、`server/index.ts`，提供 `/api/native/*` 镜像路由；保留 Web 同源保护及账号隔离。
2. 新增 `src-tauri/` 工程、最小权限配置与 Rust 请求桥，固定可访问的 API 来源、禁止重定向及任意请求头，原生会话凭据不暴露给界面。
3. 新增 `src/lib/platform/`，将 JSON、multipart、二进制图片、备份与文件保存统一接入；实现 `JournalImage.vue`，组件仅负责资源加载与释放。既有时间线、编辑器、图片预览及导出组件复用它，props 为 src/alt，业务事件保持不变。
4. 增加原生构建模式、安全区域、外部链接与剪贴板适配。保留现有 Web 与扩展构建。
5. 配置桌面构建矩阵与 Android/iOS 构建工作流，明确测试产物、签名及分发条件。
6. 运行会话边界与跨端请求测试、完整单元测试、API 集成测试、Web/原生前端构建、Rust 检查，以及本机可用的原生构建与界面检查。

## 关键决策

- 采用 Tauri 2 稳定版；Tauri 3 Alpha 暂不作为发布基础。
- 首版联网使用；完整离线数据库、冲突自动合并不纳入此次打包。
- 原生会话使用独立令牌与表；不放宽 Web CORS/CSRF，不接受 Cookie 作为原生认证。
- 先保留既有目录；平台适配以独立模块组织，避免同时迁移业务代码。
- 安装器签名与商店发布依赖相应凭据；缺失时只能交付明确标识的测试产物，不能声称已发布。

## 实施记录

- 已加入原生会话隔离、固定来源请求桥、系统凭据存储、文件与图片适配及多平台 CI。
- 桌面实际测试发现 WebKit 对临时图片二次嵌入的差异，原生鉴权照片改为经过格式/大小检查的数据地址，长图导出与系统保存实测成功。
- 增加正常退出与 Android 返回键保护；系统最低版本按项目现有 Web API 设置为 macOS 14.4、iOS 17.4。
- CI 产物定位为测试包，签名、商店发布与桌面自动更新另行配置。Android/iOS 生成工程保持可重新生成。

## 验证结果（2026-11-13）

- 89 项单元测试、22 项 Web/原生 API 集成测试通过。
- Vue/Worker 类型检查、Web 与原生前端构建、Cloudflare 部署 dry-run 通过。
- Rust 单元测试与 Clippy（警告视为错误）通过。
- macOS arm64 成功生成 app/DMG；本机实测登录、重启恢复、图文读取、完整长图生成、系统文件保存、菜单退出保护和退出清理会话。
- iOS arm64 模拟器归档成功；校验应用标识为 dev.keepdo.client、最低系统版本 17.4。未进行真机签名或商店发布。
- Web 的 390px 视口无横向溢出，图文与长图导出回归通过。
- Windows、Linux、Android 构建流程已配置，尚未在相应环境实际执行；本机缺少完整 Android SDK/JDK/NDK。
- 已按项目完整部署流程发布线上 Workers，并应用原生会话迁移，正式安装包可连接新接口。

## Cloudflare 发布记录（2026-11-13）

- 部署命令：`pnpm run deploy`，依次完成生产构建、远程 D1 迁移与 Worker 发布。
- 线上地址：https://keepdo.shindouhiro.workers.dev
- Worker 版本：`27466a3e-403c-4649-9d1d-0a4d87a30f84`。
- 远程迁移：`0008_native_sessions.sql` 成功，仅新增原生会话表与索引。
- 验收：健康检查、Web/原生会话查询、未登录访问限制、浏览器来源保护、当前构建的 JS/CSS 与 SPA 深路径均通过。
- 浏览器只读验收确认现有账号页面正常加载，账号保存状态和日历均正常显示。
