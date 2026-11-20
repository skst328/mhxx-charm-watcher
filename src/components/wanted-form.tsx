import { useState, type ReactNode } from 'react'
import { CheckIcon, LoaderCircleIcon, PlusIcon } from 'lucide-react'

import { SkillCombobox } from '@/components/skill-combobox'
import { ValueSelect, type Option } from '@/components/value-select'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { impossibleReason } from '@/lib/core'
import { majorSkills, pointsFor, skillAbbr, skillsFor, type Slot } from '@/lib/skills'
import type { Compare, SkillInfo } from '@/lib/types'
import { covers, piecesOf, sameWanted, theoryOf, wantedText, type Wanted, type WantedMode } from '@/lib/watch'

/** 登録のしかたの選択肢 */
const MODES: [WantedMode, string][] = [
  ['theory', '理論値'],
  ['semi', '準理論値も'],
  ['custom', 'カスタム'],
]

/**
 * 欲しい護石を登録する (マカフシギ錬金。お守りの種類は選ばず、出るどの種類でも探す)。
 * 先に第 1 スキル × 第 2 スキルの組み合わせを選び、登録のしかたを理論値・準理論値も・カスタムから選ぶ。
 * 理論値と準理論値もは、両方のスキルを決めたときだけ選べる (問わず・なしはカスタムだけ)。
 * 登録しても欄は残す (似た条件を続けて登録できるように)
 */
