import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Goal, Habit, Todo, AppData } from '../types'
import { getTodayString, addDays } from '../utils/date'
import { triggerCelebration } from '../utils/confetti'
import { api, ApiError } from '../lib/api'
import { appDataSchema, emptyAppData } from '../../shared/schema'
import { getDailyActionSummary } from '../../shared/calendar'
import { getGoalCheckInUpdate, isGoalDayCounted } from '../../shared/goal-checkins'

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
  // 业务数据只在登录后从数据库加载，旧本地数据等待用户主动导入。
  const initialData = emptyAppData()
  const goals = ref<Goal[]>(initialData.goals)
  const habits = ref<Habit[]>(initialData.habits)
  const todos = ref<Todo[]>(initialData.todos)
  const categories = ref<string[]>(initialData.categories)
  const isReady = ref(false)
  const isLoading = ref(false)
  const loadError = ref('')
  const syncState = ref<'saved' | 'saving' | 'error' | 'conflict'>('saved')
  const syncError = ref('')
  const sessionExpired = ref(false)
  const hasLegacyData = ref(Boolean(localStorage.getItem(STORAGE_KEY)))
  const version = ref(0)
  const editSequence = ref(0)
  const savedSequence = ref(0)
  const hasUnsavedChanges = computed(() => editSequence.value !== savedSequence.value)
  let timer: ReturnType<typeof setTimeout> | undefined
  let inFlight: Promise<void> | null = null
  let epoch = 0

  function snapshot(): AppData {
    return { goals: goals.value, habits: habits.value, todos: todos.value, categories: categories.value }
  }
  function applyData(data: AppData) {
    goals.value = data.goals
    habits.value = data.habits
    todos.value = data.todos
    categories.value = data.categories
  }
  async function loadData() {
    if (hasUnsavedChanges.value) throw new Error('请先保存或导出未保存的修改')
    const requestEpoch = ++epoch
    isLoading.value = true
    loadError.value = ''
    try {
      const result = await api<{ data: AppData; version: number }>('/api/data')
      const parsed = appDataSchema.parse(result.data)
      if (epoch !== requestEpoch || hasUnsavedChanges.value) return
      applyData(parsed)
      version.value = result.version
      editSequence.value = 0
      savedSequence.value = 0
      syncState.value = 'saved'
      syncError.value = ''
      sessionExpired.value = false
      isReady.value = true
    } catch (cause) {
      if (epoch !== requestEpoch) return
      loadError.value = cause instanceof Error ? cause.message : '账号数据加载失败'
      syncError.value = loadError.value
      syncState.value = 'error'
      sessionExpired.value = cause instanceof ApiError && cause.status === 401
    } finally { if (epoch === requestEpoch) isLoading.value = false }
  }
  async function flushSync(): Promise<void> {
    if (timer) clearTimeout(timer)
    if (inFlight) return inFlight
    if (!hasUnsavedChanges.value) return
    if (syncState.value === 'conflict') throw new Error(syncError.value)
    const requestEpoch = epoch
    inFlight = (async () => {
      syncState.value = 'saving'
      syncError.value = ''
      try {
        while (hasUnsavedChanges.value && requestEpoch === epoch) {
          const sequence = editSequence.value
          const body = JSON.stringify({ data: snapshot(), version: version.value })
          const result = await api<{ version: number }>('/api/data', { method: 'PUT', body })
          if (epoch !== requestEpoch) return
          version.value = result.version
          savedSequence.value = sequence
        }
        if (epoch === requestEpoch) syncState.value = 'saved'
      } catch (cause) {
        if (epoch !== requestEpoch) return
        syncError.value = cause instanceof Error ? cause.message : '保存失败，请重试'
        syncState.value = cause instanceof ApiError && cause.status === 409 ? 'conflict' : 'error'
        sessionExpired.value = cause instanceof ApiError && cause.status === 401
        throw cause
      }
    })()
    try { await inFlight } finally { inFlight = null }
  }
  function scheduleSave() {
    if (!isReady.value) return
    editSequence.value += 1
    if (syncState.value === 'conflict') return
    syncState.value = 'saving'
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => { void flushSync().catch(() => {}) }, 400)
  }
  async function reloadData() {
    if (inFlight) await inFlight.catch(() => {})
    if (timer) clearTimeout(timer)
    // 刷新失败时也保留当前内容及未保存状态，避免网络异常造成丢失。
    const previousSequence = savedSequence.value
    savedSequence.value = editSequence.value
    await loadData()
    if (loadError.value) savedSequence.value = previousSequence
  }
  function clearAccount() {
    epoch += 1
    if (timer) clearTimeout(timer)
    applyData(emptyAppData())
    isReady.value = false
    isLoading.value = false
    editSequence.value = 0
    savedSequence.value = 0
    syncError.value = ''
    loadError.value = ''
    syncState.value = 'saved'
  }
  async function importLegacyData() {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw || !importDataFromJSON(raw)) throw new Error('旧版本地数据格式不正确，请先导出备份并检查')
    await flushSync()
    hasLegacyData.value = false
  }

  const activeTab = ref<'today' | 'goals' | 'records' | 'stats'>('today')
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

  // 当日行动与长期目标累计进度分开统计，零行动不视为全部完成。
  const dailyActionSummary = computed(() => getDailyActionSummary(todos.value, habits.value, selectedDate.value))
  const todayProgress = computed(() => dailyActionSummary.value.percent)

  // ------------------ Actions: Goals ------------------
  function addGoal(goal: Omit<Goal, 'id' | 'createdAt'>) {
    const newGoal: Goal = {
      ...goal,
      id: `g-${crypto.randomUUID()}`,
      createdAt: getTodayString()
    }
    goals.value.push(newGoal)
    scheduleSave()
  }

  function updateGoal(id: string, updates: Partial<Goal>) {
    const idx = goals.value.findIndex(g => g.id === id)
    if (idx !== -1) {
      goals.value[idx] = { ...goals.value[idx], ...updates }
      scheduleSave()
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
    scheduleSave()
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
        scheduleSave()
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
      scheduleSave()
    }
  }

  function toggleGoalDay(goalId: string, date: string = selectedDate.value) {
    const goal = goals.value.find(item => item.id === goalId)
    if (!goal) return
    const updates = getGoalCheckInUpdate(goal, habits.value, date, getTodayString())
    if (!updates) return
    const previous = goal.currentValue
    Object.assign(goal, updates)
    if (goal.type === 'days' && previous < goal.targetValue && goal.currentValue >= goal.targetValue) triggerCelebration()
    scheduleSave()
  }

  // ------------------ Actions: Habits ------------------
  function addHabit(habit: Omit<Habit, 'id' | 'records' | 'createdAt'>) {
    const newHabit: Habit = {
      ...habit,
      id: `h-${crypto.randomUUID()}`,
      records: {},
      createdAt: getTodayString()
    }
    habits.value.push(newHabit)
    scheduleSave()
  }

  function updateHabit(id: string, updates: Partial<Habit>) {
    const idx = habits.value.findIndex(h => h.id === id)
    if (idx !== -1) {
      habits.value[idx] = { ...habits.value[idx], ...updates }
      scheduleSave()
    }
  }

  function deleteHabit(id: string) {
    habits.value = habits.value.filter(h => h.id !== id)
    scheduleSave()
  }

  function toggleHabitDay(habitId: string, date: string = selectedDate.value) {
    const habit = habits.value.find(h => h.id === habitId)
    if (!habit) return

    const currentVal = habit.records[date] || 0
    const target = habit.targetPerDay || 1
    const isCompletedBefore = currentVal >= target
    const linkedGoal = getGoalById(habit.goalId)
    const countedBefore = linkedGoal ? isGoalDayCounted(linkedGoal, habits.value, date) : false

    if (isCompletedBefore) {
      delete habit.records[date]
    } else {
      habit.records[date] = target
      // 检查今日是否全部达成
      checkAndCelebrateToday()
    }

    if (linkedGoal?.type === 'days') {
      // 同一天的目标打卡与多个关联习惯只累计一天。
      const delta = Number(isGoalDayCounted(linkedGoal, habits.value, date)) - Number(countedBefore)
      linkedGoal.currentValue = Math.max(0, linkedGoal.currentValue + delta)
      if (delta > 0 && linkedGoal.currentValue >= linkedGoal.targetValue) triggerCelebration()
    }
    scheduleSave()
  }

  // ------------------ Actions: Todos ------------------
  function addTodo(title: string, priority: Todo['priority'] = 'medium', goalId?: string | null, date: string = selectedDate.value) {
    if (!title.trim()) return
    const newTodo: Todo = {
      id: `t-${crypto.randomUUID()}`,
      title: title.trim(),
      date,
      priority,
      goalId: goalId || null,
      completed: false,
      createdAt: getTodayString()
    }
    todos.value.unshift(newTodo)
    scheduleSave()
    return newTodo.id
  }

  function toggleTodo(id: string) {
    const todo = todos.value.find(t => t.id === id)
    if (todo) {
      todo.completed = !todo.completed
      if (todo.completed) {
        checkAndCelebrateToday()
      }
      scheduleSave()
    }
  }

  function deleteTodo(id: string) {
    todos.value = todos.value.filter(t => t.id !== id)
    scheduleSave()
  }

  function updateTodo(id: string, updates: Partial<Todo>) {
    const idx = todos.value.findIndex(t => t.id === id)
    if (idx !== -1) {
      todos.value[idx] = { ...todos.value[idx], ...updates }
      scheduleSave()
    }
  }

  function checkAndCelebrateToday() {
    if (dailyActionSummary.value.state === 'completed') {
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
      const parsed = appDataSchema.parse(JSON.parse(jsonString))
      applyData(parsed)
      scheduleSave()
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
    scheduleSave()
  }

  return {
    isReady, isLoading, loadError, syncState, syncError, sessionExpired,
    hasUnsavedChanges, hasLegacyData, loadData, flushSync, reloadData, clearAccount, importLegacyData,
    goals,
    habits,
    todos,
    categories,
    activeTab,
    selectedDate,
    isDarkMode,
    todosForSelectedDate,
    todayProgress,
    dailyActionSummary,
    getGoalById,
    toggleDarkMode,
    addGoal,
    updateGoal,
    deleteGoal,
    toggleMilestone,
    adjustGoalValue,
    toggleGoalDay,
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
