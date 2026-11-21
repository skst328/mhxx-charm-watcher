import { expect, test } from 'vitest'

import { famousToAdd, planRegistration, type RegisterInput } from './register'
import type { SkillInfo } from './types'
import type { Wanted } from './watch'

// 連撃は第 1 スキルで 1〜4、痛撃は第 2 スキルで 1〜5 (理論値は 連撃4 痛撃5 S3)
const skills: SkillInfo[] = [
  { id: 1, name: '連撃', abbr: '連撃', pts1: { min: 1, max: 4 }, pts2: { min: 1, max: 6 } },
  { id: 2, name: '痛撃', abbr: '痛撃', pts1: null, pts2: { min: 1, max: 5 } },
]

const input: RegisterInput = { mode: 'theory', skill1: 1, skill2: 2, compare: 'atLeast', pts1: 1, pts2: 1, slots: 0 }

const exact = (id: string, pts1: number, pts2: number, slots: number): Wanted => ({
  id,
  compare: 'exact',
  skill1: 1,
  pts1,
  skill2: 2,
  pts2,
  slots,
})

/** 条件をポイントとスロットだけにして比べやすくする */
const pts = (ws: Wanted[]) => ws.map((w) => [w.pts1, w.pts2, w.slots])

test('理論値は 1 件、準理論値もは理論値と 3 通りの準理論値の 4 件を、一致の条件として登録する', () => {
  const theory = planRegistration(input, [], skills)
  expect(pts(theory.drafts)).toEqual([[4, 5, 3]])
  expect(theory.ready).toBe(true)
  expect(pts(theory.pending)).toEqual([[4, 5, 3]])
  const semi = planRegistration({ ...input, mode: 'semi' }, [], skills)
  expect(pts(semi.drafts)).toEqual([
    [4, 5, 3],
    [3, 5, 3],
    [4, 4, 3],
    [4, 5, 2],
  ])
  expect(semi.drafts.every((d) => d.compare === 'exact')).toBe(true)
})

test('スキルを両方決めるまでは登録できない', () => {
  for (const skill of [{ skill1: null }, { skill2: null }]) {
    const plan = planRegistration({ ...input, ...skill }, [], skills)
    expect([plan.theory, plan.drafts, plan.ready, plan.pending]).toEqual([null, [], false, []])
  }
})

test('カスタムの「以上」は範囲を一致の条件に展開し、20 件を超えたら登録させない', () => {
  // 連撃3以上 × 痛撃4以上 × S2以上 = 2 × 2 × 2 = 8 件
  const plan = planRegistration({ ...input, mode: 'custom', pts1: 3, pts2: 4, slots: 2 }, [], skills)
  expect(plan.drafts).toHaveLength(8)
  expect([plan.tooMany, plan.ready]).toEqual([false, true])
  // 最小から全部だと 4 × 5 × 4 = 80 件
  const wide = planRegistration({ ...input, mode: 'custom' }, [], skills)
  expect(wide.drafts).toHaveLength(80)
  expect([wide.tooMany, wide.ready, wide.pending]).toEqual([true, false, []])
  // 「一致」はその 1 件
  const one = planRegistration({ ...input, mode: 'custom', compare: 'exact', pts1: 3, pts2: 4, slots: 2 }, [], skills)
  expect(pts(one.drafts)).toEqual([[3, 4, 2]])
})

test('登録済みのものは登録せず (札は薄くする)、登録していないものだけを足す', () => {
  // 準理論値を 1 つ (連撃3) 消した状態から、準理論値もで登録し直すと、その 1 つだけを足す
  const wanted = [exact('a', 4, 5, 3), exact('b', 4, 4, 3), exact('c', 4, 5, 2)]
  const plan = planRegistration({ ...input, mode: 'semi' }, wanted, skills)
  expect(plan.registered).toEqual([true, false, true, true])
  expect(pts(plan.pending)).toEqual([[3, 5, 3]])
  expect(plan.widerBy).toBeUndefined()
  // 全部登録済みなら足すものはない (欄はそろっているので ready のまま。登録済みかは見ない)
  const done = planRegistration(input, wanted, skills)
  expect([done.ready, done.pending]).toEqual([true, []])
})

test('理論値と準理論値もでは、カスタムの欄 (比べ方・ポイント・スロット) は使わない', () => {
  const custom = { compare: 'exact' as const, pts1: 2, pts2: 2, slots: 1 }
  expect(pts(planRegistration({ ...input, ...custom }, [], skills).drafts)).toEqual([[4, 5, 3]])
  expect(planRegistration({ ...input, ...custom, mode: 'semi' }, [], skills).drafts).toHaveLength(4)
})

test('前に「以上」で登録した広い条件に含まれるなら、登録せずにその条件を知らせる', () => {
  const wide: Wanted = { ...exact('w', 3, 4, 2), compare: 'atLeast' }
  const plan = planRegistration(input, [wide], skills)
  expect(plan.pending).toEqual([])
  expect(plan.widerBy).toBe(wide)
  // 同じ範囲 (最大の値の「以上」は一致の理論値と同じ) なら、知らせるのは「登録済み」なので widerBy は出さない
  const same: Wanted = { ...exact('s', 4, 5, 3), compare: 'atLeast' }
  const samePlan = planRegistration(input, [same], skills)
  expect([samePlan.pending, samePlan.widerBy]).toEqual([[], undefined])
})

test('famousToAdd は登録していない理論値 (準理論値もなら 3 通りの準理論値も) だけを出す', () => {
  const famous: Omit<Wanted, 'id'>[] = [{ compare: 'exact', skill1: 1, pts1: 4, skill2: 2, pts2: 5, slots: 3 }]
  expect(pts(famousToAdd(famous, false, [], skills))).toEqual([[4, 5, 3]])
  expect(famousToAdd(famous, true, [], skills)).toHaveLength(4)
  // 理論値を登録済みなら、準理論値もでは 3 通りの準理論値だけ
  expect(pts(famousToAdd(famous, true, [exact('a', 4, 5, 3)], skills))).toEqual([
    [3, 5, 3],
    [4, 4, 3],
    [4, 5, 2],
  ])
  expect(famousToAdd(famous, false, [exact('a', 4, 5, 3)], skills)).toEqual([])
})