export function WantedForm({
  skills,
  wanted,
  onAdd,
}: {
  /** マカフシギ錬金で出るスキルとポイントの範囲 (選択肢と、理論値を決めるのに使う) */
  skills: SkillInfo[]
  /** 登録済みのもの (含まれる条件は登録させず、含む条件を登録したら含まれるものをまとめる) */
  wanted: Wanted[]
  /** w を登録し、removed の id のもの (w に含まれる登録済みのもの) を消す */
  onAdd: (w: Wanted, removed: string[]) => void
}) {
  /** スキルの選択肢を主要なものだけにするか */
  const [majorOnly, setMajorOnly] = useState(true)
  const [skill1, setSkill1] = useState<number | null>(null)
  const [skill2, setSkill2] = useState<number | null>(null)
  const [mode, setMode] = useState<WantedMode>('theory')
  // ここからはカスタムの欄
  const [compare, setCompare] = useState<Compare>('atLeast')
  const [pts1, setPts1] = useState<number | null>(null)
  const [pts2, setPts2] = useState<number | null>(null)
  const [slots, setSlots] = useState(0)
  /** 出うるかを確かめている間 */
  const [checking, setChecking] = useState(false)
  /** 出ない組み合わせだった条件と、その理由 */
  const [rejected, setRejected] = useState<{ wanted: Wanted; message: string } | null>(null)

  /** 選んだ組み合わせの理論値 (両方のスキルを決めていなければ null) */
  const theory = theoryOf(skill1, skill2, skills)
  /** 実際の登録のしかた (理論値を決められない組み合わせはカスタムだけ) */
  const effective: WantedMode = theory ? mode : 'custom'
  const atLeast = compare === 'atLeast'
  const suffix = atLeast ? ' 以上' : ''
  const range = (id: number | null, slot: Slot) => skills.find((s) => s.id === id)?.[slot]
  /** その欄の選択肢 (主要だけのときも、選んでいるスキルは残す) */
  const choices = (slot: Slot, keep: number | null) =>
    majorOnly ? majorSkills(skillsFor(skills, slot), keep) : skillsFor(skills, slot)
  // スキルを選んだら、カスタムのポイントはそのスキルの最小にする (「以上」ならいちばんゆるい値)
  const pickSkill1 = (id: number | null) => {
    setSkill1(id)
    setPts1(range(id, 'pts1')?.min ?? null)
  }
  const pickSkill2 = (id: number | null) => {
    setSkill2(id)
    setPts2(range(id, 'pts2')?.min ?? null)
  }
  const points = (id: number | null, slot: Slot) =>
    pointsFor(range(id, slot)).map((p) => ({ value: p, label: `${p}${suffix}` }))
  const slotOptions: Option<number>[] = [0, 1, 2, 3].map((n) => ({ value: n, label: `${n}${suffix}` }))

  /** いまの欄の条件 (id は登録するときに付け直す) */
  const draft: Wanted =
    effective === 'custom' || theory === null
      ? { id: '', compare, skill1, pts1, skill2, pts2, slots }
      : { ...theory, id: '', semi: effective === 'semi' }
  // カスタムでは、第 1 スキルは「以上」なら問わなくてよい (「一致」では決める)。ただし第 2 スキルも問わないと、
  // スロットだけの条件になって何でも当たるので、登録させない
  const ready =
    effective !== 'custom' ||
    (skill1 === null ? atLeast && skill2 !== null : pts1 !== null && (skill2 === null || pts2 !== null))
  // 重なる登録は操作ミスとみなし、広い条件だけを残す
  /** いまの条件を含む登録済みのもの (あれば登録させない。同じ範囲のものも含む) */
  const coveredBy = ready ? wanted.find((w) => covers(w, draft, skills)) : undefined
  /** いまの条件に含まれる登録済みのもの (登録するとまとめて消す) */
  const absorbed = ready && !coveredBy ? wanted.filter((w) => covers(draft, w, skills)) : []
  /** いまの条件が出ない組み合わせなら、その理由 (欄を変えたら消える) */
  const impossible = rejected && sameWanted(rejected.wanted, draft) ? rejected.message : null

  // 出ない組み合わせは登録させない (ウォッチで更新したときに初めて分かるのでは遅いので)
  const add = async () => {
    if (!ready || coveredBy) return
    setChecking(true)
    const message = await impossibleReason(draft, skills)
    setChecking(false)
    if (message !== null) setRejected({ wanted: draft, message })
    else
      onAdd(
        { ...draft, id: crypto.randomUUID() },
        absorbed.map((w) => w.id),
      )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>欲しい護石を登録</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 1. スキルの組み合わせ */}
        <div className="space-y-3">
          <Toggle
            label="スキル"
            value={majorOnly}
            onChange={setMajorOnly}
            options={[
              [true, '主要'],
              [false, 'すべて'],
            ]}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="第1スキル" htmlFor="skill1">
              <SkillCombobox
                id="skill1"
                skills={choices('pts1', skill1)}
                value={skill1}
                onChange={pickSkill1}
                placeholder="スキル"
                noneLabel="問わない"
              />
            </Field>
            <Field label="第2スキル" htmlFor="skill2">
              <SkillCombobox
                // カスタムの「一致」なら第 2 スキルなし、ほかは問わない
                id="skill2"
                skills={choices('pts2', skill2)}
                value={skill2}
                onChange={pickSkill2}
                noneLabel={effective === 'custom' && !atLeast ? 'なし' : '問わない'}
              />
            </Field>
          </div>
        </div>

        {/* 2. 登録のしかた */}
        <div className="space-y-3 border-t pt-4">
          <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="登録のしかた">
            {MODES.map(([value, label]) => (
              <Button
                key={value}
                size="sm"
                variant={effective === value ? 'default' : 'outline'}
                role="radio"
                aria-checked={effective === value}
                disabled={value !== 'custom' && theory === null}
                onClick={() => setMode(value)}
              >
                {label}
              </Button>
            ))}
          </div>
          {theory === null && (skill1 === null || skill2 === null) && (
            <p className="text-xs text-muted-foreground">第 1・第 2 スキルを両方選ぶと、理論値・準理論値もを選べます</p>
          )}
          {effective !== 'custom' && theory ? (
            // 当たる中身を札で並べる (準理論値もなら 4 枚。理論値から下がったところだけ色を変える)
            <div className="flex flex-wrap gap-1.5">
              {piecesOf(draft, skills).map((p) => (
                <span
                  key={`${p.pts1}-${p.pts2}-${p.slots}`}
                  className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold tabular-nums"
                >
                  {skillAbbr(skills, p.skill1!)}
                  <Lowered value={p.pts1!} theory={theory.pts1!} /> {skillAbbr(skills, p.skill2!)}
                  <Lowered value={p.pts2!} theory={theory.pts2!} /> S<Lowered value={p.slots} theory={3} />
                </span>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <Toggle
                label="条件"
                value={compare}
                onChange={setCompare}
                options={[
                  ['atLeast', '以上'],
                  ['exact', '一致'],
                ]}
              />
              <div className="grid grid-cols-3 gap-2">
                <Field label="第1スキル">
                  <ValueSelect
                    value={pts1}
                    onChange={setPts1}
                    options={points(skill1, 'pts1')}
                    placeholder="-"
                    className="w-full"
                    disabled={skill1 === null}
                  />
                </Field>
                <Field label="第2スキル">
                  <ValueSelect
                    value={pts2}
                    onChange={setPts2}
                    options={points(skill2, 'pts2')}
                    placeholder="-"
                    className="w-full"
                    disabled={skill2 === null}
                  />
                </Field>
                <Field label="スロット">
                  <ValueSelect value={slots} onChange={setSlots} options={slotOptions} className="w-full" />
                </Field>
              </div>
            </div>
          )}
        </div>

        {/* 3. 登録 */}
        <div className="space-y-2 border-t pt-4">
          <Button onClick={add} disabled={!ready || coveredBy !== undefined || checking || impossible !== null}>
            {checking ? <LoaderCircleIcon className="animate-spin" /> : <PlusIcon />}
            登録
          </Button>
          {coveredBy !== undefined ? (
            covers(draft, coveredBy, skills) ? (
              // 同じ範囲。登録した直後もここに出る (登録できたことの知らせを兼ねる)
              <p className="flex items-center gap-1.5 text-sm text-success">
                <CheckIcon className="size-4 shrink-0" />
                登録済み
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">登録済みの「{wantedText(coveredBy, skills)}」に含まれます</p>
            )
          ) : impossible !== null ? (
            // 1 行目が見出し、2 行目からお守りの種類ごとの理由
            <p className="text-sm whitespace-pre-line text-destructive">{impossible}</p>
          ) : (
            absorbed.length > 0 && (
              <p className="text-sm text-muted-foreground">
                登録すると、含まれる {absorbed.length} 件をまとめます (
                {absorbed.map((w) => `「${wantedText(w, skills)}」`).join('')})
              </p>
            )
          )}
        </div>
      </CardContent>
    </Card>
  )
}

/** 理論値と比べた値。下がっていれば色を変える (準理論値の札で、どこが違うかを見せる) */
function Lowered({ value, theory }: { value: number; theory: number }) {
  return <span className={value < theory ? 'text-warning' : undefined}>{value}</span>
}

/** 左に薄く見出しを付けた、ボタンの並びの切り替え */
function Toggle<T extends string | boolean>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: T
  onChange: (v: T) => void
  options: [T, string][]
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={label}>
        {options.map(([v, text]) => (
          <Button
            key={text}
            size="sm"
            variant={value === v ? 'default' : 'outline'}
            role="radio"
            aria-checked={value === v}
            onClick={() => onChange(v)}
          >
            {text}
          </Button>
        ))}
      </div>
    </div>
  )
}

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-sm font-normal text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  )
}
