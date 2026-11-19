import { expect, test } from 'vitest'

import type { Found, SkillInfo } from './types'
import {
  charmsOf,
  covers,
  gosekiIn,
  HOUR,
  hourlyAims,
  sameWanted,
  shade,
  wantedChips,
  wantedText,
  type Wanted,
} from './watch'

const skills: SkillInfo[] = [
  { id: 1, name: '連撃', abbr: '連撃', pts1: { min: 1, max: 4 }, pts2: { min: 1, max: 6 } },
  { id: 2, name: '痛撃', abbr: '痛撃', pts1: null, pts2: { min: 1, max: 5 } },
  { id: 3, name: '気まぐれ', abbr: '気紛', pts1: { min: 2, max: 3 }, pts2: null },
]

const wanted: Wanted = {
  id: 'a',
  melding: 'juju',
  compare: 'atLeast',
  skill1: 1,
  pts1: 4,
  skill2: 2,
  pts2: 5,
  slots: 3,
}

test('charmsOf は第 1 スキルを問わないとき、第 1 スキルに出るスキルごとに最小のポイントで並べる', () => {
  expect(charmsOf(wanted, skills)).toEqual([{ skill1: 1, pts1: 4, skill2: 2, pts2: 5, slots: 3 }])
  expect(charmsOf({ ...wanted, skill1: null, pts1: null }, skills)).toEqual([
    { skill1: 1, pts1: 1, skill2: 2, pts2: 5, slots: 3 },
    { skill1: 3, pts1: 2, skill2: 2, pts2: 5, slots: 3 },
  ])
  // 第 2 スキルを問わないなら、ポイントも渡さない
  expect(charmsOf({ ...wanted, skill2: null }, skills)[0]).toEqual({
    skill1: 1,
    pts1: 4,
    skill2: null,
    pts2: null,
    slots: 3,
  })
})

test('wantedText は比べ方で「以上」「問わず」「なし」を書き分ける', () => {
  expect(wantedText(wanted, skills)).toBe('連撃4以上 痛撃5以上 S3以上 マカ')
  expect(wantedText({ ...wanted, skill1: null, skill2: null }, skills)).toBe('第1問わず 第2問わず S3以上 マカ')
  expect(wantedText({ ...wanted, compare: 'exact', skill2: null }, skills)).toBe('連撃4 第2なし S3 マカ')
})

test('wantedChips はスキルとスロットを札にする', () => {
  expect(wantedChips(wanted, skills)).toEqual(['連撃4以上', '痛撃5以上', 'S3以上'])
  expect(wantedChips({ ...wanted, compare: 'exact', skill1: 3, pts1: 2, skill2: null }, skills)).toEqual([
    '気まぐれ2',
    '第2なし',
    'S3',
  ])
})

test('sameWanted は id 以外の条件がすべて同じかを見る', () => {
  expect(sameWanted(wanted, { ...wanted, id: 'b' })).toBe(true)
  expect(sameWanted(wanted, { ...wanted, id: 'b', pts2: 4 })).toBe(false)
  expect(sameWanted(wanted, { ...wanted, id: 'b', melding: 'halcyon' })).toBe(false)
})

test('covers は欄ごとに当たる範囲を比べ、含むかを見る', () => {
  const all = { juju: skills, halcyon: [] }
  const c = (w: Partial<Wanted>) => ({ ...wanted, ...w })
  const both = (a: Wanted, b: Wanted) => [covers(a, b, all), covers(b, a, all)]
  // 連撃4以上 痛撃5以上 S3以上 (wanted) は、ポイントもスロットも最大なので一致と同じ範囲
  expect(both(wanted, c({ compare: 'exact' }))).toEqual([true, true])
  // 広い「以上」は狭い条件を含む (逆は含まない)
  expect(both(c({ pts1: 2, skill2: null, pts2: null, slots: 0 }), wanted)).toEqual([true, false])
  expect(both(c({ pts1: 3 }), c({ compare: 'exact', pts1: 3 }))).toEqual([true, false])
  expect(both(c({ slots: 2 }), c({ compare: 'exact', slots: 3 }))).toEqual([true, false])
  // 第 1 スキルを問わないものは、どの第 1 スキルも含む
  expect(both(c({ skill1: null, pts1: null }), wanted)).toEqual([true, false])
  // 「以上」の第 2 スキル問わずは「一致」の第 2 なしを含む。第 2 なしは第 2 スキルありを含まない
  const none = c({ compare: 'exact', skill2: null, pts2: null })
  expect(both(c({ skill2: null, pts2: null }), none)).toEqual([true, false])
  expect(both(none, c({ compare: 'exact' }))).toEqual([false, false])
  // 最小より小さい「以上」は最小からと同じ (気まぐれは第 1 スキルで 2〜3)
  expect(both(c({ skill1: 3, pts1: 1 }), c({ skill1: 3, pts1: 2 }))).toEqual([true, true])
  // 錬金のやり方が違えば含まない
  expect(both(wanted, c({ melding: 'halcyon' }))).toEqual([false, false])
})

const charm = { skill1: 1, pts1: 4, skill2: null, pts2: null, slots: 3 }
const found: Found[] = [
  {
    position: 1010,
    kind: 'worn',
    charm,
    aimpoints: [
      { start: 995, index: 2 },
      { start: 1003, index: 1 },
    ],
  },
  { position: 1020, kind: 'weathered', charm, aimpoints: [{ start: 1001, index: 4 }] },
  { position: 1100, kind: 'worn', charm, aimpoints: [{ start: 1090, index: 1 }] },
]

test('gosekiIn は当たりフレームが範囲にあるものだけを残し、最初の当たりフレームの順に並べる', () => {
  expect(gosekiIn(found, 1000, 1050)).toEqual([
    { position: 1020, kind: 'weathered', charm, aims: [{ frame: 1001, index: 4 }] },
    // 範囲より手前の当たりフレーム (995) は外す
    { position: 1010, kind: 'worn', charm, aims: [{ frame: 1003, index: 1 }] },
  ])
  expect(gosekiIn(found, 2000, 3000)).toEqual([])
})

test('hourlyAims は 1 時間ごとに当たりフレームを数える', () => {
  const at = (h: number, index = 1) => ({ frame: 1000 + h * HOUR, index })
  const gosekis = [
    { position: 0, kind: 'worn' as const, charm, aims: [at(0), at(0.5, 2)] },
    { position: 0, kind: 'worn' as const, charm, aims: [at(2.9), at(3)] },
  ]
  expect(hourlyAims(gosekis, 1000, 4)).toEqual([2, 0, 1, 1])
  // 範囲の外は数えない
  expect(hourlyAims(gosekis, 1000, 3)).toEqual([2, 0, 1])
})

test('shade は当たりフレームの数を 4 段階の濃さにする', () => {
  expect([0, 1, 2, 3, 4, 5, 9].map(shade)).toEqual([0, 1, 2, 3, 3, 4, 4])
})
