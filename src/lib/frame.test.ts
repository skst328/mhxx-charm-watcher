import { describe, expect, test } from 'vitest'

import { parseFrame, roughTime, secondsToShortTime, showFrame } from './frame'

test('showFrame は桁区切りをしない', () => {
  expect(showFrame(1234567)).toBe('1234567')
})

test('secondsToShortTime は 0 の上の単位を省き、後ろの単位を 2 桁にそろえる', () => {
  expect(secondsToShortTime(0)).toBe('0s')
  expect(secondsToShortTime(40)).toBe('40s')
  expect(secondsToShortTime(100)).toBe('1m 40s')
  expect(secondsToShortTime(3605)).toBe('1h 00m 05s')
  expect(secondsToShortTime(2 * 86400 + 3 * 3600)).toBe('2d 03h 00m 00s')
  // 秒は四捨五入
  expect(secondsToShortTime(85.7)).toBe('1m 26s')
})

test('roughTime は上の 2 つの単位だけを出す', () => {
  expect(roughTime(30)).toBe('0m')
  expect(roughTime(6 * 60 + 59)).toBe('6m')
  expect(roughTime(2 * 3600 + 45 * 60 + 26)).toBe('2h 45m')
  expect(roughTime(3600 + 5 * 60)).toBe('1h 05m')
  expect(roughTime(86400 + 21 * 3600 + 57 * 60)).toBe('1d 21h')
})

describe('parseFrame', () => {
  test('0 以上の整数を読む (カンマと前後の空白は無視する)', () => {
    expect(parseFrame('19000')).toBe(19000)
    expect(parseFrame('1,234,567')).toBe(1234567)
    expect(parseFrame(' 42 ')).toBe(42)
    expect(parseFrame('0')).toBe(0)
  })

  test('読めないものは null', () => {
    expect(parseFrame('')).toBeNull()
    expect(parseFrame('-1')).toBeNull()
    expect(parseFrame('1.5')).toBeNull()
    expect(parseFrame('12a')).toBeNull()
    // 正確に扱えない大きさ
    expect(parseFrame('99999999999999999999')).toBeNull()
  })
})
