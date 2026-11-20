import { skillName } from './skills'
import type { Charm, Compare, Found, Kind, Melding, PointRange, SkillInfo } from './types'

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
  /** 準理論値も当てる (理論値を「一致」で登録したものにだけ付ける)。理論値に加えて、第 1 スキルが 1 少ない・
   * 第 2 スキルが 1 少ない・スロットが 2 の、どれか 1 つだけ違うものも当たる */
  semi?: boolean
}

/** 条件を、印の付いていない条件の集まりにする (準理論値もなら、理論値と 3 通りの準理論値。出ないポイントのものは外す) */
export function piecesOf(w: Wanted, skills: SkillInfo[]): Wanted[] {
  if (!w.semi) return [w]
  const base = { ...w, semi: false }
  const min1 = skills.find((s) => s.id === w.skill1)?.pts1?.min ?? 1
  return [base, { ...base, pts1: w.pts1! - 1 }, { ...base, pts2: w.pts2! - 1 }, { ...base, slots: 2 }].filter(
    (p) => p.pts1! >= min1 && p.pts2! >= 1,
  )
}

/** 欲しい護石の条件を、wasm の検索に渡す護石の一覧にする。第 1 スキルを問わないときは、第 1 スキルに出るスキル
 * ごとに、その最小のポイント以上で探す (出ない組み合わせは wasm 側で飛ばす)。準理論値もなら、4 通りを並べる */
export function charmsOf(w: Wanted, skills: SkillInfo[]): Charm[] {
  if (w.semi) return piecesOf(w, skills).flatMap((p) => charmsOf(p, skills))
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
  return `${first} ${second} S${w.slots}${suffix} ${MELDING_LABEL[w.melding]}${w.semi ? ' (準理論値も)' : ''}`
}

/** 入れた値がそのまま同じ条件か (id は見ない。当たる範囲で比べるなら covers) */
export const sameWanted = (a: Wanted, b: Wanted) =>
  !a.semi === !b.semi &&
  a.melding === b.melding &&
  a.compare === b.compare &&
  a.skill1 === b.skill1 &&
  a.pts1 === b.pts1 &&
  a.skill2 === b.skill2 &&
  a.pts2 === b.pts2 &&
  a.slots === b.slots

/** ポイントやスロットの範囲 (両端を含む) */
type Span = { lo: number; hi: number }

/** 条件が当たる範囲を、欄ごとに表したもの。スキルの null は「どのスキルでも」、第 2 スキルの 'none' は「付いていない」 */
type Coverage = {
  melding: Melding
  skill1: { skill: number; pts: Span } | null
  skill2: { skill: number; pts: Span } | null | 'none'
  slots: Span
}

/** 条件が当たる範囲 (skills はその錬金で出るスキルとポイントの範囲)。「以上」は指定からその錬金で出る最大まで
 * (指定が最小より小さければ最小から)、「一致」は指定の値だけ */
function coverage(w: Wanted, skills: SkillInfo[]): Coverage {
  const atLeast = w.compare === 'atLeast'
  const span = (pts: number, range: PointRange | null | undefined): Span =>
    atLeast && range ? { lo: Math.max(pts, range.min), hi: range.max } : { lo: pts, hi: pts }
  const info = (id: number) => skills.find((s) => s.id === id)
  return {
    melding: w.melding,
    skill1: w.skill1 === null ? null : { skill: w.skill1, pts: span(w.pts1!, info(w.skill1)?.pts1) },
    skill2:
      w.skill2 === null ? (atLeast ? null : 'none') : { skill: w.skill2, pts: span(w.pts2!, info(w.skill2)?.pts2) },
    slots: atLeast ? { lo: w.slots, hi: 3 } : { lo: w.slots, hi: w.slots },
  }
}

/** 範囲 ca が範囲 cb を欄ごとに含むか (錬金のやり方は呼ぶ側で比べる) */
function boxCovers(ca: Coverage, cb: Coverage): boolean {
  const within = (x: Span, y: Span) => x.lo <= y.lo && y.hi <= x.hi
  const skill = (x: { skill: number; pts: Span }, y: { skill: number; pts: Span }) =>
    x.skill === y.skill && within(x.pts, y.pts)
  const first = ca.skill1 === null || (cb.skill1 !== null && skill(ca.skill1, cb.skill1))
  const second =
    ca.skill2 === null ||
    (ca.skill2 === 'none'
      ? cb.skill2 === 'none'
      : cb.skill2 !== null && cb.skill2 !== 'none' && skill(ca.skill2, cb.skill2))
  return first && second && within(ca.slots, cb.slots)
}

/** 範囲に入る護石を 1 つずつ (どの欄も 1 つの値の範囲) 並べる。スキルを問わない欄があれば並べきれないので null */
function pointsOf(c: Coverage): Coverage[] | null {
  if (c.skill1 === null || c.skill2 === null) return null
  const values = (s: Span) => Array.from({ length: s.hi - s.lo + 1 }, (_, i) => s.lo + i)
  const one = (v: number): Span => ({ lo: v, hi: v })
  const { skill1, skill2 } = c
  const seconds: Coverage['skill2'][] =
    skill2 === 'none' ? ['none'] : values(skill2.pts).map((p) => ({ skill: skill2.skill, pts: one(p) }))
  return values(skill1.pts).flatMap((p1) =>
    seconds.flatMap((s2) =>
      values(c.slots).map((s) => ({
        melding: c.melding,
        skill1: { skill: skill1.skill, pts: one(p1) },
        skill2: s2,
        slots: one(s),
      })),
    ),
  )
}

/**
 * a の条件が、b の条件で当たる護石を全部当てるか (b が a に含まれるか。同じ範囲なら互いに含む)。欄ごとに範囲を比べる。
 * 準理論値もの条件は 4 通りの集まりとして比べる (a がそうなら、b に当たる護石を 1 つずつ並べて、どれかに入るかを見る)。
 * skills は錬金のやり方ごとの、出るスキルとポイントの範囲 (「以上」の範囲の端に使う)
 */
export function covers(a: Wanted, b: Wanted, skills: Record<Melding, SkillInfo[]>): boolean {
  if (a.melding !== b.melding) return false
  const info = skills[a.melding]
  const boxes = piecesOf(a, info).map((p) => coverage(p, info))
  return piecesOf(b, info).every((pb) => {
    const cb = coverage(pb, info)
    if (boxes.length === 1) return boxCovers(boxes[0], cb)
    const points = pointsOf(cb)
    return points !== null && points.every((p) => boxes.some((box) => boxCovers(box, p)))
  })
}

/** 条件をスキルとスロットの札にする (「痛撃6以上」「第2問わず」「S3以上」) */
export function wantedChips(w: Wanted, skills: SkillInfo[]): string[] {
  const atLeast = w.compare === 'atLeast'
  const suffix = atLeast ? '以上' : ''
  return [
    w.skill1 === null ? '第1問わず' : `${skillName(skills, w.skill1)}${w.pts1}${suffix}`,
    w.skill2 === null ? (atLeast ? '第2問わず' : '第2なし') : `${skillName(skills, w.skill2)}${w.pts2}${suffix}`,
    `S${w.slots}${suffix}`,
    ...(w.semi ? ['準理論値も'] : []),
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
