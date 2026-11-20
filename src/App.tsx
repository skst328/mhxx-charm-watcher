import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircleIcon,
  EyeIcon,
  ListPlusIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SparklesIcon,
  Trash2Icon,
} from 'lucide-react'

import { RewardEstimate } from '@/components/reward-estimate'
import { ThemeToggle } from '@/components/theme-toggle'
import { WantedCard } from '@/components/wanted-card'
import { WantedList } from '@/components/wanted-list'
import { WantedForm } from '@/components/wanted-form'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { loadRewardSkills, loadSkills, watch, type RewardSkills, type WatchResult } from '@/lib/core'
import type { SkillInfo } from '@/lib/types'
import { parseFrame } from '@/lib/frame'
import { useStored } from '@/lib/storage'
import { cn } from '@/lib/utils'
import { FAMOUS } from '@/lib/famous'
import { covers, GRID_HOURS, wantedText, type Wanted } from '@/lib/watch'

type Tab = 'watch' | 'register'

/** 使う順 (登録してからウォッチする) に左から並べる */
const TABS: { value: Tab; label: string; icon: typeof EyeIcon }[] = [
  { value: 'register', label: '登録', icon: ListPlusIcon },
  { value: 'watch', label: 'ウォッチ', icon: EyeIcon },
]

