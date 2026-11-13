import { skillName } from './skills'
import type { Charm, Compare, Found, Kind, Melding, SkillInfo } from './types'

/** ゲームの 1 秒のフレーム数 */
export const FPS = 30
/** 1 時間のフレーム数 */
export const HOUR = FPS * 3600

/** ふだん見る長さ (時間)。3 日 × 24 時間のマスに並べる */
export const GRID_HOURS = 72
/** 詳細で見る長さ (時間)。10 日ぶん */
export const DETAIL_HOURS = 240
/** 届く範囲 (時間)。マスに枠を付ける */
export const REACH_HOURS = 3

/** 錬金のやり方の名前 (遊んでいる人にはこれで通じる短い呼び方) */
export const MELDING_LABEL: Record<Melding, string> = {
  juju: 'マカ',
  halcyon: '天運',
}

/** 錬金のやり方ごとの、出るお守りの種類 (欲しい護石はこのどれかとして出るものを探す) */
export const KINDS: Record<Melding, Kind[]> = {
  juju: ['weathered', 'worn'],
  halcyon: ['worn', 'shining', 'mystery'],
}

/**
 * 欲しい護石の条件。比べ方が「以上」なら、ポイントとスロットはその値以上で、第 1・第 2 スキルの null は問わない。
 * 「一致」なら中身が同じで、第 2 スキルの null はなし
 */
export interface Wanted {
  id: string
  melding: Melding
  compare: Compare
  skill1: number | null
  pts1: number | null
  skill2: number | null
  pts2: number | null
  slots: number
}

/** 欲しい護石の条件を、wasm の検索に渡す護石の一覧にする。第 1 スキルを問わないときは、第 1 スキルに出るスキル
 * ごとに、その最小のポイント以上で探す (出ない組み合わせは wasm 側で飛ばす) */
export function charmsOf(w: Wanted, skills: SkillInfo[]): Charm[] {
  const second = { skill2: w.skill2, pts2: w.skill2 === null ? null : w.pts2, slots: w.slots }
  if (w.skill1 === null) {
    return skills.flatMap((s) => (s.pts1 ? [{ skill1: s.id, pts1: s.pts1.min, ...second }] : []))
  }
  return [{ skill1: w.skill1, pts1: w.pts1!, ...second }]
}

/** 条件を 1 行の文にする (「痛撃6以上 第2問わず S3以上 マカ」) */
export function wantedText(w: Wanted, skills: SkillInfo[]): string {
  const atLeast = w.compare === 'atLeast'
  const suffix = atLeast ? '以上' : ''
  const first = w.skill1 === null ? '第1問わず' : `${skillName(skills, w.skill1)}${w.pts1}${suffix}`
  const second =
    w.skill2 === null ? (atLeast ? '第2問わず' : '第2なし') : `${skillName(skills, w.skill2)}${w.pts2}${suffix}`
  return `${first} ${second} S${w.slots}${suffix} ${MELDING_LABEL[w.melding]}`
}

/** 同じ条件か (id は見ない。同じ条件を 2 度登録させないため) */
export const sameWanted = (a: Wanted, b: Wanted) =>
  a.melding === b.melding &&
  a.compare === b.compare &&
  a.skill1 === b.skill1 &&
  a.pts1 === b.pts1 &&
  a.skill2 === b.skill2 &&
  a.pts2 === b.pts2 &&
  a.slots === b.slots

/** 条件をスキルとスロットの札にする (「痛撃6以上」「第2問わず」「S3以上」) */
export function wantedChips(w: Wanted, skills: SkillInfo[]): string[] {
  const atLeast = w.compare === 'atLeast'
  const suffix = atLeast ? '以上' : ''
  return [
    w.skill1 === null ? '第1問わず' : `${skillName(skills, w.skill1)}${w.pts1}${suffix}`,
    w.skill2 === null ? (atLeast ? '第2問わず' : '第2なし') : `${skillName(skills, w.skill2)}${w.pts2}${suffix}`,
    `S${w.slots}${suffix}`,
  ]
}

/** 当たりフレーム: 錬金するフレームと、鑑定の何番目に出るか */
export interface Aim {
  frame: number
  index: number
}

/** 錬金枠: 欲しい護石が作られる乱数の位置 1 つ。中身と種類と、そこに届く当たりフレーム (フレームの小さい順) */
export interface Goseki {
  position: number
  charm: Charm
  kind: Kind
  aims: Aim[]
}

/** 当たりフレームは、錬金枠の位置より最大これだけ手前になる (天運の錬金。マカは 18) */
export const AIM_LEAD = 30

/**
 * 見つかったものから、当たりフレームが [from, to) にあるものだけを残した錬金枠の一覧 (最初の当たりフレームの順)。
 * 当たりフレームは錬金枠の位置より手前なので、探す範囲は to + AIM_LEAD まで取っておくこと
 */
export function gosekiIn(found: Found[], from: number, to: number): Goseki[] {
  return found
    .map((f) => ({
      position: f.position,
      charm: f.charm,
      kind: f.kind,
      aims: f.aimpoints.filter((a) => a.start >= from && a.start < to).map((a) => ({ frame: a.start, index: a.index })),
    }))
    .filter((g) => g.aims.length > 0)
    .sort((a, b) => a.aims[0].frame - b.aims[0].frame)
}

/** from から 1 時間ごとの、当たりフレームの数 (hours 時間ぶん) */
export function hourlyAims(gosekis: Goseki[], from: number, hours: number): number[] {
  const counts = Array<number>(hours).fill(0)
  for (const g of gosekis) {
    for (const a of g.aims) {
      const h = Math.floor((a.frame - from) / HOUR)
      if (h >= 0 && h < hours) counts[h]++
    }
  }
  return counts
}

/** 当たりフレームの数をマスの濃さ 0〜4 にする (GitHub の草と同じく 4 段階。0 は当たりなし) */
export const shade = (n: number) => (n === 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : n <= 4 ? 3 : 4)
