import { secondsToShortTime, showFrame } from '@/lib/frame'
import { skillAbbr } from '@/lib/skills'
import type { Charm, SkillInfo } from '@/lib/types'
import { cn } from '@/lib/utils'
import { FPS, type Goseki } from '@/lib/watch'

/** 護石の中身を、スキルとスロットの列に分けて出す。スキルの列は第 1 スキルと第 2 スキルを 2 行に分け、
 * 略称で出す (狭い幅でもフレームの下に時間を出す幅を空けるため。スキル名とポイントは詰める)。
 * span 行ぶん縦に結合する */
function CharmCells({ skills, charm, span }: { skills: SkillInfo[]; charm: Charm; span: number }) {
  return (
    <>
      <td rowSpan={span} className={FIRST}>
        <div>
          {skillAbbr(skills, charm.skill1)}
          {charm.pts1}
        </div>
        {charm.skill2 !== null && (
          <div>
            {skillAbbr(skills, charm.skill2)}
            {charm.pts2}
          </div>
        )}
      </td>
      <td rowSpan={span} className={COLUMN}>
        S{charm.slots}
      </td>
    </>
  )
}

/** スキルより後ろの列。見出しと中身の対応が分かるように、左に薄い線を引く。
 * どの列も中身の幅に詰めて左から並べる (余った幅は右端の空の列が持つ) */
const COLUMN = 'w-px border-l border-border/60 px-1 sm:px-3'

/** 最初の列 (スキル) */
const FIRST = 'w-px pr-1 pl-2 sm:pr-3 sm:pl-3'

/**
 * 錬金枠の表 (ナビの検索結果の表と同じ形): スキル (第 1 と第 2 を 2 行で)・スロット (ここまで錬金枠ごと) と、
 * 当たりフレーム・あと何時間か (狭い幅ではフレームの下に)・鑑定順 (当たりフレームごと)。
 * 錬金枠ごとの列を縦に結合して、錬金枠 1 つに当たりフレームが何行か並ぶ形にする
 */
export function GosekiTable({
  skills,
  gosekis,
  from,
  className,
}: {
  skills: SkillInfo[]
  gosekis: Goseki[]
  /** 現在フレーム (あと何時間かの起点) */
  from: number
  /** 表の枠に足すクラス */
  className?: string
}) {
  const until = (frame: number) => secondsToShortTime((frame - from) / FPS)
  return (
    <div className={cn('overflow-x-auto rounded-lg border', className)}>
      {/* 枠の中でスクロールさせるときも、見出しの行は上に残す */}
      <table className="w-full text-sm whitespace-nowrap tabular-nums [&_td]:py-2 [&_th]:sticky [&_th]:top-0 [&_th]:bg-card [&_th]:pt-2 [&_th]:pb-1.5 [&_th]:text-xs [&_th]:font-normal [&_th]:text-muted-foreground">
        <thead className="border-b">
          <tr>
            {/* 見出しの余白と寄せ方は、下の中身の列と同じにする (縦の位置を揃える) */}
            <th className={cn(FIRST, 'text-left')}>スキル</th>
            {/* 狭い幅では見出しを縮める (中身の S3 より見出しのほうが長く、表がはみ出すので) */}
            <th className={cn(COLUMN, 'text-left')}>
              スロ<span className="hidden sm:inline">ット</span>
            </th>
            {/* フレームと時間は桁がそろうように右寄せ */}
            <th className={cn(COLUMN, 'text-right')}>フレーム</th>
            <th className={cn(COLUMN, 'hidden text-right sm:table-cell')}>あと</th>
            <th className={cn(COLUMN, 'text-left')}>鑑定順</th>
            <th className="w-full" />
          </tr>
        </thead>
        <tbody>
          {gosekis.map((g, i) =>
            g.aims.map((a, j) => (
              // 錬金枠の間にだけ横線を引く
              <tr key={`${g.position}-${g.kind}-${a.frame}-${a.index}`} className={cn(i > 0 && j === 0 && 'border-t')}>
                {j === 0 && <CharmCells skills={skills} charm={g.charm} span={g.aims.length} />}
                <td className={cn(COLUMN, 'text-right')}>
                  {showFrame(a.frame)}
                  {/* 狭い幅では時間の列を出さないので、フレームの下に小さく出す */}
                  <div className="text-xs text-muted-foreground sm:hidden">あと {until(a.frame)}</div>
                </td>
                <td className={cn(COLUMN, 'hidden text-right text-muted-foreground sm:table-cell')}>
                  {until(a.frame)}
                </td>
                <td className={COLUMN}>{a.index}番目</td>
                <td />
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  )
}
