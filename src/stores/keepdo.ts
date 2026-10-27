import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Goal, Habit, Todo, AppData } from '../types'
import { getTodayString, addDays } from '../utils/date'
import { triggerCelebration } from '../utils/confetti'

const STORAGE_KEY = 'keepdo_app_data_v1'

const DEFAULT_CATEGORIES = ['全部', '学习', '成长', '健康', '事业', '生活', '财富']

function getInitialSampleData(): AppData {
  const today = getTodayString()
  const yesterday = addDays(today, -1)
  const d2 = addDays(today, -2)
  const d3 = addDays(today, -3)

  const goals: Goal[] = [
    {
      id: 'g-1',
      title: '读完 12 本深度好书',
      description: '拓展认知边界，每年阅读 12 本关于商业、技术与哲学书籍。',
      category: '学习',
      type: 'number',
      targetValue: 12,
      currentValue: 4,
      unit: '本',
      deadline: addDays(today, 65),
      milestones: [],
      color: 'indigo',
      createdAt: addDays(today, -30)
    },
    {
      id: 'g-2',
      title: '坚持每日复盘与写作 100 天',
      description: '记录每天的思考与感悟，保持清晰自律的头脑。',
      category: '成长',
      type: 'days',
      targetValue: 100,
      currentValue: 28,
      unit: '天',
      deadline: addDays(today, 72),
      milestones: [],
      color: 'emerald',
      createdAt: addDays(today, -28)
    },
    {
      id: 'g-3',
      title: '上线 KeepDo 个人管理系统',
      description: '打磨一个极简高效、完全掌控在自己手中的目标管理工具。',
      category: '事业',
      type: 'milestones',
      targetValue: 4,
      currentValue: 3,
      unit: '项',
      deadline: addDays(today, 15),
      milestones: [
        { id: 'm-1', title: '核心数据流与 Pinia 状态设计', completed: true },
        { id: 'm-2', title: '今日专注页面与打卡组件实现', completed: true },
        { id: 'm-3', title: '长期目标大盘与进度可视化', completed: true },
        { id: 'm-4', title: '统计复盘热力图与数据备份', completed: false }
      ],
      color: 'amber',
      createdAt: addDays(today, -7)
    }
  ]

  const habits: Habit[] = [
    {
      id: 'h-1',
      title: '早晨深度阅读 30 分钟',
      goalId: 'g-1',
      targetPerDay: 1,
      unit: '次',
      color: 'indigo',
      records: {
        [d3]: 1,
        [d2]: 1,
        [yesterday]: 1,
        [today]: 1
      },
      createdAt: addDays(today, -20)
    },
    {
      id: 'h-2',
      title: '每日睡前复盘日记',
      goalId: 'g-2',
      targetPerDay: 1,
      unit: '次',
      color: 'emerald',
      records: {
        [d3]: 1,
        [d2]: 1,
        [yesterday]: 1
      },
      createdAt: addDays(today, -20)
    },
    {
      id: 'h-3',
      title: '晨间拉伸与运动 15 分钟',
      goalId: null,
      targetPerDay: 1,
      unit: '次',
      color: 'rose',
      records: {
        [d2]: 1,
        [yesterday]: 1,
        [today]: 1
      },
      createdAt: addDays(today, -10)
    }
  ]

  const todos: Todo[] = [
    {
      id: 't-1',
      title: '完成 KeepDo 习惯打卡与热力图模块',
      goalId: 'g-3',
      date: today,
      completed: true,
      priority: 'high',
      createdAt: today
    },
    {
      id: 't-2',
      title: '阅读《纳瓦尔宝典》第 3 章并记笔记',
      goalId: 'g-1',
      date: today,
      completed: false,
      priority: 'medium',
      createdAt: today
    },
    {
      id: 't-3',
      title: '采购健康新鲜水果和燕麦',
      goalId: null,
      date: today,
      completed: false,
      priority: 'low',
      createdAt: today
    }
  ]

  return {
    goals,
    habits,
    todos,
    categories: DEFAULT_CATEGORIES
  }
}

