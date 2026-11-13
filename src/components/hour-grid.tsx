import { shade } from '@/lib/watch'
import { cn } from '@/lib/utils'

/** 濃さ 1〜4 の塗り (0 は当たりなし) */
const FILL = ['bg-muted', 'bg-primary/30', 'bg-primary/50', 'bg-primary/75', 'bg-primary']

/**
 * 1 時間ごとの当たりフレームの数を、GitHub の草のようなマスに並べる。行が 24 時間 (0d, 1d, …)、列が時間 (0h〜23h)。
 * 当たりフレームが多い時間ほど濃い。届く範囲 (reach 時間) のマスには枠を付ける。マスは幅に合わせて伸び縮みする
 */
export function HourGrid({ counts, reach }: { counts: number[]; reach: number }) {
  const days = Math.ceil(counts.length / 24)
  return (
    <div className="grid grid-cols-[auto_repeat(24,minmax(0,1fr))] items-center gap-0.5 text-[9px] leading-none text-muted-foreground tabular-nums">
      {/* 目盛り: 6 時間ごと */}
      <span />
      {[0, 6, 12, 18].map((h) => (
        <span key={h} className="col-span-6 pb-0.5">
          {h}h
        </span>
      ))}
      {Array.from({ length: days }, (_, d) => (
        <div key={d} className="contents">
          <span className="pr-1">{d}d</span>
          {counts.slice(d * 24, d * 24 + 24).map((n, h) => (
            <span
              key={h}
              className={cn(
                'aspect-square rounded-[2px]',
                FILL[shade(n)],
                d * 24 + h < reach && 'outline outline-success/60',
              )}
              title={n > 0 ? `${d}d ${h}h 台: 当たりフレーム ${n}` : undefined}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
