# Chrome 扩展连接修复

## 问题与目标

原打包脚本将 Vue 前端直接复制进扩展，账号初始化请求落到 `chrome-extension://…/api/auth/session`，无法访问 Workers，导致安装后停留在网络错误页。修复后，新标签页和侧栏应能展示线上 KeepDo 的登录页或已有账号工作区。

## 方案

- 扩展使用独立 HTML、JavaScript 和 Tailwind 外壳，通过 iframe 打开 `manifest.json` 的 `homepage_url`，沿用线上页面的同源 API 与 HttpOnly 会话。
- 仅声明 KeepDo 线上域名的 host 权限，使内嵌页面可使用其正常站点存储分区；CSP 仅允许该域名的框架和健康检查。移除未使用的 storage 权限，不添加 Cookie 读取、全站点或代码注入权限。
- 加载前检查公开健康接口，提供加载、超时、错误、重试和直接打开网页入口；重试取消旧请求，避免旧结果覆盖新连接。
- 独立 Vite 配置只构建扩展外壳，打包脚本统一通过 pnpm 调用，业务前端和 Worker 保持原状。

相比直接跨域请求 API，此方案无需放宽服务端同源校验或另建跨域认证。相比直接跳转网页，此方案保留扩展新标签页和侧栏中的工作区。

## 验证

1. 单元测试覆盖健康检查、失败恢复、超时与过期请求，以及图标打开和标签页复用。
2. 执行 `pnpm test`、`pnpm build`、`pnpm build:extension`，检查产物中的入口与 CSP。
3. 在已安装的 Chrome 中重新加载扩展，验证实际登录状态、新标签页、导航和侧栏；不修改用户账号数据。

## 验证结果

- `pnpm test`：84 项通过，其中 6 项为扩展回归测试。
- `pnpm build` 与 `pnpm build:extension`：通过，产物入口、样式、脚本与图标引用检查通过。
- Chrome 1.0.1：新标签页成功复用已有登录并加载日历；记录页读取历史记录；侧栏成功展示账号工作区与窄屏布局。
- 重新加载委托浏览器、保留子页面关闭保护的行为已有回归测试；未保存草稿的浏览器确认流程未完成实测。验证未保存任何测试事项到账号。

参考：[Chrome 扩展的存储与 Cookie 行为](https://developer.chrome.com/docs/extensions/develop/concepts/storage-and-cookies)。
