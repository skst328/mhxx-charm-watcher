import { expect, test } from 'vitest'

import type { Charm, Compare, Found, SkillInfo } from './types'
import { AIM_LEAD, HOUR, type Wanted } from './watch'
import { isAbort, watchEachWith, type Search } from './watching'

// 連撃は第 1 スキルで 1〜4、痛撃・達人は第 2 スキルで 1〜5
const skills: SkillInfo[] = [
  { id: 1, name: '連撃', abbr: '連撃', pts1: { min: 1, max: 4 }, pts2: null },
  { id: 2, name: '痛撃', abbr: '痛撃', pts1: null, pts2: { min: 1, max: 5 } },
  { id: 3, name: '達人', abbr: '達人', pts1: null, pts2: { min: 1, max: 5 } },
]

const charm = (pts1: number, skill2: number, pts2: number, slots: number): Charm => ({
  skill1: 1,
  pts1,
  skill2,
  pts2,
  slots,
})
const exact = (id: string, c: Charm): Wanted => ({ id, compare: 'exact', ...c })

/** 乱数の列に並んでいる護石 (位置・中身・当たりフレーム) */
const world: Found[] = [
  { position: 1100, kind: 'weathered', charm: charm(4, 2, 5, 3), aimpoints: [{ start: 1090, index: 1 }] },
  { position: 1200, kind: 'weathered', charm: charm(3, 2, 5, 3), aimpoints: [{ start: 1195, index: 2 }] },
  { position: 1300, kind: 'worn', charm: charm(4, 2, 5, 3), aimpoints: [{ start: 1290, index: 1 }] },
  { position: 1400, kind: 'weathered', charm: charm(4, 3, 5, 3), aimpoints: [{ start: 1380, index: 1 }] },
]

/** 偽の検索: world から、範囲に入り charms のどれかに compare の比べ方で合うものを返す。呼ばれ方を calls に残す */
function fakeSearch() {
  const calls: { charms: Charm[]; compare: Compare; start: number; end: number }[] = []
  const atLeast = (c: Charm, w: Charm) =>
    c.skill1 === w.skill1 && c.skill2 === w.skill2 && c.pts1 >= w.pts1 && c.pts2! >= w.pts2! && c.slots >= w.slots
  const search: Search = async (charms, compare, start, end) => {
    calls.push({ charms, compare, start, end })
    const hit = (c: Charm) =>
      charms.some((w) => (compare === 'exact' ? JSON.stringify(c) === JSON.stringify(w) : atLeast(c, w)))
    return { found: world.filter((f) => f.position >= start && f.position < end && hit(f.charm)), truncated: false }
  }
  return { search, calls }
}

const positions = (r: unknown) =>
  ('gosekis' in (r as object) ? (r as { gosekis: Found[] }).gosekis : []).map((g) => g.position)

test('組み合わせごとに 1 回で探し、見つけた護石を中身が当たる条件に振り分ける', async () => {
  const { search, calls } = fakeSearch()
  const theory = exact('t', charm(4, 2, 5, 3))
  const semi = exact('s', charm(3, 2, 5, 3))
  const other = exact('o', charm(4, 3, 5, 3))
  const byId = await watchEachWith(search, [theory, semi, other], skills, 1000, 1)
  // 連撃 × 痛撃 で 1 回 (2 つの護石をまとめて)、連撃 × 達人 で 1 回
  expect(calls.map((c) => c.charms.length)).toEqual([2, 1])
  // 探す範囲は、当たりフレームが錬金枠より手前になるぶん、終わりを AIM_LEAD 先まで延ばす
  expect(calls[0]).toMatchObject({ start: 1000, end: 1000 + HOUR + AIM_LEAD })
  // 理論値には風化と古びたの 2 か所、準理論値と連撃 × 達人には 1 か所ずつ
  expect([positions(byId.t), positions(byId.s), positions(byId.o)]).toEqual([[1100, 1300], [1200], [1400]])
})

