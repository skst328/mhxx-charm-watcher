import { Trash2Icon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { SkillInfo } from '@/lib/types'
import { MELDING_LABEL, wantedChips, type Wanted } from '@/lib/watch'

/** 札の右に置く、登録を消すボタン (押したら確かめてから消す) */
export function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      className="text-muted-foreground"
      onClick={onClick}
      aria-label="この護石の登録を消す"
    >
      <Trash2Icon />
    </Button>
  )
}

/** 欲しい護石の条件と錬金のやり方を、同じ見た目の札で並べる (登録の一覧と、ウォッチタブのカードで使う) */
export function WantedChips({ wanted, skills }: { wanted: Wanted; skills: SkillInfo[] }) {
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
      {[...wantedChips(wanted, skills), MELDING_LABEL[wanted.melding]].map((c, i) => (
        <span key={i} className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">
          {c}
        </span>
      ))}
    </div>
  )
}
