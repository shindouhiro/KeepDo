# GitHub 备份实现计划

**目标：** 在设置中连接私有 GitHub 仓库，手动上传完整备份、分页查看历史版本并确认恢复。

**架构：** 新增独立 GitHub 备份面板与组合式函数；Worker 通过固定 GitHub API 代理请求，D1 按账号保存 AES-GCM 加密的令牌。沿用完整备份格式与现有乐观锁恢复流程，GitHub 使用固定文件的提交历史保存版本。

**技术栈：** Vue 3、TypeScript、Tailwind CSS、Zod、Workers Web Crypto、D1、GitHub REST API。

## 方案与边界

- 采用按账号加密保存细粒度令牌；相比每次输入更便于使用，相比 GitHub App/OAuth 集成无需新增应用注册流程。
- 仅允许私有且未归档的仓库，每次读取与写入前重新核对私有状态。
- 每个账号写入独立的 `keepdo/<账号 ID>/backup.json`，路径由服务端生成。
- GitHub 单次备份上限 8 MB，限制 Worker 的编码与校验内存开销；大文件继续使用现有本地备份。
- 部署者设置 `GITHUB_BACKUP_SECRET`（至少 32 字符），没有配置时显示启用说明；令牌不返回客户端、不进入本地存储、业务备份或日志。
- 初版不包含定时任务、自动合并、仓库创建或线上部署。

## 组件边界

- `SettingsModal.vue`：设置布局、共享操作互斥、恢复回调。
- `github/GitHubBackupPanel.vue`：连接表单、状态、历史列表；接收 disabled 与恢复回调，向外报告 busy。
- `useGitHubBackup.ts`：连接、分页、上传、读取和恢复状态；保留失败的连接输入，提交结束后清除令牌。
- `useDataBackup.ts`：复用文件恢复与 GitHub 恢复的确认、版本校验和日记刷新。
- `shared/github-backup.ts`：输入、响应校验和限制。
- `server/github-backup.ts`：凭据加密、账号隔离、GitHub 固定路径访问、错误转换与请求限制。

## 执行步骤

1. 新增共享校验、加密工具及数据库迁移，测试非法仓库输入、密文篡改与跨账号解密。
2. 新增 Worker API，测试公开仓库拦截、令牌脱敏、并发写入冲突、分页和损坏备份拦截。
3. 接入设置面板与共用恢复流程，涵盖加载、未配置、空历史、失败和忙碌状态。
4. 更新 README 与 AGENTS API 表，说明令牌权限、服务端密钥配置及文件上限。
5. 运行 pnpm test、pnpm build:cloudflare、本地迁移、API 集成测试与浏览器桌面/手机验证；在用户授权后使用独立私有仓库和合成数据验证真实 GitHub 写入与恢复。

## 验证结果

- 51 项单元测试通过，覆盖密文随机性、跨账号解密拒绝、重定向拒绝、私有仓库校验、固定账号路径、版本冲突、历史分页与损坏备份。
- 本地 API 集成测试 15 项通过；分别验证了配置密钥与未配置密钥的环境。
- 本地 D1 迁移、前后端类型检查、生产构建、Wrangler 部署 dry-run 通过。
- 浏览器验证 390px 手机布局与 1280px 桌面布局、非法输入禁用、请求期间操作互斥、令牌清空和真实 GitHub 无效令牌错误反馈。
- 浏览器实测发现 Workers 不支持 redirect: error，已改为 manual 并保留 3xx 拒绝策略，相关测试通过。
- 2026-11-03 经用户授权，使用已登录 GitHub 账号 `shindouhiro` 完成真实联调，私有测试仓库为 https://github.com/shindouhiro/keepdo-backup-test ，分支为 `main`。
- 真实流程通过 9 项检查：私有仓库连接且响应无令牌、空仓库历史、首次上传、第二版更新、历史顺序、两版完整内容读取、旧版恢复、过期恢复拒绝、断开后授权移除。
- 测试数据包含合成目标、习惯、待办、中文日记与 PNG 图片；从 GitHub 读取的两版 JSON 与上传内容完全一致，恢复后基础数据、日记内容与图片原始字节均校验通过。
- 第一版提交：`c82c77bd4940912c787a1552f27ef5192e8b2afa`；第二版提交：`7cfaa1ef520a7b71265d55a442f1135fd0560e9f`。远端仅保留合成测试数据，本地测试连接已删除并退出会话。
- 本次重新运行 `pnpm test`（51 项）和 `KEEPDO_TEST_ORIGIN=http://localhost:8788 pnpm test:api`（15 项），全部通过。使用现有 GitHub CLI 授权验证了真实请求，未额外创建细粒度令牌；未进行线上部署。
