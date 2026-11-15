// ページ側から Worker (src/workers/core.worker.ts) に検索を頼む
import type { WorkerRequest, WorkerResponse } from '../workers/core.worker'
import type { Charm, Compare, Found, Kind, Melding, RewardCharm, SkillInfo } from './types'
import { AIM_LEAD, charmsOf, gosekiIn, HOUR, KINDS, type Goseki, type Wanted } from './watch'

/** 錬金のやり方ごとの、出うるスキルとポイントの範囲 */
export type MeldingSkills = Record<Melding, SkillInfo[]>
/** クエスト報酬のお守りの種類ごとの、出うるスキルとポイントの範囲 (第 2 スキルはマイナスを含む) */
export type RewardSkills = Record<Kind, SkillInfo[]>

/** Worker の準備ができたときに受け取るもの */
type Ready = { melding: MeldingSkills; reward: RewardSkills }

/** 頼む内容 (id は call が付ける) */
type Request = WorkerRequest extends infer R ? (R extends unknown ? Omit<R, 'id'> : never) : never

type Pending = {
  resolve: (value: WorkerResponse) => void
  reject: (error: Error) => void
  onProgress?: (done: number, total: number) => void
}

let worker: Worker | null = null
let skillsReady: Promise<Ready> | null = null
const pending = new Map<number, Pending>()
let nextId = 1

function start(): Promise<Ready> {
  if (skillsReady) return skillsReady
  skillsReady = new Promise((resolveSkills, rejectSkills) => {
    worker = new Worker(new URL('../workers/core.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data
      if (message.type === 'ready') {
        resolveSkills({ melding: message.skills, reward: message.rewardSkills })
        return
      }
      if (message.type === 'failed') {
        rejectSkills(new Error(`準備に失敗しました (${message.message})`))
        return
      }
      const p = pending.get(message.id)
      if (!p) return
      if (message.type === 'progress') {
        p.onProgress?.(message.done, message.total)
        return
      }
      pending.delete(message.id)
      if (message.type === 'error') p.reject(new Error(message.message))
      else if (message.type === 'cancelled') p.reject(new DOMException('中止しました', 'AbortError'))
      else p.resolve(message)
    }
    worker.onerror = (event) => rejectSkills(new Error(event.message || '準備に失敗しました'))
  })
  return skillsReady
}

function call(
  request: Request,
  options: { onProgress?: Pending['onProgress']; signal?: AbortSignal } = {},
): Promise<WorkerResponse> {
  return start().then(
    () =>
      new Promise((resolve, reject) => {
        const id = nextId++
        pending.set(id, { resolve, reject, onProgress: options.onProgress })
        options.signal?.addEventListener(
          'abort',
          () => worker!.postMessage({ id: nextId++, type: 'cancel', target: id }),
          {
            once: true,
          },
        )
        worker!.postMessage({ ...request, id } as WorkerRequest)
      }),
  )
}

/** wasm を読み込み、錬金のやり方ごとに出るスキルとポイントの範囲を返す */
export function loadSkills(): Promise<MeldingSkills> {
  return start().then((r) => r.melding)
}

/** wasm を読み込み、クエスト報酬のお守りの種類ごとに出るスキルとポイントの範囲を返す */
export function loadRewardSkills(): Promise<RewardSkills> {
  return start().then((r) => r.reward)
}

/** 位置 [start, end) で「鑑定する」を押すと、クエスト報酬で鑑定した charms が 1 個目から順に出るフレーム
 * (小さい順。多すぎれば打ち切る) */
export async function searchRewards(
  charms: RewardCharm[],
  start: number,
  end: number,
): Promise<{ frames: number[]; truncated: boolean }> {
  const r = await call({ type: 'rewards', charms, start, end })
  if (r.type !== 'rewards') throw new Error('検索の応答が不正')
  return { frames: r.frames, truncated: r.truncated }
}

/** 位置 [start, end) で、melding の錬金で compare の比べ方で charms のどれかに合う護石を、kinds のどれかの
 * 種類のお守りとして探す (位置の小さい順。多すぎれば打ち切る) */
export async function searchCharms(
  melding: Melding,
  charms: Charm[],
  kinds: Kind[],
  compare: Compare,
  start: number,
  end: number,
  options: { onProgress?: (done: number, total: number) => void; signal?: AbortSignal } = {},
): Promise<{ found: Found[]; truncated: boolean }> {
  const r = await call({ type: 'search', melding, charms, kinds, compare, start, end }, options)
  if (r.type !== 'search') throw new Error('検索の応答が不正')
  return { found: r.found, truncated: r.truncated }
}

/** 調べた結果: 範囲の中の錬金枠 (多すぎて打ち切ったら truncated)。出ない組み合わせなどは error */
export type WatchResult = { gosekis: Goseki[]; truncated: boolean } | { error: string }

/** 欲しい護石が、from から hours 時間先までのどの錬金枠に出るかを探す */
export async function watch(
  w: Wanted,
  meldingSkills: MeldingSkills,
  from: number,
  hours: number,
): Promise<WatchResult> {
  const to = from + hours * HOUR
  try {
    // 当たりフレームは錬金枠の位置より手前なので、錬金枠は少し先まで探す
    const { found, truncated } = await searchCharms(
      w.melding,
      charmsOf(w, meldingSkills[w.melding]),
      KINDS[w.melding],
      w.compare,
      from,
      to + AIM_LEAD,
    )
    return { gosekis: gosekiIn(found, from, to), truncated }
  } catch (e) {
    // 出ない組み合わせなら、1 行目が見出し (2 行目からの種類ごとの理由は、ここでは出さない)
    return { error: (e as Error).message.split('\n')[0] }
  }
}

/** 欲しい護石がその錬金で出うるか。出なければ理由の文 (1 行目が見出し、2 行目から種類ごとの理由)。
 * 出ない組み合わせは探す前に分かるので、1 フレームだけ探して確かめる */
export async function impossibleReason(w: Wanted, meldingSkills: MeldingSkills): Promise<string | null> {
  try {
    await searchCharms(w.melding, charmsOf(w, meldingSkills[w.melding]), KINDS[w.melding], w.compare, 0, 1)
    return null
  } catch (e) {
    return (e as Error).message
  }
}