export const useKeepDoStore = defineStore('keepdo', () => {
  // 从 localStorage 加载
  const rawData = localStorage.getItem(STORAGE_KEY)
  const initialData: AppData = rawData ? JSON.parse(rawData) : getInitialSampleData()

  const goals = ref<Goal[]>(initialData.goals || [])
  const habits = ref<Habit[]>(initialData.habits || [])
  const todos = ref<Todo[]>(initialData.todos || [])
  const categories = ref<string[]>(initialData.categories || DEFAULT_CATEGORIES)

  const activeTab = ref<'today' | 'goals' | 'stats'>('today')
  const selectedDate = ref<string>(getTodayString())
  const savedDarkMode = localStorage.getItem('keepdo_dark_mode')
  const initialDarkMode = savedDarkMode !== null
    ? savedDarkMode === 'true'
    : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)

  const isDarkMode = ref<boolean>(initialDarkMode)

  function applyDarkMode(dark: boolean) {
    if (typeof document !== 'undefined') {
      if (dark) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }
  }

  // 立即应用初始化
  applyDarkMode(isDarkMode.value)

  // 监听持久化
  function saveToStorage() {
    const data: AppData = {
      goals: goals.value,
      habits: habits.value,
      todos: todos.value,
      categories: categories.value
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }

  function toggleDarkMode() {
    isDarkMode.value = !isDarkMode.value
    localStorage.setItem('keepdo_dark_mode', String(isDarkMode.value))
    applyDarkMode(isDarkMode.value)
  }

  // 关联目标查询
  function getGoalById(id?: string | null): Goal | undefined {
    if (!id) return undefined
    return goals.value.find(g => g.id === id)
  }

  // 计算属性：当前选中日期的 Todos
  const todosForSelectedDate = computed(() => {
    return todos.value.filter(t => t.date === selectedDate.value)
  })

  // 计算属性：今日完成进度百分比
  const todayProgress = computed(() => {
    const day = selectedDate.value
    const dayTodos = todos.value.filter(t => t.date === day)
    const dayHabits = habits.value

    const totalTasks = dayTodos.length + dayHabits.length
    if (totalTasks === 0) return 100

    const completedTodos = dayTodos.filter(t => t.completed).length
    const completedHabits = dayHabits.filter(h => (h.records[day] || 0) >= h.targetPerDay).length

    return Math.round(((completedTodos + completedHabits) / totalTasks) * 100)
  })

  // ------------------ Actions: Goals ------------------
  function addGoal(goal: Omit<Goal, 'id' | 'createdAt'>) {
    const newGoal: Goal = {
      ...goal,
      id: `g-${Date.now()}`,
      createdAt: getTodayString()
    }
    goals.value.push(newGoal)
    saveToStorage()
  }

  function updateGoal(id: string, updates: Partial<Goal>) {
    const idx = goals.value.findIndex(g => g.id === id)
    if (idx !== -1) {
      goals.value[idx] = { ...goals.value[idx], ...updates }
      saveToStorage()
    }
  }

  function deleteGoal(id: string) {
    goals.value = goals.value.filter(g => g.id !== id)
    // 解除已关联习惯与待办的目标
    habits.value.forEach(h => {
      if (h.goalId === id) h.goalId = null
    })
    todos.value.forEach(t => {
      if (t.goalId === id) t.goalId = null
    })
    saveToStorage()
  }

  function toggleMilestone(goalId: string, milestoneId: string) {
    const goal = goals.value.find(g => g.id === goalId)
    if (goal) {
      const ms = goal.milestones.find(m => m.id === milestoneId)
      if (ms) {
        ms.completed = !ms.completed
        goal.currentValue = goal.milestones.filter(m => m.completed).length
        goal.targetValue = goal.milestones.length
        if (goal.currentValue === goal.targetValue && goal.targetValue > 0) {
          triggerCelebration()
        }
        saveToStorage()
      }
    }
  }

  function adjustGoalValue(goalId: string, delta: number) {
    const goal = goals.value.find(g => g.id === goalId)
    if (goal) {
      goal.currentValue = Math.max(0, goal.currentValue + delta)
      if (goal.currentValue >= goal.targetValue && goal.targetValue > 0) {
        triggerCelebration()
      }
      saveToStorage()
    }
  }

  // ------------------ Actions: Habits ------------------
  function addHabit(habit: Omit<Habit, 'id' | 'records' | 'createdAt'>) {
    const newHabit: Habit = {
      ...habit,
      id: `h-${Date.now()}`,
      records: {},
      createdAt: getTodayString()
    }
    habits.value.push(newHabit)
    saveToStorage()
  }

  function updateHabit(id: string, updates: Partial<Habit>) {
    const idx = habits.value.findIndex(h => h.id === id)
    if (idx !== -1) {
      habits.value[idx] = { ...habits.value[idx], ...updates }
      saveToStorage()
    }
  }

  function deleteHabit(id: string) {
    habits.value = habits.value.filter(h => h.id !== id)
    saveToStorage()
  }

  function toggleHabitDay(habitId: string, date: string = selectedDate.value) {
    const habit = habits.value.find(h => h.id === habitId)
    if (!habit) return

    const currentVal = habit.records[date] || 0
    const target = habit.targetPerDay || 1
    const isCompletedBefore = currentVal >= target

    if (isCompletedBefore) {
      delete habit.records[date]
      // 如果关联了天数型目标，回退
      if (habit.goalId) {
        const goal = goals.value.find(g => g.id === habit.goalId)
        if (goal && goal.type === 'days') {
          goal.currentValue = Math.max(0, goal.currentValue - 1)
        }
      }
    } else {
      habit.records[date] = target
      // 如果关联了天数型目标，累加
      if (habit.goalId) {
        const goal = goals.value.find(g => g.id === habit.goalId)
        if (goal && goal.type === 'days') {
          goal.currentValue += 1
          if (goal.currentValue >= goal.targetValue) {
            triggerCelebration()
          }
        }
      }
      // 检查今日是否全部达成
      checkAndCelebrateToday()
    }

    saveToStorage()
  }

  // ------------------ Actions: Todos ------------------
  function addTodo(title: string, priority: Todo['priority'] = 'medium', goalId?: string | null, date: string = selectedDate.value) {
    if (!title.trim()) return
    const newTodo: Todo = {
      id: `t-${Date.now()}`,
      title: title.trim(),
      date,
      priority,
      goalId: goalId || null,
      completed: false,
      createdAt: getTodayString()
    }
    todos.value.unshift(newTodo)
    saveToStorage()
  }

  function toggleTodo(id: string) {
    const todo = todos.value.find(t => t.id === id)
    if (todo) {
      todo.completed = !todo.completed
      if (todo.completed) {
        checkAndCelebrateToday()
      }
      saveToStorage()
    }
  }

  function deleteTodo(id: string) {
    todos.value = todos.value.filter(t => t.id !== id)
    saveToStorage()
  }

  function updateTodo(id: string, updates: Partial<Todo>) {
    const idx = todos.value.findIndex(t => t.id === id)
    if (idx !== -1) {
      todos.value[idx] = { ...todos.value[idx], ...updates }
      saveToStorage()
    }
  }

  function checkAndCelebrateToday() {
    if (todayProgress.value === 100) {
      triggerCelebration()
    }
  }

  // ------------------ Backup / Import ------------------
  function exportDataAsJSON(): string {
    const data: AppData = {
      goals: goals.value,
      habits: habits.value,
      todos: todos.value,
      categories: categories.value
    }
    return JSON.stringify(data, null, 2)
  }

  function importDataFromJSON(jsonString: string): boolean {
    try {
      const parsed = JSON.parse(jsonString) as AppData
      if (!Array.isArray(parsed.goals) || !Array.isArray(parsed.habits) || !Array.isArray(parsed.todos)) {
        throw new Error('格式不符合 KeepDo 数据规范')
      }
      goals.value = parsed.goals
      habits.value = parsed.habits
      todos.value = parsed.todos
      if (Array.isArray(parsed.categories)) {
        categories.value = parsed.categories
      }
      saveToStorage()
      return true
    } catch (e) {
      console.error(e)
      return false
    }
  }

  function resetToSample() {
    const sample = getInitialSampleData()
    goals.value = sample.goals
    habits.value = sample.habits
    todos.value = sample.todos
    categories.value = sample.categories
    saveToStorage()
  }

  return {
    goals,
    habits,
    todos,
    categories,
    activeTab,
    selectedDate,
    isDarkMode,
    todosForSelectedDate,
    todayProgress,
    getGoalById,
    toggleDarkMode,
    addGoal,
    updateGoal,
    deleteGoal,
    toggleMilestone,
    adjustGoalValue,
    addHabit,
    updateHabit,
    deleteHabit,
    toggleHabitDay,
    addTodo,
    toggleTodo,
    deleteTodo,
    updateTodo,
    exportDataAsJSON,
    importDataFromJSON,
    resetToSample
  }
})
