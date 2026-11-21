import { expect, test } from 'vitest'

import { FAMOUS } from './famous'

// ポイントが最大か (理論値か) と実際に出るかは、マカフシギ錬金の表と検索が要るのでここでは確かめない
// (一覧を作ったときに mhxx-rand で確かめた)。表がなくても確かめられることだけを見る

test('有名な理論値護石は、スロット 3 の一致の条件で、スキルの組み合わせが重ならない', () => {
  expect(FAMOUS).toHaveLength(24)
  expect(FAMOUS.every((f) => f.compare === 'exact' && f.slots === 3)).toBe(true)
  expect(FAMOUS.every((f) => f.skill1 !== null && f.skill2 !== null && f.skill1 !== f.skill2)).toBe(true)
  expect(new Set(FAMOUS.map((f) => `${f.skill1}-${f.skill2}`)).size).toBe(FAMOUS.length)
})
