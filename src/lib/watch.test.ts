import { expect, test } from 'vitest'

import type { Found, SkillInfo } from './types'
import {
  charmsOf,
  conditionText,
  covers,
  expandAtLeast,
  gosekiIn,
  groupTitle,
  groupWanted,
  HOUR,
  hourlyAims,
  matches,
  modeOf,
  sameWanted,
  semisOf,
  shade,
  theoryOf,
  wantedText,
  type Wanted,
} from './watch'

const skills: SkillInfo[] = [
  { id: 1, name: '連撃', abbr: '連撃', pts1: { min: 1, max: 4 }, pts2: { min: 1, max: 6 } },
  { id: 2, name: '痛撃', abbr: '痛撃', pts1: null, pts2: { min: 1, max: 5 } },
  { id: 3, name: '気まぐれ', abbr: '気紛', pts1: { min: 2, max: 3 }, pts2: null },
  // 第 2 スキルで 1 しか出ないもの (準理論値で第 2 スキルを下げられない)
  { id: 4, name: '耐泥', abbr: '耐泥', pts1: null, pts2: { min: 1, max: 1 } },
]

const wanted: Wanted = {
  id: 'a',
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
  expect(wantedText(wanted, skills)).toBe('連撃4以上 痛撃5以上 S3以上')
  expect(wantedText({ ...wanted, skill1: null, skill2: null }, skills)).toBe('第1問わず 第2問わず S3以上')
  expect(wantedText({ ...wanted, compare: 'exact', skill2: null }, skills)).toBe('連撃4 第2なし S3')
})

test('theoryOf は組み合わせの最大のポイントと S3 の一致、semisOf は 1 か所だけ下がった 3 通りを出す', () => {
  // 連撃は第 1 スキルで最大 4、痛撃は第 2 スキルで最大 5
  const theory = theoryOf(1, 2, skills)!
  expect(theory).toEqual({ compare: 'exact', skill1: 1, pts1: 4, skill2: 2, pts2: 5, slots: 3 })
  // スキルを決めていない・同じスキル・その欄に出ないスキルなら理論値はない
  expect([theoryOf(1, null, skills), theoryOf(1, 1, skills), theoryOf(2, 1, skills)]).toEqual([null, null, null])
  const pts = (ws: Omit<Wanted, 'id'>[]) => ws.map((p) => [p.pts1, p.pts2, p.slots])
  expect(pts(semisOf(theory, skills))).toEqual([
    [3, 5, 3],
    [4, 4, 3],
    [4, 5, 2],
  ])
  // 第 1 スキルの最小より下は準理論値にしない (気まぐれは第 1 スキルで 2〜3)
  expect(pts(semisOf({ ...theory, skill1: 3, pts1: 2 }, skills))).toEqual([
    [2, 4, 3],
    [2, 5, 2],
  ])
  // 第 2 スキルが 1 より下になるものも外す (耐泥は第 2 スキルで 1 だけ)
  expect(pts(semisOf(theoryOf(1, 4, skills)!, skills))).toEqual([
    [3, 1, 3],
    [4, 1, 2],
  ])
})

test('modeOf は理論値・準理論値・カスタムを見分ける', () => {
  const theory = { ...theoryOf(1, 2, skills)!, id: 'x' }
  expect(modeOf(theory, skills)).toBe('theory')
  for (const s of semisOf(theory, skills)) expect(modeOf({ ...s, id: 'y' }, skills)).toBe('semi')
  // 理論値と同じ範囲でも「以上」で入れたもの、2 か所下がったものはカスタム
  expect(modeOf(wanted, skills)).toBe('custom')
  expect(modeOf({ ...theory, pts1: 3, pts2: 4 }, skills)).toBe('custom')
  // 理論値が決まらない条件 (第 2 スキルなし) もカスタム
  expect(modeOf({ ...theory, skill2: null, pts2: null }, skills)).toBe('custom')
})

