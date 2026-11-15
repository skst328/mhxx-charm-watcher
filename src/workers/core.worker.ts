// 検索を、画面を止めずに行う Worker。依頼は届いた順に 1 つずつ処理する
import init, {
  rewardSkillInfo,
  search,
  searchRewards,
  skillInfo,
  type Charm,
  type Compare,
  type Found,
  type Kind,
  type Melding,
  type RewardCharm,
  type SkillInfo,
} from '../../watcher-core/pkg/watcher_core.js'

export type WorkerRequest =
  | {
      id: number
      type: 'search'
      melding: Melding
      charms: Charm[]
      kinds: Kind[]
      compare: Compare
      start: number
      end: number
    }
  /** クエスト報酬で鑑定した護石から、鑑定したフレームを探す */
  | { id: number; type: 'rewards'; charms: RewardCharm[]; start: number; end: number }
  /** 検索の中止。区切りの合間に受け付ける */
  | { id: number; type: 'cancel'; target: number }

export type WorkerResponse =
  /** 錬金のやり方ごとと、クエスト報酬のお守りの種類ごとの、出うるスキルとポイントの範囲 */
  | { type: 'ready'; skills: Record<Melding, SkillInfo[]>; rewardSkills: Record<Kind, SkillInfo[]> }
  | { type: 'failed'; message: string }
  /** truncated: LIMIT 件で打ち切った */
  | { id: number; type: 'search'; found: Found[]; truncated: boolean }
  | { id: number; type: 'rewards'; frames: number[]; truncated: boolean }
  | { id: number; type: 'progress'; done: number; total: number }
  | { id: number; type: 'cancelled' }
  | { id: number; type: 'error'; message: string }

/** 範囲をこの数ずつ探し、区切りごとに進み具合を送る */
const CHUNK = 2_000_000
/** 見つけたものがこの数を超えたら打ち切る (条件がゆるいと何百万件も出るので) */
const LIMIT = 1000

const post = (message: WorkerResponse) => self.postMessage(message)

const KINDS: Kind[] = ['weathered', 'worn', 'shining', 'mystery']

const ready = init().then(() =>
  post({
    type: 'ready',
    skills: { juju: skillInfo('juju'), halcyon: skillInfo('halcyon') },
    rewardSkills: Object.fromEntries(KINDS.map((k) => [k, rewardSkillInfo(k)])) as Record<Kind, SkillInfo[]>,
  }),
)
ready.catch((e: unknown) => post({ type: 'failed', message: e instanceof Error ? e.message : String(e) }))

const cancelled = new Set<number>()

async function handle(request: WorkerRequest): Promise<void> {
  await ready
  switch (request.type) {
    case 'search': {
      const { id, melding, charms, kinds, compare, start, end } = request
      const found: Found[] = []
      for (let a = start; a < end; a = Math.min(a + CHUNK, end)) {
        if (cancelled.delete(id)) {
          post({ id, type: 'cancelled' })
          return
        }
        // 足りない分だけ受け取る (結果は乱数の位置の順なので、LIMIT 件を超えた分は要らない)
        found.push(...search(melding, charms, kinds, compare, a, Math.min(a + CHUNK, end), LIMIT - found.length))
        if (found.length >= LIMIT) {
          post({ id, type: 'search', found: found.slice(0, LIMIT), truncated: true })
          return
        }
        post({ id, type: 'progress', done: Math.min(a + CHUNK, end) - start, total: end - start })
        // 区切りの合間に、中止のメッセージを受け取れるようにする
        await new Promise((r) => setTimeout(r))
      }
      post({ id, type: 'search', found, truncated: false })
      return
    }
    case 'rewards': {
      const { id, charms, start, end } = request
      const frames: number[] = []
      for (let a = start; a < end; a = Math.min(a + CHUNK, end)) {
        if (cancelled.delete(id)) {
          post({ id, type: 'cancelled' })
          return
        }
        frames.push(...searchRewards(charms, a, Math.min(a + CHUNK, end), LIMIT - frames.length))
        if (frames.length >= LIMIT) {
          post({ id, type: 'rewards', frames: frames.slice(0, LIMIT), truncated: true })
          return
        }
        post({ id, type: 'progress', done: Math.min(a + CHUNK, end) - start, total: end - start })
        await new Promise((r) => setTimeout(r))
      }
      post({ id, type: 'rewards', frames, truncated: false })
      return
    }
  }
}

let queue = Promise.resolve()

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data
  if (request.type === 'cancel') {
    cancelled.add(request.target)
    return
  }
  queue = queue.then(() =>
    handle(request).catch((e: unknown) =>
      post({ id: request.id, type: 'error', message: e instanceof Error ? e.message : String(e) }),
    ),
  )
}
