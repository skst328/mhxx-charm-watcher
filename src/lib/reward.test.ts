import { expect, test } from 'vitest'

import { emptyDraft, GOSEKI, kindOf, rewardCharmOf, windowLabel, withoutZero } from './reward'

test('kindOf はレア度から元のお守りの種類を出す', () => {
  expect(GOSEKI.map((g) => kindOf(g.rarity))).toEqual([
    ...['mystery', 'mystery', 'shining', 'shining'],
    ...['worn', 'worn', 'worn', 'weathered', 'weathered', 'weathered'],
  ])
})

test('rewardCharmOf は欄がそろったら検索に渡す形にし、足りなければ null', () => {
  const d = { ...emptyDraft(), rarity: 9, skill1: 30, pts1: 4 }
  expect(rewardCharmOf(d)).toEqual({
    rarity: 9,
    charm: { skill1: 30, pts1: 4, skill2: null, pts2: null, slots: 0 },
  })
  expect(rewardCharmOf({ ...d, skill2: 7, pts2: -3, slots: 1 })?.charm).toEqual({
    skill1: 30,
    pts1: 4,
    skill2: 7,
    pts2: -3,
    slots: 1,
  })
  expect(rewardCharmOf({ ...d, rarity: null })).toBeNull()
  expect(rewardCharmOf({ ...d, pts1: null })).toBeNull()
  // 第 2 スキルを選んだのにポイントがない
  expect(rewardCharmOf({ ...d, skill2: 7 })).toBeNull()
})

test('withoutZero は 0 ポイントを外し、windowLabel は時間か日で出す', () => {
  expect(withoutZero([-2, -1, 0, 1, 2])).toEqual([-2, -1, 1, 2])
  expect([1, 12, 24, 72].map(windowLabel)).toEqual(['1時間', '12時間', '1日', '3日'])
})
