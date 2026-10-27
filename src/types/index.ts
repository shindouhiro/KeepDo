export type GoalType = 'days' | 'number' | 'milestones'

export interface Milestone {
  id: string
  title: string
  completed: boolean
}

export interface Goal {
  id: string
  title: string
  description?: string
  category: string
  type: GoalType
  targetValue: number
  currentValue: number
  unit: string
  deadline?: string
  milestones: Milestone[]
  color: string
  createdAt: string
}

export interface Habit {
  id: string
  title: string
  goalId?: string | null
  targetPerDay: number
  unit: string
  records: Record<string, number> // 'YYYY-MM-DD' => count
  color: string
  createdAt: string
}

export type Priority = 'low' | 'medium' | 'high'

export interface Todo {
  id: string
  title: string
  goalId?: string | null
  date: string // 'YYYY-MM-DD'
  completed: boolean
  priority: Priority
  createdAt: string
}

export interface AppData {
  goals: Goal[]
  habits: Habit[]
  todos: Todo[]
  categories: string[]
}
