import { XIcon } from 'lucide-react'

import { OwnedCrownIcon } from '@/components/owned-crown-icon'

import type { SkillInfo } from '@/lib/types'
import { cn } from '@/lib/utils'
import { conditionText, groupKey, groupTitle, groupWanted, MODE_LABEL, modeOf, type Wanted } from '@/lib/watch'

/**
 * 登録した護石の一覧: 第 1 スキル × 第 2 スキルの組み合わせでまとめ、その中に登録されているポイントとスロットの
 * 条件を札で並べる (理論値・準理論値は、その名前を頭に付ける)。札を押すと所持済みの切り替え
 * (所持済みはチェックを付けて薄く出す)、× で登録を消す
 */
export function WantedList({
  wanted,
  skills,
  onToggleOwned,
  onRemove,
}: {
  wanted: Wanted[]
  /** マカフシギ錬金で出るスキルとポイントの範囲 (名前と、理論値かを見るのに使う) */
  skills: SkillInfo[]
  onToggleOwned: (w: Wanted) => void
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
                  className={cn(
                    'inline-flex items-center rounded-full bg-muted pr-1 text-xs font-semibold tabular-nums',
                    w.owned && 'opacity-50',
                  )}
                >
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full py-0.5 pl-2.5"
                    onClick={() => onToggleOwned(w)}
                    aria-pressed={!!w.owned}
                    aria-label={`${label ?? ''} ${conditionText(w)} を所持済みにする`}
                  >
                    {w.owned && <OwnedCrownIcon jewel className="size-3.5 fill-warning text-warning" />}
                    {label}
                    <span className={label ? 'font-normal text-muted-foreground' : undefined}>{conditionText(w)}</span>
                  </button>
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
