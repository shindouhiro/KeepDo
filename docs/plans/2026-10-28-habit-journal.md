# 习惯描述与图文日记实现计划

**目标：** 习惯支持固定描述，以及与目标一致的按日期图文记录、时间线、图片预览和编辑。

**架构：** 将目标日记的界面和请求逻辑整理为共用组件，通过主体类型区分目标和习惯。数据库为既有日记表增加主体类型，旧记录默认归属目标；原有目标接口和摘要字段保持兼容。基础描述随习惯数据同步，图文记录使用独立日记接口。

**技术栈：** Vue 3、TypeScript、Pinia、Tailwind CSS、Cloudflare Workers、D1、pnpm。

## 实现步骤

1. 在 `shared/journal.ts` 定义共用日记类型；新增数据库迁移，更新 `server/journal.ts`，按账号、主体类型和主体 ID 校验读写归属，保留图片类型、配额、版本冲突和幂等保护。
2. 在 `src/types/index.ts`、`shared/schema.ts`、`src/components/HabitModal.vue` 加入可选习惯描述；兼容旧数据与 JSON 备份。
3. 将日记弹窗、编辑器、时间线及组合函数改为目标和习惯共用，显示对应标题与打卡状态；保存文字或图片不自动打卡。
4. 更新 `TodayView.vue`、`CalendarPlanner.vue`、`CalendarPlanItem.vue`、`CalendarDayDialog.vue`、`shared/calendar.ts` 与日记索引，提供习惯入口和「有记录」标记。
5. 补充 `tests/journal.test.ts`、`tests/api.integration.ts`，覆盖描述持久化、同 ID 不同主体隔离、跨账号隔离、图片上传与编辑、目标日记回归。
6. 执行本地数据库迁移、`pnpm test`、`pnpm test:api` 和 `pnpm build`；浏览器验证桌面及移动端的描述编辑、图文上传、刷新持久化、图片预览、草稿保护与独立打卡。

## 组件职责

- `HabitModal`：维护习惯名称、固定描述和每日目标，保存到基础数据。
- `JournalDialog`：接收主体、主体类型和日期，协调保存、打卡、草稿保护与图片预览。
- `JournalEditor`：处理文字和图片草稿，通过事件提交；不直接修改习惯或目标。
- `JournalTimeline`：展示日记并发出编辑、图片预览事件。
- `useJournal`：请求指定主体的时间线与保存接口，处理取消、分页和过期响应。

## 数据兼容与边界

- 已有目标日记和图片原样保留；日记表中的历史 `goal_id` 列继续存储主体 ID，通过新增类型列区分。
- 习惯描述最多 5,000 字；每条日记最多 5,000 字、6 张图片，沿用已有压缩和账号配额。
- JSON 备份包含习惯固定描述，独立图文日记及图片仍不包含在 JSON 备份中。
- 此任务只修改本地实现并验证，不变更网络设置或部署线上。
