import type { Kind, RewardCharm } from './types'

/** 鑑定した護石の名前とレア度 (名前を見ればレア度が分かり、レア度で元のお守りの種類も決まる) */
export const GOSEKI: { rarity: number; name: string }[] = [
  { rarity: 1, name: '兵士の護石' },
  { rarity: 2, name: '闘士の護石' },
  { rarity: 3, name: '騎士の護石' },
  { rarity: 4, name: '城塞の護石' },
  { rarity: 5, name: '女王の護石' },
  { rarity: 6, name: '王の護石' },
  { rarity: 7, name: '龍の護石' },
  { rarity: 8, name: '英雄の護石' },
  { rarity: 9, name: '伝説の護石' },
  { rarity: 10, name: '天の護石' },
]

/** レア度から、元のお守りの種類 (1〜2 なぞ、3〜4 光る、5〜7 古びた、8〜10 風化) */
export function kindOf(rarity: number): Kind {
  return rarity <= 2 ? 'mystery' : rarity <= 4 ? 'shining' : rarity <= 7 ? 'worn' : 'weathered'
}

/** 入力中の鑑定した護石 1 個。まだ選んでいない欄は null (第 2 スキルの null はなし) */
export interface RewardDraft {
  rarity: number | null
  skill1: number | null
  pts1: number | null
  skill2: number | null
  pts2: number | null
  slots: number
}

export const emptyDraft = (): RewardDraft => ({
  rarity: null,
  skill1: null,
  pts1: null,
  skill2: null,
  pts2: null,
  slots: 0,
})

/** 入力を検索に渡す形にする。まだ選んでいない欄があれば null */
export function rewardCharmOf(d: RewardDraft): RewardCharm | null {
  if (d.rarity === null || d.skill1 === null || d.pts1 === null) return null
  if (d.skill2 !== null && d.pts2 === null) return null
  const second = d.skill2 === null ? { skill2: null, pts2: null } : { skill2: d.skill2, pts2: d.pts2 }
  return { rarity: d.rarity, charm: { skill1: d.skill1, pts1: d.pts1, ...second, slots: d.slots } }
}

/** 第 2 スキルのポイントの選択肢から 0 を外す (0 ポイントは画面に出ず、第 2 スキルなしに見えるので) */
export const withoutZero = (points: number[]) => points.filter((p) => p !== 0)

/** 探す長さ (時間) の選択肢 */
export const WINDOW_HOURS = [1, 3, 12, 24, 72, 168]

/** 探す長さの表示 (「3時間」「1日」「7日」) */
export const windowLabel = (hours: number) => (hours < 24 ? `${hours}時間` : `${hours / 24}日`)
