# KeepDo 项目文档与编码规范

> **给 AI Agent 的开发指南**  
> 本文档提供 KeepDo 项目的架构、技术栈、代码规范和开发流程说明，帮助 AI Agent 理解项目上下文并生成符合项目标准的代码。

---

## 目录

- [项目概述](#项目概述)
- [技术架构](#技术架构)
- [项目结构](#项目结构)
- [编码规范](#编码规范)
- [开发流程](#开发流程)
- [API 设计原则](#api-设计原则)
- [数据模型](#数据模型)
- [部署与测试](#部署与测试)

---

## 项目概述

**KeepDo** 是一款个人管理工具，将长期目标、日常习惯和待办行动集成在一起。用户可以设立目标、安排计划、打卡记录，并通过日记功能沉淀过程。

### 核心功能模块

1. **长期目标管理**：支持天数、数值、里程碑三种目标类型
2. **计划日历**：周/月视图，展示目标、习惯、待办
3. **习惯与待办**：打卡、优先级、关联目标
4. **目标与习惯日记**：图文记录，成长时间线
5. **记录时间线**：集中查看所有日记
6. **统计复盘**：行动热力图、习惯连击、目标进度
7. **账号系统**：注册登录、数据同步、完整备份

---

## 技术架构

### 前端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| **Vue 3** | ^3.5.44 | 框架，使用 Composition API 与 `<script setup>` |
| **TypeScript** | ~6.0.3 | 类型系统，严格模式 |
| **Vite** | ^8.3.4 | 构建工具与开发服务器 |
| **Pinia** | ^4.1.0 | 状态管理 |
| **Tailwind CSS** | ^4.3.3 | 样式系统，支持深浅主题 |
| **Lucide Icons** | ^1.61.0 | 图标库 |
| **Zod** | catalog: | 数据校验 |
| **Canvas Confetti** | ^1.9.4 | 庆祝动效 |

### 后端技术栈

| 技术 | 用途 |
|------|------|
| **Cloudflare Workers** | Serverless 运行环境 |
| **Cloudflare D1** | SQLite 数据库 |
| **Node.js crypto** | 密码哈希与会话令牌 |
| **Wrangler** | Cloudflare CLI 工具 |

### 工程配置

- **包管理器**：pnpm（使用 workspace 和 Catalogs）
- **TypeScript 配置**：
  - `tsconfig.app.json`：前端配置，extends `@vue/tsconfig/tsconfig.dom.json`
  - `tsconfig.worker.json`：后端配置，target ES2023
  - `tsconfig.node.json`：构建工具配置
- **Vite 配置**：
  - Cloudflare 模式使用根路径 `/`
  - 默认模式使用相对路径 `./`（兼容 GitHub Pages）
  - API 代理：`/api` → `http://localhost:8787`

---

## 项目结构

```text
KeepDo/
├── src/                          # 前端源码
│   ├── components/              # Vue 组件
│   │   ├── auth/               # 认证相关组件
│   │   ├── journal/            # 日记相关组件
│   │   ├── TodayView.vue       # 今日专注主页
│   │   ├── GoalsView.vue       # 长期目标页
│   │   ├── RecordsView.vue     # 记录时间线
│   │   ├── StatsView.vue       # 统计复盘
│   │   ├── CalendarPlanner.vue # 日历主组件
│   │   ├── DailyMomentum.vue   # 行动成就
│   │   └── ...
│   ├── composables/             # 可复用逻辑
│   │   ├── useJournal.ts       # 日记编辑与加载
│   │   ├── useJournalFeed.ts   # 记录时间线分页
│   │   ├── useJournalDeletion.ts # 日记删除确认
│   │   ├── useNativeDialog.ts  # 原生 dialog 管理
│   │   ├── useQuickAdd.ts      # 快捷添加快捷键
│   │   └── useDataBackup.ts    # 备份与恢复
│   ├── stores/                  # Pinia 状态管理
│   │   ├── auth.ts             # 账号状态
│   │   ├── keepdo.ts           # 核心业务数据
│   │   └── journal.ts          # 日记日期标记
│   ├── lib/                     # 工具库
│   │   ├── api.ts              # API 请求封装
│   │   ├── backup.ts           # 完整备份导出
│   │   └── journal-images.ts   # 图片压缩
│   ├── utils/                   # 通用工具函数
│   ├── types/                   # TypeScript 类型定义
│   ├── App.vue                 # 根组件
│   ├── main.ts                 # 应用入口
│   └── style.css               # 全局样式
│
├── server/                      # 后端 Worker 代码
│   ├── migrations/             # D1 数据库迁移
│   ├── index.ts                # Worker 入口
│   ├── auth.ts                 # 认证与会话
│   ├── password.ts             # 密码哈希
│   ├── journal.ts              # 日记 API
│   ├── backup.ts               # 备份 API
│   ├── http.ts                 # HTTP 工具（错误、响应、限流）
│   └── types.ts                # 后端类型定义
│
├── shared/                      # 前后端共享代码
│   ├── schema.ts               # Zod 数据校验模型
│   ├── journal.ts              # 日记类型与校验
│   ├── backup.ts               # 备份格式定义
│   ├── calendar.ts             # 日历与进度计算
│   ├── momentum.ts             # 行动徽章计算
│   ├── goal-checkins.ts        # 目标打卡逻辑
│   └── quick-add.ts            # 快捷键判断
│
├── tests/                       # 测试文件
│   ├── *.test.ts               # 单元测试
│   └── api.integration.ts      # API 集成测试
│
├── docs/                        # 文档与截图
│   ├── plans/                  # 设计文档
│   └── screenshots/            # 产品截图
│
├── public/                      # 静态资源
├── dist/                        # 构建输出
├── .wrangler/                   # Wrangler 本地状态
├── package.json                # 项目依赖与脚本
├── pnpm-workspace.yaml         # pnpm workspace 配置
├── wrangler.jsonc              # Cloudflare Workers 配置
├── vite.config.ts              # Vite 配置
├── tsconfig.json               # TypeScript 根配置
├── tsconfig.app.json           # 前端 TS 配置
├── tsconfig.worker.json        # 后端 TS 配置
├── tsconfig.node.json          # 构建工具 TS 配置
└── README.md                   # 项目说明
```

### 目录说明

- **`src/components/`**：所有 Vue 组件，单文件组件格式（`.vue`）
- **`src/composables/`**：可复用的组合式函数，以 `use` 开头
- **`src/stores/`**：Pinia store，使用 Composition API 风格
- **`shared/`**：前后端共享的类型、校验和业务逻辑
- **`server/`**：Cloudflare Worker 后端代码
- **`tests/`**：使用 Node.js 原生测试运行器

---

## 编码规范

### TypeScript 规范

#### 严格模式配置

所有 TypeScript 配置均启用严格模式：

```json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

#### 类型定义原则

1. **优先使用类型推断**，避免冗余类型标注
2. **接口 vs 类型别名**：优先使用 `type`，接口仅用于 D1 查询结果行
3. **禁止 `any`**：使用 `unknown` 替代需要动态类型检查的场景
4. **导入类型**：使用 `import type` 导入纯类型

```typescript
// ✅ 推荐
import type { Goal, Habit, Todo } from '../types'
import { computed } from 'vue'

// ❌ 避免
import { Goal, Habit, Todo } from '../types' // 可能导致运行时导入
```

#### 文件扩展名

- **后端与 shared 代码**：使用显式 `.ts` 扩展名（Worker 环境要求）
- **前端代码**：省略扩展名（Vite 自动解析）

```typescript
// server/ 和 shared/ 中
import { HttpError } from './http.ts'

// src/ 中
import { useKeepDoStore } from '../stores/keepdo'
```

### Vue 组件规范

#### 组件结构

统一使用 `<script setup>` + TypeScript：

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Goal, Habit } from '../types'
import { useKeepDoStore } from '../stores/keepdo'

// Props
const props = defineProps<{
  date: string
  todos: Todo[]
}>()

// Emits
const emit = defineEmits<{
  save: [value: string]
  close: []
}>()

// Composables
const store = useKeepDoStore()

// Local state
const isOpen = ref(false)

// Computed
const filteredItems = computed(() => {
  // ...
})

// Methods
function handleSave() {
  emit('save', 'value')
}
</script>

<template>
  <!-- ... -->
</template>
```

#### 组件命名

- **文件名**：PascalCase，如 `DailyMomentum.vue`
- **组件注册**：无需手动注册，Vite 自动解析
- **Props 命名**：使用 camelCase，模板中自动转换为 kebab-case

#### 无障碍规范

所有组件遵循 WCAG 标准：

1. **语义化 HTML**：使用 `<button>`, `<nav>`, `<section>` 等
2. **ARIA 标签**：`aria-label`, `aria-live`, `aria-atomic`
3. **键盘导航**：支持 Tab、Enter、Escape 等快捷键
4. **颜色独立**：不依赖颜色传达状态，使用文字、图标、进度环组合
5. **动画尊重**：检查系统 `prefers-reduced-motion` 设置

```vue
<template>
  <section aria-label="行动成就" class="...">
    <div aria-live="polite" aria-atomic="true">
      <h2>{{ message }}</h2>
    </div>
  </section>
</template>
```

### Tailwind CSS 规范

#### 主题系统

- 使用 `dark:` 前缀实现深浅主题
- 颜色语义化：`emerald` 表示成功/完成，`amber` 表示徽章/警告，`slate` 表示中性
- 响应式：`md:`, `lg:` 等断点

```vue
<template>
  <div class="rounded-2xl border border-emerald-200/70 bg-gradient-to-r from-emerald-50/80 to-white p-4 dark:border-emerald-900/40 dark:from-emerald-950/30 dark:to-slate-900">
    <!-- 内容 -->
  </div>
</template>
```

#### 布局原则

1. **响应式布局**：
   - 桌面宽屏（≥1280px）：三栏布局，最大 1440px
   - 平板与手机：单栏纵向布局
2. **间距系统**：使用 Tailwind 标准间距（`p-4`, `gap-2` 等）
3. **圆角与阴影**：统一使用 `rounded-2xl`, `rounded-lg` 等

### API 与数据校验

#### Zod 校验

所有前后端数据交互均使用 Zod 校验：

```typescript
// shared/schema.ts
import { z } from 'zod'

export const appDataSchema = z.object({
  goals: z.array(goalSchema).max(5000),
  habits: z.array(habitSchema).max(5000),
  todos: z.array(todoSchema).max(20_000),
  categories: z.array(text).min(1).max(100),
})

// server/index.ts
const parsed = saveDataSchema.safeParse(await readBody(request))
if (!parsed.success) throw new HttpError(400, '数据格式不正确')
```

#### 错误处理

- **后端**：使用 `HttpError` 类抛出带状态码的错误
- **前端**：API 请求失败时显示友好提示，保留草稿供重试

```typescript
// server/http.ts
export class HttpError {
  constructor(public status: number, message: string) { super(message) }
}

// server/index.ts
try {
  // ...
} catch (error) {
  if (error instanceof HttpError) return json({ error: error.message }, error.status)
  return json({ error: '服务暂时不可用，请稍后重试' }, 500)
}
```

### 安全规范

#### 认证与会话

- **密码哈希**：使用 Node.js 原生 `scrypt`，32 MiB 内存 + 3 轮并行
- **会话令牌**：随机 32 字节，SHA-256 哈希后存储
- **Cookie 安全**：HttpOnly, Secure, SameSite=Lax, Max-Age=30 天

```typescript
// server/password.ts
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, { N: 32768, r: 8, p: 3 }, (err, key) => {
      if (err) return reject(err)
      resolve(key)
    })
  })
}
```

#### 同源保护

非 GET/HEAD 请求必须验证 `Origin` 或 `Referer` 头：

```typescript
// server/http.ts
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get('origin') || request.headers.get('referer')
  if (!origin) throw new HttpError(403, '缺少来源头')
  const url = new URL(request.url)
  const originUrl = new URL(origin)
  if (originUrl.origin !== url.origin) throw new HttpError(403, '跨域请求被拒绝')
}
```

#### 请求体限制

- **普通 JSON**：最大 1 MB
- **图片上传**：最大 400 KB
- **完整备份**：最大 90 MB

```typescript
// server/http.ts
async function readLimitedBytes(request: Request, limit: number): Promise<Uint8Array> {
  const reader = request.body!.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > limit) throw new HttpError(413, '请求体过大')
    chunks.push(value)
  }
  // ...
}
```

---

## 开发流程

### 本地开发

```bash
# 安装依赖
pnpm install

# 一键启动（自动迁移数据库、构建、等待 API 就绪后启动前端）
pnpm dev

# 按需单独启动
pnpm dev:web   # 前端：http://localhost:5173
pnpm dev:api   # 后端：http://localhost:8787

# 构建
pnpm build              # 相对路径，兼容 GitHub Pages
pnpm build:cloudflare   # 根路径，Cloudflare 部署

# 类型检查
vue-tsc -b
tsc -p tsconfig.worker.json
```

### 测试

```bash
# 单元测试（密码、令牌、校验）
pnpm test

# API 集成测试（需先启动 pnpm dev:api）
pnpm test:api
```

### 数据库迁移

```bash
# 本地迁移
pnpm db:migrate:local

# 线上迁移
pnpm db:migrate:remote
```

迁移文件位于 `server/migrations/`，采用递增编号命名。

### 部署

```bash
# 首次授权
pnpm cf:login

# 检查配置（不上传）
pnpm deploy:check

# 完整部署（构建 + 迁移 + 发布）
pnpm deploy
```

**注意**：`pnpm deploy` 会自动执行数据库迁移，请勿单独运行 `wrangler deploy`。

---

## API 设计原则

### 路由规范

所有 API 路由以 `/api/` 开头：

| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/auth/register` | POST | 注册 |
| `/api/auth/login` | POST | 登录 |
| `/api/auth/logout` | POST | 退出 |
| `/api/auth/me` | GET | 获取当前用户 |
| `/api/data` | GET | 获取账号数据 |
| `/api/data` | PUT | 保存账号数据 |
| `/api/journal/:type/:id/entries` | GET | 获取日记列表 |
| `/api/journal/:type/:id/entries/:entryId` | PUT | 保存日记 |
| `/api/journal/:type/:id/entries/:entryId` | DELETE | 删除日记 |
| `/api/journal/entries` | GET | 记录时间线（分页） |
| `/api/backup` | GET | 导出完整备份 |
| `/api/backup` | POST | 导入完整备份 |

### 响应格式

成功响应（200/201）：

```json
{
  "data": { ... },
  "version": 123
}
```

错误响应（4xx/5xx）：

```json
{
  "error": "错误信息"
}
```

### 版本控制

使用乐观锁避免数据冲突：

1. 客户端读取数据时获得 `version`
2. 更新时携带 `version`
3. 服务端检查版本是否匹配，不匹配返回 409
4. 更新成功返回新 `version`

```typescript
// server/index.ts
const updated = await env.DB.prepare(
  'UPDATE user_data SET data = ?, version = version + 1 WHERE user_id = ? AND version = ?'
).bind(JSON.stringify(data), user.id, version).first()

if (!updated) throw new HttpError(409, '其他设备已更新数据')
```

---

## 数据模型

### 核心类型定义

```typescript
// src/types/index.ts

export type Goal = {
  id: string
  title: string
  description?: string
  category: string
  type: 'days' | 'number' | 'milestones'
  targetValue: number
  currentValue: number
  unit: string
  deadline?: string // ISO 8601 date
  milestones: Milestone[]
  checkIns?: Record<string, boolean> // { '2026-10-30': true }
  color: ColorName
  createdAt: string
}

export type Habit = {
  id: string
  title: string
  description?: string
  goalId?: string
  targetPerDay: number
  unit: string
  records: Record<string, number> // { '2026-10-30': 1 }
  color: ColorName
  createdAt: string
}

export type Todo = {
  id: string
  title: string
  goalId?: string
  date: string
  completed: boolean
  priority: 'low' | 'medium' | 'high'
  createdAt: string
}

export type Milestone = {
  id: string
  title: string
  completed: boolean
}

export type ColorName = 'indigo' | 'violet' | 'blue' | 'sky' | 'cyan' | 'teal' | 'emerald' | 'green' | 'lime' | 'yellow' | 'amber' | 'orange' | 'red' | 'rose' | 'pink' | 'slate'

export type AppData = {
  goals: Goal[]
  habits: Habit[]
  todos: Todo[]
  categories: string[]
}
```

### 日记类型

```typescript
// shared/journal.ts

export type JournalSubjectType = 'goal' | 'habit'

export type JournalEntry = {
  id: string
  subjectType: JournalSubjectType
  subjectId: string
  date: string
  text?: string
  images: JournalImage[]
  createdAt: number
  updatedAt: number
}

export type JournalImage = {
  id: string
  type: 'image/jpeg' | 'image/png' | 'image/webp'
}

export type JournalFilter = {
  subjectType?: JournalSubjectType
  limit?: number
  before?: number // timestamp
}
```

### 数据库表结构

```sql
-- 用户表
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- 会话表
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- 用户数据表
CREATE TABLE user_data (
  user_id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- 日记表
CREATE TABLE journal_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  entry_date TEXT NOT NULL,
  entry_text TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- 日记图片表
CREATE TABLE journal_images (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL,
  image_type TEXT NOT NULL,
  image_data BLOB NOT NULL,
  FOREIGN KEY (entry_id) REFERENCES journal_entries (id) ON DELETE CASCADE
);

-- 频控表
CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  expires_at INTEGER NOT NULL
);
```

---

## 部署与测试

### 环境配置

#### Cloudflare Workers

```jsonc
// wrangler.jsonc
{
  "name": "keepdo",
  "main": "server/index.ts",
  "compatibility_date": "2026-10-26",
  "workers_dev": true,
  "assets": {
    "binding": "ASSETS",
    "directory": "./dist",
    "run_worker_first": ["/api/*"],
    "not_found_handling": "single-page-application"
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "keepdo-db",
      "database_id": "你的数据库 ID",
      "migrations_dir": "server/migrations"
    }
  ]
}
```

#### 环境变量

- `CLOUDFLARE_ACCOUNT_ID`：Cloudflare 账户 ID（部署时可选）
- 本地开发不需要额外配置

### 测试策略

#### 单元测试

位于 `tests/` 目录，使用 Node.js 原生测试运行器：

```typescript
import { test } from 'node:test'
import assert from 'node:assert'

test('密码哈希验证', async () => {
  const password = 'MySecurePassword123!'
  const hash = await hashPassword(password)
  assert.ok(await verifyPassword(password, hash))
  assert.ok(!(await verifyPassword('wrong', hash)))
})
```

#### API 集成测试

测试真实 API 端点（需先启动 `pnpm dev:api`）：

```typescript
import { test } from 'node:test'
import assert from 'node:assert'

test('健康检查', async () => {
  const response = await fetch('http://localhost:8787/api/health')
  assert.strictEqual(response.status, 200)
  const body = await response.json()
  assert.deepStrictEqual(body, { status: 'ok' })
})
```

#### 前端验证

- **类型检查**：`vue-tsc -b`
- **构建验证**：`pnpm build:cloudflare`
- **配置检查**：`pnpm deploy:check`

### CI/CD

GitHub Actions 工作流（`.github/workflows/deploy.yml`）：

1. 检出代码
2. 安装依赖
3. 运行测试
4. 构建生产版本
5. 部署到 Cloudflare

---

## 常见开发任务

### 添加新 API 端点

1. 在 `server/index.ts` 中添加路由处理
2. 在 `shared/` 中定义 Zod 校验模型
3. 在 `src/lib/api.ts` 中添加客户端请求方法
4. 在 `tests/api.integration.ts` 中添加测试

### 添加新组件

1. 在 `src/components/` 创建 `.vue` 文件
2. 使用 `<script setup lang="ts">` 格式
3. 遵循无障碍规范（ARIA 标签、语义化 HTML）
4. 使用 Tailwind CSS，支持深浅主题

### 修改数据模型

1. 更新 `src/types/index.ts` 中的类型定义
2. 更新 `shared/schema.ts` 中的 Zod 模型
3. 创建数据库迁移文件 `server/migrations/XXXX_description.sql`
4. 运行 `pnpm db:migrate:local` 测试迁移
5. 更新相关组件和 API 处理逻辑

### 添加新的业务逻辑

1. **前后端共享逻辑**：放在 `shared/`，使用纯函数
2. **前端专用逻辑**：放在 `src/composables/` 或 `src/utils/`
3. **后端专用逻辑**：放在 `server/` 对应模块

---

## 代码审查清单

在提交代码前，请确保：

### 类型安全
- [ ] 无 TypeScript 错误（`vue-tsc -b` 和 `tsc -p tsconfig.worker.json`）
- [ ] 无 `any` 类型（使用 `unknown` 或具体类型）
- [ ] 导入类型使用 `import type`

### 代码规范
- [ ] Vue 组件使用 `<script setup lang="ts">`
- [ ] 后端导入使用显式 `.ts` 扩展名
- [ ] Tailwind CSS 包含深浅主题支持
- [ ] 响应式布局适配桌面与手机

### 无障碍
- [ ] 使用语义化 HTML 标签
- [ ] 关键交互有 ARIA 标签
- [ ] 不依赖颜色传达状态
- [ ] 支持键盘导航

### 安全
- [ ] API 请求经过 Zod 校验
- [ ] 非 GET/HEAD 请求验证同源
- [ ] 请求体大小限制
- [ ] 敏感操作需要认证

### 测试
- [ ] 新 API 有集成测试
- [ ] 核心逻辑有单元测试
- [ ] `pnpm test` 通过

### 文档
- [ ] 复杂逻辑有注释说明
- [ ] 新功能更新 README.md
- [ ] API 变更更新 AGENTS.md

---

## 附录

### 常用命令速查

```bash
# 开发
pnpm dev              # 一键启动
pnpm dev:web          # 仅前端
pnpm dev:api          # 仅后端

# 构建
pnpm build            # GitHub Pages 构建
pnpm build:cloudflare # Cloudflare 构建

# 测试
pnpm test             # 单元测试
pnpm test:api         # API 集成测试

# 数据库
pnpm db:migrate:local  # 本地迁移
pnpm db:migrate:remote # 线上迁移

# 部署
pnpm deploy           # 完整部署
pnpm deploy:check     # 检查配置

# Cloudflare
pnpm cf:login         # 授权
pnpm cf:whoami        # 查看当前账户
```

### 关键文件路径

- **配置文件**：
  - `package.json`：依赖与脚本
  - `wrangler.jsonc`：Cloudflare 配置
  - `vite.config.ts`：Vite 配置
  - `tsconfig.*.json`：TypeScript 配置
- **入口文件**：
  - `src/main.ts`：前端入口
  - `server/index.ts`：后端入口
- **类型定义**：
  - `src/types/index.ts`：前端类型
  - `server/types.ts`：后端类型
  - `shared/schema.ts`：数据校验
- **核心逻辑**：
  - `shared/calendar.ts`：日历计算
  - `shared/momentum.ts`：徽章计算
  - `shared/goal-checkins.ts`：目标打卡

### 相关链接

- [Vue 3 文档](https://vuejs.org/)
- [Vite 文档](https://vite.dev/)
- [Tailwind CSS v4](https://tailwindcss.com/)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Zod 文档](https://zod.dev/)
- [Lucide Icons](https://lucide.dev/)

---

**最后更新**：2026-10-30  
**维护者**：KeepDo 项目团队
