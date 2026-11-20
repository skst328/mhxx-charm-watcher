import { XIcon } from 'lucide-react'

import { skillName } from '@/lib/skills'
import type { SkillInfo } from '@/lib/types'
import { MELDING_LABEL, type Wanted } from '@/lib/watch'

/** 第 1 スキル × 第 2 スキルの組み合わせ (まとめる単位)。錬金のやり方が違えば別。第 2 スキルを問わないものと、
 * なしのものも別にする */
const groupKey = (w: Wanted) =>
  `${w.melding}-${w.skill1 ?? 'any'}-${w.skill2 ?? (w.compare === 'atLeast' ? 'any' : 'none')}`

/** まとまりの並び: 錬金のやり方、第 1 スキル、第 2 スキルの番号の順 (問わず・なしは先) */
const groupOrder = (w: Wanted) => [
  w.melding === 'juju' ? 0 : 1,
  w.skill1 ?? -1,
  w.skill2 ?? (w.compare === 'atLeast' ? -2 : -1),
]

/** まとまりの見出し (「痛撃 × 達人」) */
function groupTitle(w: Wanted, skills: SkillInfo[]): string {
  const first = w.skill1 === null ? '第1問わず' : skillName(skills, w.skill1)
  const second = w.skill2 !== null ? skillName(skills, w.skill2) : w.compare === 'atLeast' ? '第2問わず' : '第2なし'
  return `${first} × ${second}`
}

/** ポイントとスロットの条件 (「6・10・S3」「5以上・9以上・S2以上」) */
function conditionText(w: Wanted): string {
  const suffix = w.compare === 'atLeast' ? '以上' : ''
  return [w.pts1, w.pts2, `S${w.slots}`]
    .filter((v) => v !== null)
    .map((v) => `${v}${suffix}`)
    .join('・')
}

/**
 * 登録した護石の一覧: 第 1 スキル × 第 2 スキルの組み合わせでまとめ、その中に登録されているポイントとスロットの
 * 条件を札で並べる (札ごとに消せる)。まとまりの中はポイントの大きい順
 */
export function WantedList({
  wanted,
  skills,
  onRemove,
}: {
  wanted: Wanted[]
  /** どちらの錬金のスキルも入った一覧 (名前を出すのに使う) */
  skills: SkillInfo[]
  onRemove: (w: Wanted) => void
}) {
  const groups = new Map<string, Wanted[]>()
  for (const w of wanted) groups.set(groupKey(w), [...(groups.get(groupKey(w)) ?? []), w])
  const sorted = [...groups.values()]
    .map((g) =>
      g.toSorted((a, b) => (b.pts1 ?? 0) - (a.pts1 ?? 0) || (b.pts2 ?? 0) - (a.pts2 ?? 0) || b.slots - a.slots),
    )
    .toSorted((a, b) => {
      const [x, y] = [groupOrder(a[0]), groupOrder(b[0])]
      return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]
    })
  return (
    <ul className="divide-y">
      {sorted.map((group) => (
        <li key={groupKey(group[0])} className="space-y-1.5 py-2.5 first:pt-0 last:pb-0">
          <div className="flex items-baseline gap-2 text-sm font-semibold">
            {groupTitle(group[0], skills)}
            <span className="text-xs font-normal text-muted-foreground">{MELDING_LABEL[group[0].melding]}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {group.map((w) => (
              <span
                key={w.id}
                className="inline-flex items-center gap-1 rounded-full bg-muted py-0.5 pr-1 pl-2.5 text-xs font-semibold tabular-nums"
              >
                {conditionText(w)}
                {w.semi && <span className="font-normal text-muted-foreground">準理論値も</span>}
                <button
                  type="button"
                  className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                  onClick={() => onRemove(w)}
                  aria-label="この条件の登録を消す"
                >
                  <XIcon className="size-3.5" />
                </button>
              </span>
            ))}
          </div>
        </li>
      ))}
    </ul>
  )
}
