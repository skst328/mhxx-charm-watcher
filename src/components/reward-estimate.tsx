import { useState } from 'react'
import { LoaderCircleIcon, PlusIcon, SearchIcon, XIcon } from 'lucide-react'

import { SkillCombobox } from '@/components/skill-combobox'
import { ValueSelect } from '@/components/value-select'
import { Button } from '@/components/ui/button'
import { searchRewards, type RewardSkills } from '@/lib/core'
import { roughTime, showFrame } from '@/lib/frame'
import {
  emptyDraft,
  GOSEKI,
  kindOf,
  rewardCharmOf,
  WINDOW_HOURS,
  windowLabel,
  withoutZero,
  type RewardDraft,
} from '@/lib/reward'
import { pointsFor, skillsFor, type Slot } from '@/lib/skills'
import { useStored } from '@/lib/storage'
import type { RewardCharm, SkillInfo } from '@/lib/types'
import { FPS, HOUR } from '@/lib/watch'

/** 候補をいくつまで並べるか (多いときは護石を足して絞ってもらう) */
const SHOWN = 10

type Result = { from: number; frames: number[]; truncated: boolean } | { error: string }

/**
 * クエスト報酬で鑑定した護石から、「鑑定する」を押したフレームを探す。鑑定した護石を 1 個目から順に入れ、
 * from (今わかっている下限) から決めた長さだけ先までを探す。候補を選ぶと、そのフレームを現在フレームの欄に入れる
 * (欄に入っている候補は塗りつぶしで出す)
 */
export function RewardEstimate({
  rewardSkills,
  from,
  onPick,
}: {
  rewardSkills: RewardSkills
  /** 探す範囲の始まり (前に分かっていたフレーム。フレームは戻らないので下限になる) */
  from: number
  onPick: (frame: number) => void
}) {
  const [drafts, setDrafts] = useState<RewardDraft[]>([emptyDraft()])
  /** 探す長さ (時間)。前回の値を覚えておく */
  const [hours, setHours] = useStored('reward-window-hours', 24)
  const [searching, setSearching] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  const charms = drafts.map(rewardCharmOf)
  const ready = charms.every((c) => c !== null)

  const update = (i: number, d: RewardDraft) => setDrafts((prev) => prev.map((p, j) => (j === i ? d : p)))

  const search = async () => {
    if (!ready) return
    setSearching(true)
    try {
      const r = await searchRewards(charms as RewardCharm[], from, from + hours * HOUR)
      setResult({ from, ...r })
    } catch (e) {
      setResult({ error: (e as Error).message })
    }
    setSearching(false)
  }

  return (
    <div className="space-y-3">
      <ol className="space-y-2">
        {drafts.map((d, i) => (
          <DraftRow
            key={i}
            index={i}
            draft={d}
            rewardSkills={rewardSkills}
            onChange={(next) => update(i, next)}
            // 外せるのは最後の 1 個だけ (途中を外すと何個目かがずれるので)
            onRemove={i === drafts.length - 1 && i > 0 ? () => setDrafts((prev) => prev.slice(0, -1)) : undefined}
          />
        ))}
      </ol>
      <Button variant="outline" size="sm" onClick={() => setDrafts((prev) => [...prev, emptyDraft()])}>
        <PlusIcon />
        次の護石を足す
      </Button>
      <div className="flex flex-wrap items-center gap-2 border-t pt-3 text-sm">
        <span className="font-mono tabular-nums">{showFrame(from)}F</span>
        <span className="text-muted-foreground">から</span>
        <ValueSelect
          value={hours}
          onChange={setHours}
          options={WINDOW_HOURS.map((h) => ({ value: h, label: `${windowLabel(h)}先まで` }))}
          className="w-32"
        />
        <Button onClick={search} disabled={!ready || searching} className="ml-auto">
          {searching ? <LoaderCircleIcon className="animate-spin" /> : <SearchIcon />}
          探す
        </Button>
      </div>
      {result && <ResultView result={result} picked={from} onPick={onPick} />}
    </div>
  )
}