export default function App() {
  /** 開いているタブ (初めて開いたときは、まず登録から) */
  const [tab, setTab] = useStored<Tab>('tab', 'register')
  /** マカフシギ錬金で出るスキルとポイントの範囲 (選択肢・名前・理論値に使う) */
  const [skills, setSkills] = useState<SkillInfo[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  /** 現在フレームの欄 (前回の値を覚えておく) */
  const [frameText, setFrameText] = useStored('current-frame', '')
  const [wanted, setWanted] = useStored<Wanted[]>('wanted-charms', [])
  /** 調べた結果と、そのときの現在フレーム (欄を書き換えても、どこから調べた結果かが分かるように) */
  const [results, setResults] = useState<{ from: number; byId: Record<string, WatchResult> } | null>(null)
  const [searching, setSearching] = useState(false)
  /** 消すか確かめている欲しい護石 (all なら全部。件数は確かめ始めたときのもの)。確かめの窓を閉じても残す
   * (閉じて消えていく間も、同じ文を出しておくため) */
  const [removing, setRemoving] = useState<Wanted | { all: number } | null>(null)
  const [confirming, setConfirming] = useState(false)

  /** クエスト報酬のお守りの種類ごとの、出うるスキル (鑑定した護石の入力の選択肢) */
  const [rewardSkills, setRewardSkills] = useState<RewardSkills | null>(null)
  /** クエスト報酬から推定の欄をリセットした回数 (欄の key にして、変わったら作り直す) */
  const [rewardReset, setRewardReset] = useState(0)

  useEffect(() => {
    loadSkills().then(setSkills, (e: Error) => setLoadError(e.message))
    // 読み込みに失敗したときは、同じ Worker の loadSkills のほうで知らせる
    loadRewardSkills().then(setRewardSkills, () => {})
  }, [])

  const current = parseFrame(frameText)

  /** 有名な理論値護石を、準理論値も当てる形で登録するか (前回の選択を覚えておく) */
  const [famousSemi, setFamousSemi] = useStored('famous-semi', false)
  /** 有名な理論値護石のうち、まだ登録していないもの (選んだ形で)。
   * 登録済みの条件に含まれるもの (同じ範囲のものも) は登録済みとみなす */
  const unregisteredFamous: Wanted[] = skills
    ? FAMOUS.map((f) => ({ ...f, id: '', semi: famousSemi })).filter((f) => !wanted.some((w) => covers(w, f, skills)))
    : []
  // まとめて登録する。フォームと同じく、足すものに含まれる登録済みのもの (準理論値もを足すときの理論値など) は消す
  const addFamous = () => {
    if (skills === null) return
    const adding = unregisteredFamous.map((f) => ({ ...f, id: crypto.randomUUID() }))
    setWanted((prev) => [...prev.filter((p) => !adding.some((a) => covers(a, p, skills))), ...adding])
  }

  const askRemove = (target: Wanted | { all: number }) => {
    setRemoving(target)
    setConfirming(true)
  }

  /** ウォッチタブのカードの並び: 次の当たりフレームが近い順。3 日以内に出ないもの・調べていないものは
   * 後ろに、登録した順で */
  const byNext = useMemo(() => {
    const next = (w: Wanted) => {
      const r = results?.byId[w.id]
      return r && 'gosekis' in r && r.gosekis.length > 0 ? r.gosekis[0].aims[0].frame : Infinity
    }
    // 出ないもの同士 (Infinity - Infinity) は NaN にならないよう、等しいときは 0 にする
    return wanted.toSorted((a, b) => (next(a) === next(b) ? 0 : next(a) - next(b)))
  }, [wanted, results])

  // 欲しい護石ごとに、現在フレームから 3 日先までの錬金枠を探す
  const check = async () => {
    if (current === null || skills === null) return
    setSearching(true)
    const byId: Record<string, WatchResult> = {}
    for (const w of wanted) byId[w.id] = await watch(w, skills, current, GRID_HOURS)
    setResults({ from: current, byId })
    setSearching(false)
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <header className="flex items-start justify-between gap-3">
        <h1 className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-2xl font-bold tracking-tight sm:text-3xl">MHXX 護石ウォッチャー</span>
          <span className="text-base font-normal whitespace-nowrap text-muted-foreground tabular-nums sm:text-lg">
            v{__APP_VERSION__}
          </span>
        </h1>
        <ThemeToggle />
      </header>

      {loadError && (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>読み込めませんでした</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      <nav role="tablist" className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        {TABS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium sm:py-2',
              tab === value ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </nav>

      {/* タブを切り替えても入力や結果が残るように、どのタブも隠すだけにする */}
      {skills && (
        <>
          <div role="tabpanel" hidden={tab !== 'watch'} className="space-y-6">
            {/* 鑑定した護石から現在フレームを探す。選んだフレームは下の現在フレームの欄に入る (更新は自分で押す) */}
            {rewardSkills && (
              <Card>
                <CardHeader>
                  <CardTitle>クエスト報酬から推定</CardTitle>
                  <CardDescription>鑑定した護石を 1 個目から順に</CardDescription>
                  {/* 入れた護石と結果を空に戻す (探す長さは残す) */}
                  <CardAction>
                    <Button variant="outline" size="sm" onClick={() => setRewardReset((n) => n + 1)}>
                      <RotateCcwIcon />
                      リセット
                    </Button>
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <RewardEstimate
                    // リセットは作り直して空に戻す
                    key={rewardReset}
                    rewardSkills={rewardSkills}
                    from={current ?? 0}
                    onPick={(f) => setFrameText(String(f))}
                  />
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle id="current-frame-title">現在フレーム</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  id="current-frame"
                  aria-labelledby="current-frame-title"
                  inputMode="numeric"
                  className="font-mono"
                  value={frameText}
                  aria-invalid={frameText !== '' && current === null}
                  onChange={(e) => setFrameText(e.target.value)}
                />
                <Button onClick={check} disabled={current === null || wanted.length === 0 || searching}>
                  {searching ? <LoaderCircleIcon className="animate-spin" /> : <RefreshCwIcon />}
                  更新
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>欲しい護石</CardTitle>
              </CardHeader>
              <CardContent>
                {wanted.length === 0 ? (
                  <p className="text-sm text-muted-foreground">まだ登録していません (「登録」のタブで登録します)</p>
                ) : (
                  <ul className="space-y-3">
                    {byNext.map((w) => (
                      <WantedCard
                        // 調べ直したら、開いていた詳細は閉じて探し直す
                        key={`${w.id}-${results?.from}`}
                        wanted={w}
                        skills={skills}
                        from={results?.from ?? null}
                        result={results?.byId[w.id]}
                        onRemove={() => askRemove(w)}
                      />
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <div role="tabpanel" hidden={tab !== 'register'} className="space-y-6">
            <WantedForm
              skills={skills}
              wanted={wanted}
              onAdd={(w, removed) => setWanted((prev) => [...prev.filter((p) => !removed.includes(p.id)), w])}
            />
            <Card>
              <CardHeader>
                <CardTitle>登録した護石</CardTitle>
                {/* 登録を全部消す (確かめてから) */}
                <CardAction>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={wanted.length === 0}
                    onClick={() => askRemove({ all: wanted.length })}
                  >
                    <Trash2Icon />
                    すべて消す
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* 有名な理論値護石のうち、まだ登録していないものをまとめて登録する。準理論値も当てるかは押す前に選ぶ */}
                <div className="flex flex-wrap items-center gap-2 border-b pb-3">
                  <div className="flex gap-1" role="radiogroup" aria-label="有名な理論値護石の登録のしかた">
                    {(
                      [
                        [false, '理論値のみ'],
                        [true, '準理論値も'],
                      ] as const
                    ).map(([value, label]) => (
                      <Button
                        key={label}
                        size="sm"
                        variant={famousSemi === value ? 'default' : 'outline'}
                        role="radio"
                        aria-checked={famousSemi === value}
                        onClick={() => setFamousSemi(value)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" disabled={unregisteredFamous.length === 0} onClick={addFamous}>
                    <SparklesIcon />
                    {unregisteredFamous.length === 0 ? '有名な理論値護石は登録済み' : '有名な理論値護石を登録'}
                  </Button>
                </div>
                {wanted.length === 0 ? (
                  <p className="text-sm text-muted-foreground">まだ登録していません</p>
                ) : (
                  <WantedList wanted={wanted} skills={skills} onRemove={askRemove} />
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {removing && 'all' in removing ? '登録をすべて消しますか？' : '登録を消しますか？'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {removing &&
                ('all' in removing ? `${removing.all} 件の登録を消します` : skills && wantedText(removing, skills))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>やめる</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (removing && 'all' in removing) setWanted([])
                else if (removing) setWanted((prev) => prev.filter((w) => w.id !== removing.id))
                setConfirming(false)
              }}
            >
              消す
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}
