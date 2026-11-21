import { useState } from 'react'
import { ChevronDownIcon, ChevronUpIcon, LoaderCircleIcon } from 'lucide-react'

import { GosekiTable } from '@/components/goseki-table'
import { HourGrid } from '@/components/hour-grid'
import { Button } from '@/components/ui/button'
import { watchEach, type WatchResult } from '@/lib/core'
import { roughTime } from '@/lib/frame'
import type { SkillInfo } from '@/lib/types'
import { cn } from '@/lib/utils'
import {
  DETAIL_HOURS,
  FPS,
  GRID_HOURS,
  HOUR,
  hourlyAims,
  MODE_LABEL,
  modeOf,
  REACH_HOURS,
  wantedText,
  type Wanted,
} from '@/lib/watch'

/**
 * 欲しい護石 (一致の条件) 1 つぶん: 条件 (理論値・準理論値はその名前も)、次に錬金できるまでの時間、
 * 3 日ぶんの当たりのマス、詳細 (10 日ぶんの錬金枠の表)。詳細は開いたときに探す (ふだんは 3 日ぶんだけで軽く済ませる)
 */
export function WantedCard({
  wanted: w,
  skills,
  from,
  result,
}: {
  wanted: Wanted
  /** マカフシギ錬金で出るスキルとポイントの範囲 (名前を出すのと、詳細を探すのに使う) */
  skills: SkillInfo[]
  /** 調べたときの現在フレーム。まだ調べていなければ null */
  from: number | null
  result: WatchResult | undefined
}) {
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<WatchResult | null>(null)
  const [loading, setLoading] = useState(false)

  const gosekis = result && 'gosekis' in result ? result.gosekis : null
  const next = gosekis?.[0]?.aims[0]
  const label = MODE_LABEL[modeOf(w, skills)]

  const toggle = async () => {
    if (open) {
      setOpen(false)
      return
    }
    setOpen(true)
    if (detail !== null || from === null) return
    setLoading(true)
    setDetail((await watchEach([w], skills, from, DETAIL_HOURS))[w.id])
    setLoading(false)
  }

  return (
    <li className="space-y-2 rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {label && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">{label}</span>}
        <span className="font-semibold tabular-nums">{wantedText(w, skills)}</span>
      </div>

      {result === undefined || from === null ? (
        <p className="text-sm text-muted-foreground">まだ更新していません</p>
      ) : 'error' in result ? (
        <p className="text-sm text-destructive">{result.error}</p>
      ) : (
        <>
          {/* 次の当たりまでの時間を大きく出す。届く範囲なら、マスの枠と同じ緑にする。
              3 日以内に出なければ、マスが空なので「—」だけ */}
          <div>
            <div className="text-xs text-muted-foreground">次の当たりまで</div>
            <div
              className={cn(
                'text-3xl leading-tight font-bold tabular-nums',
                next === undefined && 'text-muted-foreground',
                next !== undefined && next.frame - from < REACH_HOURS * HOUR && 'text-success',
              )}
            >
              {next === undefined ? '—' : <BigTime seconds={(next.frame - from) / FPS} />}
            </div>
          </div>
          <HourGrid counts={hourlyAims(result.gosekis, from, GRID_HOURS)} reach={REACH_HOURS} />
          {/* 詳細はマスの下に横幅いっぱいで置き、開くと表がこのすぐ下に出る */}
          <Button variant="outline" size="sm" className="w-full" onClick={toggle}>
            {open ? <ChevronUpIcon /> : <ChevronDownIcon />}
            {open ? '詳細を閉じる' : '10日先までの詳細'}
          </Button>
        </>
      )}

      {open &&
        (loading || detail === null ? (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <LoaderCircleIcon className="size-4 animate-spin" />
            10日先まで探しています
          </p>
        ) : 'error' in detail ? (
          <p className="text-sm text-destructive">{detail.error}</p>
        ) : detail.gosekis.length === 0 ? (
          <p className="text-sm text-muted-foreground">10日先までに出ない</p>
        ) : (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground tabular-nums">
              10日先までに {detail.gosekis.length} 枠{detail.truncated && ' (多すぎるので途中まで)'}
            </p>
            {/* 狭い幅では、表が収まるようにカードの内側の余白まで広げる。錬金枠が多いとページが長くなりすぎるので、
                高さを決めて表の中でスクロールさせる */}
            <GosekiTable
              skills={skills}
              gosekis={detail.gosekis}
              from={from!}
              className="-mx-3 max-h-96 overflow-y-auto rounded-none border-x-0 sm:mx-0 sm:rounded-lg sm:border-x"
            />
          </div>
        ))}
    </li>
  )
}

/** ざっくりした時間 (「1h 11m」) を、数字は大きく、単位は小さく出す */
function BigTime({ seconds }: { seconds: number }) {
  return (
    <>
      {[...roughTime(seconds).matchAll(/(\d+)([a-z])/g)].map(([, n, unit], i) => (
        <span key={i} className={cn(i > 0 && 'ml-1.5')}>
          {n}
          <span className="ml-0.5 text-base font-semibold">{unit}</span>
        </span>
      ))}
    </>
  )
}