/** 鑑定した護石 1 個の入力: 何個目か・護石の名前 (レア度)・第 1 スキル・第 2 スキル・スロット */
function DraftRow({
  index,
  draft: d,
  rewardSkills,
  onChange,
  onRemove,
}: {
  index: number
  draft: RewardDraft
  rewardSkills: RewardSkills
  onChange: (d: RewardDraft) => void
  onRemove?: () => void
}) {
  /** 欄の id の頭 (何個目か) */
  const id = `reward-${index + 1}`
  /** 選んだ護石の元のお守りで出るスキル (護石を選ぶまでは空) */
  const skills: SkillInfo[] = d.rarity === null ? [] : rewardSkills[kindOf(d.rarity)]
  const range = (id: number | null, slot: Slot) => skills.find((s) => s.id === id)?.[slot]
  // 護石を変えて元のお守りが変わったら、そのお守りで出ないスキルは選び直してもらう
  const pickRarity = (rarity: number) => {
    const next = rewardSkills[kindOf(rarity)]
    const has = (id: number | null, slot: Slot) => id !== null && next.some((s) => s.id === id && s[slot] !== null)
    onChange({
      ...d,
      rarity,
      ...(has(d.skill1, 'pts1') ? {} : { skill1: null, pts1: null }),
      ...(has(d.skill2, 'pts2') || d.skill2 === null ? {} : { skill2: null, pts2: null }),
    })
  }
  const points = (id: number | null, slot: Slot) => {
    const all = pointsFor(range(id, slot))
    return (slot === 'pts2' ? withoutZero(all) : all).map((p) => ({ value: p, label: String(p) }))
  }
  return (
    <li className="space-y-2 rounded-lg border p-2">
      <div className="flex items-center gap-2">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums">
          {index + 1}
        </span>
        <ValueSelect
          id={`${id}-rarity`}
          value={d.rarity}
          onChange={pickRarity}
          options={GOSEKI.map((g) => ({ value: g.rarity, label: g.name }))}
          placeholder="護石"
          className="flex-1"
        />
        {onRemove && (
          <Button
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground"
            onClick={onRemove}
            aria-label="この護石を外す"
          >
            <XIcon />
          </Button>
        )}
      </div>
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <SkillCombobox
            id={`${id}-skill1`}
            skills={skillsFor(skills, 'pts1')}
            value={d.skill1}
            onChange={(id) => onChange({ ...d, skill1: id, pts1: null })}
            placeholder="第1スキル"
          />
        </div>
        <ValueSelect
          id={`${id}-pts1`}
          value={d.pts1}
          onChange={(pts1) => onChange({ ...d, pts1 })}
          options={points(d.skill1, 'pts1')}
          placeholder="-"
          className="w-20"
          disabled={d.skill1 === null}
        />
      </div>
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <SkillCombobox
            id={`${id}-skill2`}
            skills={skillsFor(skills, 'pts2')}
            value={d.skill2}
            onChange={(id) => onChange({ ...d, skill2: id, pts2: null })}
            noneLabel="第2スキルなし"
          />
        </div>
        <ValueSelect
          id={`${id}-pts2`}
          value={d.pts2}
          onChange={(pts2) => onChange({ ...d, pts2 })}
          options={points(d.skill2, 'pts2')}
          placeholder="-"
          className="w-20"
          disabled={d.skill2 === null}
        />
      </div>
      <ValueSelect
        id={`${id}-slots`}
        value={d.slots}
        onChange={(slots) => onChange({ ...d, slots })}
        options={[0, 1, 2, 3].map((n) => ({ value: n, label: `スロット${n}` }))}
        className="w-full"
      />
    </li>
  )
}

/** 探した結果: 見つからない・候補の一覧 (選ぶと現在フレームにする) */
function ResultView({
  result,
  picked,
  onPick,
}: {
  result: Result
  /** 今の現在フレーム (候補のどれかを選んだあとなら、そのフレーム) */
  picked: number
  onPick: (frame: number) => void
}) {
  if ('error' in result) return <p className="text-sm text-destructive">{result.error}</p>
  const { from, frames, truncated } = result
  if (frames.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        見つかりませんでした。範囲を広げるか、護石の中身を見直してください
      </p>
    )
  }
  return (
    <div className="space-y-2">
      <p className="text-sm tabular-nums">
        {frames.length === 1 ? (
          '1 件見つかりました'
        ) : (
          <>
            {frames.length}
            {truncated && '+'} 件。護石を足すと絞れます
          </>
        )}
      </p>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {frames.slice(0, SHOWN).map((f) => (
          <li key={f}>
            <Button
              variant={f === picked ? 'default' : 'outline'}
              className="w-full justify-between font-normal"
              onClick={() => onPick(f)}
            >
              <span className="font-mono tabular-nums">{showFrame(f)}F</span>
              <span className="text-xs opacity-70 tabular-nums">+{roughTime((f - from) / FPS)}</span>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
