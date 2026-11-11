export function formatDate(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getTodayString(): string {
  return formatDate(new Date())
}

export function formatDisplayDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const todayStr = getTodayString()

  let prefix = ''
  if (dateStr === todayStr) {
    prefix = '今天 '
  } else {
    const yesterday = addDays(todayStr, -1)
    const tomorrow = addDays(todayStr, 1)
    if (dateStr === yesterday) prefix = '昨天 '
    if (dateStr === tomorrow) prefix = '明天 '
  }

  return `${prefix}${month}月${day}日 ${weekDays[d.getDay()]}`
}

export function addDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  d.setDate(d.getDate() + days)
  return formatDate(d)
}

export const dateRangePresets = [
  { value: 'all', label: '全部日期' },
  { value: 'today', label: '今天' },
  { value: 'yesterday', label: '昨天' },
  { value: 'last7', label: '最近 7 天' },
  { value: 'last30', label: '最近 30 天' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
] as const

export type DateRangePreset = typeof dateRangePresets[number]['value']

export function getDateRangePreset(preset: DateRangePreset, today = getTodayString()): { from: string; to: string } {
  switch (preset) {
    case 'all': return { from: '', to: '' }
    case 'today': return { from: today, to: today }
    case 'yesterday': {
      const yesterday = addDays(today, -1)
      return { from: yesterday, to: yesterday }
    }
    // 最近 N 天包含今天，按日历日计算，避免时区和夏令时造成偏移。
    case 'last7': return { from: addDays(today, -6), to: today }
    case 'last30': return { from: addDays(today, -29), to: today }
    case 'week': {
      const [year, month, day] = today.split('-').map(Number)
      const weekday = new Date(year, month - 1, day).getDay()
      return { from: addDays(today, -((weekday + 6) % 7)), to: today }
    }
    case 'month': return { from: `${today.slice(0, 7)}-01`, to: today }
  }
}

export function getDaysRemaining(deadlineStr?: string): number | null {
  if (!deadlineStr) return null
  const [year, month, day] = deadlineStr.split('-').map(Number)
  const target = new Date(year, month - 1, day).getTime()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffTime = target - today.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

export interface WeekDayItem {
  date: string
  dayNumber: number
  weekDayName: string
  isToday: boolean
}

/**
 * 获取某个日期所在周（周一至周日）的 7 天列表
 */
export function getWeekDays(referenceDateStr: string = getTodayString()): WeekDayItem[] {
  const [year, month, day] = referenceDateStr.split('-').map(Number)
  const refDate = new Date(year, month - 1, day)
  const dayOfWeek = refDate.getDay() // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek

  const monday = new Date(refDate)
  monday.setDate(refDate.getDate() + diffToMonday)

  const weekDayNames = ['一', '二', '三', '四', '五', '六', '日']
  const todayStr = getTodayString()
  const result: WeekDayItem[] = []

  for (let i = 0; i < 7; i++) {
    const curr = new Date(monday)
    curr.setDate(monday.getDate() + i)
    const dateFormatted = formatDate(curr)
    result.push({
      date: dateFormatted,
      dayNumber: curr.getDate(),
      weekDayName: weekDayNames[i],
      isToday: dateFormatted === todayStr
    })
  }

  return result
}

/**
 * 计算习惯当前连续天数和历史最长天数
 */
export function calculateHabitStreak(records: Record<string, number>, targetPerDay: number = 1): { currentStreak: number; longestStreak: number } {
  const today = getTodayString()
  const yesterday = addDays(today, -1)

  // 检查今天是否完成
  const doneToday = (records[today] || 0) >= targetPerDay
  const doneYesterday = (records[yesterday] || 0) >= targetPerDay

  let currentStreak = 0
  let checkDate = doneToday ? today : (doneYesterday ? yesterday : null)

  if (checkDate) {
    while (checkDate && (records[checkDate] || 0) >= targetPerDay) {
      currentStreak++
      checkDate = addDays(checkDate, -1)
    }
  }

  // 历史最长天数
  const dates = Object.keys(records)
    .filter(d => (records[d] || 0) >= targetPerDay)
    .sort()

  let longestStreak = 0
  let tempStreak = 0
  let prevDate: string | null = null

  for (const d of dates) {
    if (!prevDate) {
      tempStreak = 1
    } else {
      if (addDays(prevDate, 1) === d) {
        tempStreak++
      } else {
        tempStreak = 1
      }
    }
    if (tempStreak > longestStreak) {
      longestStreak = tempStreak
    }
    prevDate = d
  }

  longestStreak = Math.max(longestStreak, currentStreak)

  return { currentStreak, longestStreak }
}

/**
 * 获取过去 N 天的日期数组 (用于热力图，从最旧到最新)
 */
export function getPastNDays(days: number = 84): string[] {
  const result: string[] = []
  const today = getTodayString()
  for (let i = days - 1; i >= 0; i--) {
    result.push(addDays(today, -i))
  }
  return result
}
