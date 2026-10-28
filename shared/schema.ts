import { z } from 'zod'

const text = z.string().trim().min(1).max(200)
const id = z.string().min(1).max(100)
const date = z.iso.date()
const count = z.number().finite().nonnegative().max(1_000_000_000)
const goalId = id.nullish()
const colors = z.enum(['indigo', 'violet', 'blue', 'sky', 'cyan', 'teal', 'emerald', 'green', 'lime', 'yellow', 'amber', 'orange', 'red', 'rose', 'pink', 'slate'])

const goalSchema = z.object({
  id, title: text, description: z.string().max(5000).optional(), category: text,
  type: z.enum(['days', 'number', 'milestones']), targetValue: count,
  currentValue: count, unit: z.string().max(40), deadline: date.optional(),
  milestones: z.array(z.object({ id, title: text, completed: z.boolean() })).max(500),
  checkIns: z.record(date, z.boolean()).refine(value => Object.keys(value).length <= 20_000).optional(),
  color: colors, createdAt: date,
})
const habitSchema = z.object({
  id, title: text, description: z.string().max(5000).optional(), goalId, targetPerDay: count.positive(), unit: z.string().max(40),
  records: z.record(date, count).refine(value => Object.keys(value).length <= 20_000),
  color: colors, createdAt: date,
})
const todoSchema = z.object({
  id, title: text, goalId, date, completed: z.boolean(),
  priority: z.enum(['low', 'medium', 'high']), createdAt: date,
})

export const appDataSchema = z.object({
  goals: z.array(goalSchema).max(5000), habits: z.array(habitSchema).max(5000),
  todos: z.array(todoSchema).max(20_000), categories: z.array(text).min(1).max(100),
}).superRefine((data, context) => {
  for (const key of ['goals', 'habits', 'todos'] as const) {
    if (new Set(data[key].map(item => item.id)).size !== data[key].length) {
      context.addIssue({ code: 'custom', message: '数据包含重复标识', path: [key] })
    }
  }
  const goals = new Set(data.goals.map(goal => goal.id))
  if ([...data.habits, ...data.todos].some(item => item.goalId && !goals.has(item.goalId))) {
    context.addIssue({ code: 'custom', message: '关联目标不存在' })
  }
})

export const credentialsSchema = z.object({
  username: z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/).transform(value => value.toLowerCase()),
  password: z.string().min(10).max(128),
})
export const saveDataSchema = z.object({ version: z.number().int().nonnegative(), data: appDataSchema })

export function emptyAppData() {
  return { goals: [], habits: [], todos: [], categories: ['全部', '学习', '成长', '健康', '事业', '生活', '财富'] }
}
