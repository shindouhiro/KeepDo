# 日记 Markdown 支持实施计划

**目标：** 目标和习惯日记支持 Markdown 编写、预览及保存后的统一渲染。

**架构：** 继续保存原始文字，复用现有保存、备份与版本校验流程，无需数据库迁移。使用关闭原始 HTML 的 markdown-it 解析内容；预览和时间线使用同一个展示组件。

**技术栈：** Vue 3、TypeScript、Tailwind CSS、markdown-it、pnpm Catalogs、Node.js 测试运行器。

## 组件边界

- `src/lib/journal-markdown.ts`：纯渲染函数，关闭原始 HTML、保留单行换行、生成唯一链接 ID，处理安全链接与表格滚动。
- `src/components/journal/JournalMarkdown.vue`：接收 `content` 和 `idPrefix`，计算渲染结果并提供深浅主题排版。
- `JournalEditor.vue`：保留原有表单，增加编辑与预览切换、Markdown 提示和空预览状态，切换不改变草稿。
- `JournalTimeline.vue`：使用共享展示组件，让目标、习惯和全部记录的展示保持一致。

## 实施步骤

1. 在 catalog 中添加 markdown-it 并安装依赖；为共享渲染逻辑添加常用语法、普通文字、代码转义、恶意 HTML/URL 和唯一链接 ID 测试。
2. 实现安全渲染函数和展示组件，覆盖标题、列表、引用、代码、表格、链接、图片及窄屏溢出。
3. 接入编辑器预览与时间线，保留字符限制、图片上传、草稿保护、保存失败重试和原文编辑。
4. 在 README 说明语法与操作方式，运行 `pnpm test`、`pnpm build:cloudflare`。
5. 浏览器实测编辑、预览、保存、重新编辑、各时间线、空内容及手机/深色主题。

## 验收标准

- 原文中的 Markdown 在预览和保存后排版一致，重新编辑可看到原文。
- 普通文字和换行仍可阅读；图片附件正常显示。
- HTML、事件属性和危险链接不能执行脚本，代码块保持纯文本。
- 表格和长代码在容器内滚动，手机页面不横向溢出。

## 验证结果

- `pnpm test`：57 项全部通过，包含 5 项新增 Markdown 语法与安全测试。
- `pnpm build:cloudflare`：前后端类型检查和生产构建通过。
- 本地同源构建浏览器验证：空预览、切换不丢草稿、保存成功、重新编辑保留原文、未修改禁用保存、目标与全部记录时间线渲染一致。
- 390 × 844 手机深色模式验证通过；长代码与八列表格在自身容器内滚动，预览容器宽度和滚动宽度均为 284px；控制台无警告和错误。
- 本地 Vite 的 `127.0.0.1:5173` 来源不在现有开发允许列表中，保存会被原有来源校验拦截；该失败路径保留了草稿。完整保存流程使用 `127.0.0.1:8787` 同源构建验证。
- 截图：`docs/screenshots/journal-markdown-desktop.png`、`docs/screenshots/journal-markdown-mobile-dark.png`。

## 代码语法高亮修复

- 原因：代码围栏只有语言类名与背景样式，未执行语法高亮。
- 在共用渲染器中接入 highlight.js，按需注册九种常用语法及 JSX、TSX、Vue 等别名；未指定语言时自动识别，未知语言与纯文本交回 Markdown 解析器安全转义。
- `JournalMarkdown.vue` 统一提供关键字、函数、字符串、数字、注释及标签的深浅主题配色，编辑器预览和各时间线共用。
- `pnpm test`：60 项通过，新增语言别名、代码原文保留、自动识别、纯文本回退和高亮输出安全验证。
- `pnpm build:cloudflare`：前后端类型检查与生产构建通过。
- 使用临时本地验证页挂载实际编辑器与时间线组件，检查编辑/预览切换、两处代码内容与颜色、手机深色主题及长代码滚动；控制台无错误与警告。未重复验证后端保存流程。
- 手机视口下页面无横向溢出，长代码仅在代码块内部滚动；截图为 `docs/screenshots/journal-highlight-desktop.png` 与 `docs/screenshots/journal-highlight-mobile-dark.png`。