test('当たりフレームが範囲より前の錬金枠は外す', async () => {
  const { search } = fakeSearch()
  // 1100 の当たりフレームは 1090 なので、1095 から探すと外れる
  const byId = await watchEachWith(search, [exact('t', charm(4, 2, 5, 3))], skills, 1095, 1)
  expect(positions(byId.t)).toEqual([1300])
})

test('比べ方が違う条件は別に探し、同じ錬金枠は 1 つにまとめてから振り分ける', async () => {
  const { search, calls } = fakeSearch()
  // 前に「以上」で登録した条件 (連撃3以上 痛撃5以上 S3以上) と、一致の理論値
  const wide: Wanted = { ...exact('w', charm(3, 2, 5, 3)), compare: 'atLeast' }
  const theory = exact('t', charm(4, 2, 5, 3))
  const byId = await watchEachWith(search, [wide, theory], skills, 1000, 1)
  expect(calls.map((c) => c.compare).toSorted()).toEqual(['atLeast', 'exact'])
  // 以上は 3 か所全部、一致の理論値は 2 か所 (同じ錬金枠が 2 回数えられない)
  expect([positions(byId.w), positions(byId.t)]).toEqual([
    [1100, 1200, 1300],
    [1100, 1300],
  ])
})

test('組み合わせの中で 1 つの比べ方だけ探せなくても、ほかの比べ方で見つけたものは振り分ける', async () => {
  const { search } = fakeSearch()
  const failing: Search = async (charms, compare, start, end) => {
    if (compare === 'atLeast') throw new Error('この錬金では出ない組み合わせ')
    return search(charms, compare, start, end)
  }
  const wide: Wanted = { ...exact('w', charm(3, 2, 5, 3)), compare: 'atLeast' }
  const byId = await watchEachWith(failing, [wide, exact('t', charm(4, 2, 5, 3))], skills, 1000, 1)
  expect(positions(byId.t)).toEqual([1100, 1300])
  // 以上の条件も、一致の検索で見つけた錬金枠のうち中身が当たるものを受け取る (エラーにはしない)
  expect(positions(byId.w)).toEqual([1100, 1300])
})

test('探せなかった組み合わせの条件は、エラーの 1 行目を受け取る (ほかの組み合わせはそのまま)', async () => {
  const { search } = fakeSearch()
  const failing: Search = async (charms, compare, start, end) => {
    if (charms.some((c) => c.skill2 === 3)) throw new Error('この錬金では出ない組み合わせ\n風化したお守り: …')
    return search(charms, compare, start, end)
  }
  const byId = await watchEachWith(
    failing,
    [exact('t', charm(4, 2, 5, 3)), exact('o', charm(4, 3, 5, 3))],
    skills,
    1000,
    1,
  )
  expect(byId.o).toEqual({ error: 'この錬金では出ない組み合わせ' })
  expect(positions(byId.t)).toEqual([1100, 1300])
})

test('search が中止で失敗したら、結果を返さずにそのエラーを投げ、残りの組み合わせは探さない', async () => {
  const { search, calls } = fakeSearch()
  const aborting: Search = async (charms, compare, start, end) => {
    if (calls.length === 1) throw new DOMException('中止しました', 'AbortError')
    return search(charms, compare, start, end)
  }
  const wanted = [exact('t', charm(4, 2, 5, 3)), exact('o', charm(4, 3, 5, 3)), exact('x', charm(4, 3, 4, 3))]
  // 1 つめの組み合わせ (連撃 × 痛撃) は探せて、2 つめ (連撃 × 達人) で中止される
  await expect(watchEachWith(aborting, wanted, skills, 1000, 1)).rejects.toMatchObject({ name: 'AbortError' })
  expect(calls).toHaveLength(1)
})

test('isAbort は name が AbortError のエラーだけを中止とみなす', () => {
  expect(isAbort(new DOMException('中止しました', 'AbortError'))).toBe(true)
  expect(isAbort(new Error('この錬金では出ない組み合わせ'))).toBe(false)
  expect(isAbort('AbortError')).toBe(false)
})
