import { FPS } from './watch'

/** 秒を短い時間の表記にする (「3h 12m 05s」。0 の上の単位は省き、先頭より後ろの単位は 2 桁にそろえる。秒は四捨五入) */
export function secondsToShortTime(seconds: number): string {
  return shortUnits(dayUnits(Math.round(seconds)))
}

/** フレームを短い時間の表記にする (「5d 19h 31m 50s 20f」。secondsToShortTime の後ろにフレームを付けたもの) */
export function frameToShortTime(frame: number): string {
  return shortUnits([...dayUnits(Math.floor(frame / FPS)), [frame % FPS, 'f']])
}

/** 秒 (整数) を日・時・分・秒に分ける */
const dayUnits = (s: number): [number, string][] => [
  [Math.floor(s / 86400), 'd'],
  [Math.floor(s / 3600) % 24, 'h'],
  [Math.floor(s / 60) % 60, 'm'],
  [s % 60, 's'],
]

/** 単位を並べる。0 の上の単位は省き (全部 0 なら最後の単位だけ)、先頭より後ろの単位は 2 桁にそろえる */
function shortUnits(parts: [number, string][]): string {
  const first = parts.findIndex(([v]) => v > 0)
  const shown = first < 0 ? parts.slice(-1) : parts.slice(first)
  return shown.map(([v, u], i) => `${i === 0 ? v : String(v).padStart(2, '0')}${u}`).join(' ')
}

/** 秒を、いちばん上の単位とその次の単位だけでざっくり表す (「1d 21h」「2h 45m」「6m」。分は切り捨て) */
export function roughTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  if (m < 60) return `${m}m`
  if (m < 1440) return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
  return `${Math.floor(m / 1440)}d ${String(Math.floor(m / 60) % 24).padStart(2, '0')}h`
}

/** フレームの番号として読めれば数、読めなければ null (0 以上の整数。カンマと前後の空白は無視する。
 * 数として正確に扱えない大きさは null) */
export function parseFrame(text: string): number | null {
  const t = text.replaceAll(',', '').trim()
  if (!/^\d+$/.test(t)) return null
  const n = Number(t)
  return Number.isSafeInteger(n) ? n : null
}

/** フレームの表示 (桁区切りはしない。区切りたくなったらここで変える) */
export const showFrame = (frame: number) => String(frame)
