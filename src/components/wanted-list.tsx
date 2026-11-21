import { XIcon } from 'lucide-react'

import type { SkillInfo } from '@/lib/types'
import { conditionText, groupKey, groupTitle, groupWanted, MODE_LABEL, modeOf, type Wanted } from '@/lib/watch'

/**
 * 登録した護石の一覧: 第 1 スキル × 第 2 スキルの組み合わせでまとめ、その中に登録されているポイントとスロットの
 * 条件を札で並べる (札ごとに消せる。理論値・準理論値は、その名前を頭に付ける)
 */
export function WantedList({
  wanted,
  skills,
  onRemove,
}: {
  wanted: Wanted[]
  /** マカフシギ錬金で出るスキルとポイントの範囲 (名前と、理論値かを見るのに使う) */
  skills: SkillInfo[]
  onRemove: (w: Wanted) => void
}) {
  return (
    <ul className="divide-y">
      {groupWanted(wanted).map((group) => (
        <li key={groupKey(group[0])} className="space-y-1.5 py-2.5 first:pt-0 last:pb-0">
          <div className="text-sm font-semibold">{groupTitle(group[0], skills)}</div>
          <div className="flex flex-wrap gap-1.5">
            {group.map((w) => {
              const label = MODE_LABEL[modeOf(w, skills)]
              return (
                <span
                  key={w.id}
                  className="inline-flex items-center gap-1 rounded-full bg-muted py-0.5 pr-1 pl-2.5 text-xs font-semibold tabular-nums"
                >
                  {label}
                  <span className={label ? 'font-normal text-muted-foreground' : undefined}>{conditionText(w)}</span>
                  <button
                    type="button"
                    className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                    onClick={() => onRemove(w)}
                    aria-label="この条件の登録を消す"
                  >
                    <XIcon className="size-3.5" />
                  </button>
                </span>
              )
            })}
          </div>
        </li>
      ))}
    </ul>
  )
}