test('conditionText はポイントとスロットを、groupTitle は組み合わせの名前を出す', () => {
  expect(conditionText(wanted)).toBe('4以上・5以上・S3以上')
  expect(conditionText({ ...wanted, compare: 'exact', skill2: null, pts2: null })).toBe('4・S3')
  expect(groupTitle(wanted, skills)).toBe('連撃 × 痛撃')
  expect(groupTitle({ ...wanted, skill1: null, skill2: null }, skills)).toBe('第1問わず × 第2問わず')
  expect(groupTitle({ ...wanted, compare: 'exact', skill2: null }, skills)).toBe('連撃 × 第2なし')
})

test('groupWanted は組み合わせでまとめ、組み合わせはスキルの順、中はポイントとスロットの大きい順に並べる', () => {
  const w = (id: string, p: Partial<Wanted>): Wanted => ({ ...wanted, id, ...p })
  const groups = groupWanted([
    w('a', { pts1: 3 }),
    w('b', { skill1: 3, pts1: 2 }),
    w('c', {}),
    // 第 2 スキル問わず (以上) となし (一致) は別の組み合わせ
    w('d', { skill2: null, pts2: null }),
    w('e', { compare: 'exact', skill2: null, pts2: null }),
    // 第 1 スキルのポイントが同じなら第 2 スキルのポイント、それも同じならスロットの大きい順
    w('f', { pts2: 4 }),
    w('g', { slots: 2 }),
    // 第 2 スキルの番号が大きい組み合わせは後ろ
    w('h', { skill2: 4, pts2: 1 }),
  ])
  expect(groups.map((g) => g.map((x) => x.id))).toEqual([['d'], ['e'], ['c', 'g', 'f', 'a'], ['h'], ['b']])
})

test('expandAtLeast は「以上」の範囲を一致の条件に展開し、matches は中身が条件に当たるかを見る', () => {
  // 連撃 (第 1 スキル 1〜4) 3以上 × 痛撃 (第 2 スキル 1〜5) 4以上 × S2以上 = 2 × 2 × 2 = 8 件。ポイントの大きい順
  const range = { skill1: 1, pts1: 3, skill2: 2, pts2: 4, slots: 2 }
  const all = expandAtLeast(range, skills)
  expect(all.map((w) => [w.pts1, w.pts2, w.slots])).toEqual([
    [4, 5, 3],
    [4, 5, 2],
    [4, 4, 3],
    [4, 4, 2],
    [3, 5, 3],
    [3, 5, 2],
    [3, 4, 3],
    [3, 4, 2],
  ])
  expect(all.every((w) => w.compare === 'exact')).toBe(true)
  // 最小より小さい指定は最小から (気まぐれは第 1 スキルで 2〜3)。スキルを決めていなければ空
  expect(expandAtLeast({ ...range, skill1: 3, pts1: 1, pts2: 5, slots: 3 }, skills)).toHaveLength(2)
  expect(expandAtLeast({ ...range, skill2: null }, skills)).toEqual([])
  // ポイントを決めていないか、そのスキルがその欄に出ないなら空 (気まぐれは第 2 スキルにならない)
  expect(expandAtLeast({ ...range, pts2: null }, skills)).toEqual([])
  expect(expandAtLeast({ ...range, skill2: 3 }, skills)).toEqual([])
  const charm = { skill1: 1, pts1: 4, skill2: 2, pts2: 4, slots: 3 }
  expect(matches({ ...all[2], id: 'x' }, charm, skills)).toBe(true)
  expect(matches({ ...all[0], id: 'x' }, charm, skills)).toBe(false)
  expect(matches(wanted, { ...charm, pts2: 5 }, skills)).toBe(true)
})

test('sameWanted は id 以外の条件がすべて同じかを見る', () => {
  expect(sameWanted(wanted, { ...wanted, id: 'b' })).toBe(true)
  expect(sameWanted(wanted, { ...wanted, id: 'b', pts2: 4 })).toBe(false)
})

test('covers は欄ごとに当たる範囲を比べ、含むかを見る', () => {
  const c = (w: Partial<Wanted>) => ({ ...wanted, ...w })
  const both = (a: Wanted, b: Wanted) => [covers(a, b, skills), covers(b, a, skills)]
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
