# KeepDo 设计方案 (Design Specification)

## 1. 产品定位与目标
- **名称**：KeepDo
- **定位**：专注每日行动、沉淀长期目标的轻量级个人全能管理工具。
- **核心理念**：将宏大的“长期目标”与微观的“每日习惯打卡”和“每日代办”有机连接，通过连击（Streak）与可视化进度激励持续行动。

---

## 2. 核心架构与技术选型
- **前端框架**：Vue 3 (Composition API `<script setup>` + TypeScript)
- **构建工具**：Vite 8
- **样式与设计**：Tailwind CSS v4 + 精致微动效 + 支持浅色/深色主题
- **图标系统**：`@lucide/vue`
- **状态与存储**：Pinia 状态管理 + `localStorage` 实时持久化 + JSON 导入/导出备份
- **激励系统**：`canvas-confetti` 全成就有仪式感烟花效果

---

## 3. 数据模型设计

```typescript
// 目标类型：天数累计型 | 自定义数值型 | 关键里程碑型
export type GoalType = 'days' | 'number' | 'milestones'

export interface Milestone {
  id: string
  title: string
  completed: boolean
}

export interface Goal {
  id: string
  title: string
  description: string
  category: string // '学习' | '健身' | '事业' | '财富' | '生活' 等
  type: GoalType
  targetValue: number
  currentValue: number
  unit: string // 如 '天'、'页'、'公里'、'元'
  deadline: string // 'YYYY-MM-DD'
  milestones: Milestone[]
  color: string
  createdAt: string
}

export interface Habit {
  id: string
  title: string
  goalId?: string | null // 关联长期目标
  targetPerDay: number // 每日目标频次或数值
  unit: string
  records: Record<string, number> // 'YYYY-MM-DD' => 打卡值
  color: string
  createdAt: string
}

export interface Todo {
  id: string
  title: string
  goalId?: string | null // 关联长期目标
  date: string // 'YYYY-MM-DD'
  completed: boolean
  priority: 'low' | 'medium' | 'high'
  createdAt: string
}
```

---

## 4. 功能视图划分 (Tab 导航)

1. **「今日专注」视图 (Today Focus)**
   - 日期导航（昨天/今天/明天/日期选择）与今日完成率环形统计。
   - **习惯打卡区**：大圆点一键打卡、连续连击天数（🔥 Streak）指示、关联目标徽章。
   - **每日待办区**：优先级标签、快速新建输入框、点击划线完成、关联目标归属。
   - 今日全部搞定后触发五彩纸屑庆祝。

2. **「长期目标」视图 (Goals Dashboard)**
   - 目标大盘卡片墙，按分类筛选。
   - 进度条与百分比环，支持三种目标类型的差异化展示（天数、数值快速 +1 录入、里程碑打勾）。
   - 距离截止日期倒计时显示。
   - 目标新增/编辑/删除弹窗。

3. **「统计复盘」视图 (Stats & Review)**
   - GitHub 风格打卡热力图（近 12~16 周每日行动密度）。
   - 累计完成任务总数、最长连击天数、目标达成率。
   - 各目标进度总览排行。

4. **数据设置与备份 (Settings & Backup)**
   - 一键导出全部数据为 JSON。
   - 从 JSON 文件导入数据（防丢数据）。
   - 重置示例数据 / 清空数据。
