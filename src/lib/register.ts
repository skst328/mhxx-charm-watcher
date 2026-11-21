// 欲しい護石の登録の判断 (フォームと、有名な理論値護石のボタンから使う)
import type { Compare, SkillInfo } from './types'
import { covers, EXPAND_LIMIT, expandAtLeast, semisOf, theoryOf, type Wanted, type WantedMode } from './watch'

/** 登録フォームの欄の値 (ポイント・スロット・比べ方はカスタムのときだけ使う) */
export interface RegisterInput {
  mode: WantedMode
  skill1: number | null
  skill2: number | null
  compare: Compare
  pts1: number | null
  pts2: number | null
  slots: number
}

/** 登録の見込み */
export interface RegisterPlan {
  /** 選んだ組み合わせの理論値 (両方のスキルを決めていなければ null) */
  theory: Omit<Wanted, 'id'> | null
  /** 登録する一致の条件 (id は空。登録するときに付ける) */
  drafts: Wanted[]
  /** drafts のそれぞれが、登録済みの条件に含まれる (同じ範囲のものも。所持済みの条件も登録済みに数える) か */
  registered: boolean[]
  /** drafts のそれぞれが、所持済みの条件に含まれるか */
  owned: boolean[]
  /** 「以上」の範囲が広すぎて、展開すると EXPAND_LIMIT 件を超える */
  tooMany: boolean
  /** 欄がそろっていて登録できる形か (登録済みかは見ない) */
  ready: boolean
  /** まだ登録していない条件 (登録ボタンで足すもの) */
  pending: Wanted[]
  /** 1 つだけ登録しようとしていて、それが登録済みのもっと広い条件 (前に「以上」で登録したもの) に含まれるなら、
   * その条件 (知らせに出す) */
  widerBy: Wanted | undefined
}

/**
 * 欄の値から、登録する一致の条件と、登録済みとの関係を出す。登録するのはいつも一致の条件で、準理論値を含むは理論値と
 * 3 通りの準理論値、カスタムの「以上」は範囲の一致の条件に展開する。重なる登録は操作ミスとみなし、
 * 登録済みの条件に含まれる (同じ範囲のものも) ものは登録しない。所持済みの条件も登録は残っているので、登録済みに数える。
 * 登録するのは一致の条件なので、それに含まれる登録済みの条件は同じものしかなく、まとめて消すものは出ない
 */
export function planRegistration(input: RegisterInput, wanted: Wanted[], skills: SkillInfo[]): RegisterPlan {
  const { mode, skill1, skill2, compare, pts1, pts2, slots } = input
  const theory = theoryOf(skill1, skill2, skills)
  const drafts: Wanted[] = (
    theory === null
      ? []
      : mode === 'custom'
        ? compare === 'atLeast'
          ? expandAtLeast({ skill1, pts1, skill2, pts2, slots }, skills)
          : [{ compare: 'exact' as const, skill1, pts1, skill2, pts2, slots }]
        : [theory, ...(mode === 'semi' ? semisOf(theory, skills) : [])]
  ).map((d) => ({ ...d, id: '' }))
  const tooMany = drafts.length > EXPAND_LIMIT
  const ready = drafts.length > 0 && !tooMany && drafts.every((d) => d.pts1 !== null && d.pts2 !== null)
  const coveredBy = (d: Wanted) => wanted.find((w) => covers(w, d, skills))
  const registered = drafts.map((d) => coveredBy(d) !== undefined)
  const owned = drafts.map((d) => wanted.some((w) => w.owned && covers(w, d, skills)))
  const pending = ready ? drafts.filter((_, i) => !registered[i]) : []
  const single = ready && drafts.length === 1 ? coveredBy(drafts[0]) : undefined
  const widerBy = single && !covers(drafts[0], single, skills) ? single : undefined
  return { theory, drafts, registered, owned, tooMany, ready, pending, widerBy }
}

/**
 * 有名な理論値護石 (famous) のうち、まだ登録していないもの (id は空)。semi なら、それぞれの 3 通りの準理論値も。
 * 登録済みの条件に含まれるもの (同じ範囲のものも。所持済みのものも) は登録済みとみなす
 */
export function famousToAdd(
  famous: Omit<Wanted, 'id'>[],
  semi: boolean,
  wanted: Wanted[],
  skills: SkillInfo[],
): Wanted[] {
  return famous
    .flatMap((f) => [f, ...(semi ? semisOf(f, skills) : [])])
    .map((f) => ({ ...f, id: '' }))
    .filter((f) => !wanted.some((w) => covers(w, f, skills)))
}
