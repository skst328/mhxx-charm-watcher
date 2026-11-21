// 条件ごとに、どの錬金枠に出るかを探す (検索そのものは受け取った関数に任せる。本物は core.ts の searchCharms)
import type { Charm, Compare, Found, SkillInfo } from './types'
import { AIM_LEAD, charmsOf, gosekiIn, groupWanted, HOUR, matches, type Goseki, type Wanted } from './watch'

/** 位置 [start, end) で、compare の比べ方で charms のどれかに合う護石を探す (位置の小さい順。多すぎれば打ち切る) */
export type Search = (
  charms: Charm[],
  compare: Compare,
  start: number,
  end: number,
) => Promise<{ found: Found[]; truncated: boolean }>

/** 調べた結果: 範囲の中の錬金枠 (多すぎて打ち切ったら truncated)。出ない組み合わせなどは error */
export type WatchResult = { gosekis: Goseki[]; truncated: boolean } | { error: string }

/** 比べ方が compare の条件 (ws) のどれかに当たる護石が、from から hours 時間先までのどの錬金枠に出るかを探す */
async function watchCharms(
  search: Search,
  ws: Wanted[],
  compare: Compare,
  skills: SkillInfo[],
  from: number,
  hours: number,
): Promise<WatchResult> {
  const to = from + hours * HOUR
  try {
    // 当たりフレームは錬金枠の位置より手前なので、錬金枠は少し先まで探す
    const { found, truncated } = await search(
      ws.flatMap((w) => charmsOf(w, skills)),
      compare,
      from,
      to + AIM_LEAD,
    )
    return { gosekis: gosekiIn(found, from, to), truncated }
  } catch (e) {
    // 出ない組み合わせなら、1 行目が見出し (2 行目からの種類ごとの理由は、ここでは出さない)
    return { error: (e as Error).message.split('\n')[0] }
  }
}

/**
 * 組み合わせでまとめた条件 (group) を探し、錬金枠を 1 つの一覧に合わせる (最初の当たりフレームの順)。
 * 比べ方が同じ条件は、護石をまとめて 1 回で探す (乱数の列を流す回数を減らす)。
 * 同じ錬金枠が 2 つの条件に当たっても 1 つにする。どれも探せなかったときだけ、最初の理由を返す
 */
async function watchGroup(
  search: Search,
  group: Wanted[],
  skills: SkillInfo[],
  from: number,
  hours: number,
): Promise<WatchResult> {
  const compares = [...new Set(group.map((w) => w.compare))]
  const results = await Promise.all(
    compares.map((compare) =>
      watchCharms(
        search,
        group.filter((w) => w.compare === compare),
        compare,
        skills,
        from,
        hours,
      ),
    ),
  )
  const ok = results.filter((r) => 'gosekis' in r)
  if (ok.length === 0) return results[0]
  const byPlace = new Map<string, Goseki>()
  for (const r of ok) for (const g of r.gosekis) byPlace.set(`${g.position}-${g.kind}`, g)
  return {
    gosekis: [...byPlace.values()].sort((a, b) => a.aims[0].frame - b.aims[0].frame),
    truncated: ok.some((r) => r.truncated),
  }
}

/**
 * 条件ごとに、from から hours 時間先までのどの錬金枠に出るかを search で探す (id ごとの結果)。
 * 探すのは組み合わせと比べ方ごとに 1 回 (登録はいつも一致なので、ふつうは組み合わせごとに 1 回) で、
 * 見つけた護石を、中身が当たる条件に振り分ける。組み合わせの中のどの比べ方でも探せなかったときだけ、
 * その組み合わせの条件はどれも最初の理由 (エラーの 1 行目) を受け取る
 */
export async function watchEachWith(
  search: Search,
  wanted: Wanted[],
  skills: SkillInfo[],
  from: number,
  hours: number,
): Promise<Record<string, WatchResult>> {
  const byId: Record<string, WatchResult> = {}
  for (const group of groupWanted(wanted)) {
    const r = await watchGroup(search, group, skills, from, hours)
    for (const w of group) {
      byId[w.id] =
        'error' in r ? r : { gosekis: r.gosekis.filter((g) => matches(w, g.charm, skills)), truncated: r.truncated }
    }
  }
  return byId
}
