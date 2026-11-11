import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dateRangePresets, getDateRangePreset, getTodayString } from '../src/utils/date.ts'

test('快捷日期支持全部、今天和昨天，默认使用本地日期', () => {
  assert.equal(new Set(dateRangePresets.map(preset => preset.value)).size, dateRangePresets.length)
  assert.deepEqual(getDateRangePreset('all'), { from: '', to: '' })
  assert.deepEqual(getDateRangePreset('today'), { from: getTodayString(), to: getTodayString() })
  assert.deepEqual(getDateRangePreset('today', '2026-11-10'), { from: '2026-11-10', to: '2026-11-10' })
  assert.deepEqual(getDateRangePreset('yesterday', '2026-01-01'), { from: '2025-12-31', to: '2025-12-31' })
})

test('最近 7 / 30 天包含今天，正确处理跨月、跨年与闰日', () => {
  assert.deepEqual(getDateRangePreset('last7', '2026-11-10'), { from: '2026-11-04', to: '2026-11-10' })
  assert.deepEqual(getDateRangePreset('last30', '2026-11-10'), { from: '2026-10-12', to: '2026-11-10' })
  assert.deepEqual(getDateRangePreset('last7', '2026-01-03'), { from: '2025-12-28', to: '2026-01-03' })
  assert.deepEqual(getDateRangePreset('last7', '2024-03-01'), { from: '2024-02-24', to: '2024-03-01' })
})

test('本周从周一开始，本月从 1 日开始，结束日期为今天', () => {
  assert.deepEqual(getDateRangePreset('week', '2026-11-10'), { from: '2026-11-09', to: '2026-11-10' })
  assert.deepEqual(getDateRangePreset('week', '2026-11-09'), { from: '2026-11-09', to: '2026-11-09' })
  assert.deepEqual(getDateRangePreset('week', '2026-11-15'), { from: '2026-11-09', to: '2026-11-15' })
  assert.deepEqual(getDateRangePreset('week', '2026-01-01'), { from: '2025-12-29', to: '2026-01-01' })
  assert.deepEqual(getDateRangePreset('month', '2026-11-10'), { from: '2026-11-01', to: '2026-11-10' })
  assert.deepEqual(getDateRangePreset('month', '2026-11-01'), { from: '2026-11-01', to: '2026-11-01' })
})
