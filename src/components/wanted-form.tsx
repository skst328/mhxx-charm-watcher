import { useState, type ReactNode } from 'react'
import { CheckIcon, LoaderCircleIcon, PlusIcon } from 'lucide-react'

import { SkillCombobox } from '@/components/skill-combobox'
import { ValueSelect, type Option } from '@/components/value-select'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { impossibleReason, type MeldingSkills } from '@/lib/core'
import { majorSkills, pointsFor, skillsFor, type Slot } from '@/lib/skills'
import type { Compare, Melding } from '@/lib/types'
import { covers, MELDING_LABEL, sameWanted, wantedText, type Wanted } from '@/lib/watch'

const MELDINGS: Melding[] = ['juju', 'halcyon']

/**
 * 欲しい護石を条件で登録する (欄はナビの検索の条件と同じ並び。お守りの種類は選ばず、その錬金で出るどの種類でも探す)。
 * 登録しても欄は残す (似た条件を続けて登録できるように)
 */
export function WantedForm({
  meldingSkills,
  wanted,
  onAdd,
}: {
  /** 錬金のやり方ごとの、出るスキルとポイントの範囲 (条件の選択肢に使う) */
  meldingSkills: MeldingSkills
  /** 登録済みのもの (含まれる条件は登録させず、含む条件を登録したら含まれるものをまとめる) */
  wanted: Wanted[]
  /** w を登録し、removed の id のもの (w に含まれる登録済みのもの) を消す */
  onAdd: (w: Wanted, removed: string[]) => void
}) {
  const [melding, setMelding] = useState<Melding>('juju')
  const [compare, setCompare] = useState<Compare>('atLeast')
  /** スキルの選択肢を主要なものだけにするか */
  const [majorOnly, setMajorOnly] = useState(true)
  const [skill1, setSkill1] = useState<number | null>(null)
  const [pts1, setPts1] = useState<number | null>(null)
  const [skill2, setSkill2] = useState<number | null>(null)
  const [pts2, setPts2] = useState<number | null>(null)
  const [slots, setSlots] = useState(0)
  /** 出うるかを確かめている間 */
  const [checking, setChecking] = useState(false)
  /** 出ない組み合わせだった条件と、その理由 */
  const [rejected, setRejected] = useState<{ wanted: Wanted; message: string } | null>(null)

  /** 選んでいる錬金で出るスキル (条件の選択肢はこの中から) */
  const skills = meldingSkills[melding]
  // 錬金を切り替えたら、出るスキルが変わるので、スキルは選び直してもらう
  const pickMelding = (m: Melding) => {
    setMelding(m)
    setSkill1(null)
    setPts1(null)
    setSkill2(null)
    setPts2(null)
  }
  const atLeast = compare === 'atLeast'
  const suffix = atLeast ? ' 以上' : ''
  const range = (id: number | null, slot: Slot) => skills.find((s) => s.id === id)?.[slot]
  /** その欄の選択肢 (主要だけのときも、選んでいるスキルは残す) */
  const choices = (slot: Slot, keep: number | null) =>
    majorOnly ? majorSkills(skillsFor(skills, slot), keep) : skillsFor(skills, slot)
  // スキルを選んだら、ポイントはそのスキルの最小にする (「以上」ならいちばんゆるい値)
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

  // 第 1 スキルは「以上」なら問わなくてよい (「一致」では決める)。ただし第 2 スキルも問わないと、
  // スロットだけの条件になって何でも当たるので、登録させない
  const ready = skill1 === null ? atLeast && skill2 !== null : pts1 !== null

  /** いまの欄の条件 (id は登録するときに付け直す) */
  const draft: Wanted = { id: '', melding, compare, skill1, pts1, skill2, pts2, slots }
  // 重なる登録は操作ミスとみなし、広い条件だけを残す
  /** いまの条件を含む登録済みのもの (あれば登録させない。同じ範囲のものも含む) */
  const coveredBy = ready ? wanted.find((w) => covers(w, draft, meldingSkills)) : undefined
  const registered = coveredBy !== undefined
  /** いまの条件に含まれる登録済みのもの (登録するとまとめて消す) */
  const absorbed = ready && !registered ? wanted.filter((w) => covers(draft, w, meldingSkills)) : []
  /** いまの条件が出ない組み合わせなら、その理由 (欄を変えたら消える) */
  const impossible = rejected && sameWanted(rejected.wanted, draft) ? rejected.message : null

  // 出ない組み合わせは登録させない (ウォッチで更新したときに初めて分かるのでは遅いので)
  const add = async () => {
    if (!ready || registered) return
    setChecking(true)
    const message = await impossibleReason(draft, meldingSkills)
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
        {/* 錬金のやり方と比べ方は、それぞれ 1 行に。左に薄く見出しを付け、ボタンの頭をそろえる */}
        <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2">
          <span className="text-sm text-muted-foreground">錬金の種類</span>
          <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="錬金の種類">
            {MELDINGS.map((m) => (
              <Button
                key={m}
                size="sm"
                variant={melding === m ? 'default' : 'outline'}
                role="radio"
                aria-checked={melding === m}
                onClick={() => pickMelding(m)}
              >
                {MELDING_LABEL[m]}
              </Button>
            ))}
          </div>
          <span className="text-sm text-muted-foreground">条件</span>
          <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="条件">
            {(
              [
                ['atLeast', '以上'],
                ['exact', '一致'],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                size="sm"
                variant={compare === value ? 'default' : 'outline'}
                role="radio"
                aria-checked={compare === value}
                onClick={() => setCompare(value)}
              >
                {label}
              </Button>
            ))}
          </div>
          <span className="text-sm text-muted-foreground">スキル</span>
          <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="スキルの選択肢">
            {(
              [
                [true, '主要'],
                [false, 'すべて'],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={label}
                size="sm"
                variant={majorOnly === value ? 'default' : 'outline'}
                role="radio"
                aria-checked={majorOnly === value}
                onClick={() => setMajorOnly(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
        {/* 錬金の種類・条件と、護石の条件の間に区切り線 */}
        <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
          <Field label="第1スキル" htmlFor="skill1">
            <div className="flex gap-2">
              <div className="flex-1">
                <SkillCombobox
                  id="skill1"
                  skills={choices('pts1', skill1)}
                  value={skill1}
                  onChange={pickSkill1}
                  placeholder="スキル"
                  noneLabel={atLeast ? '問わない' : undefined}
                />
              </div>
              <ValueSelect
                value={pts1}
                onChange={setPts1}
                options={points(skill1, 'pts1')}
                placeholder="-"
                className="w-28"
                disabled={skill1 === null}
              />
            </div>
          </Field>
          <Field label="第2スキル" htmlFor="skill2">
            <div className="flex gap-2">
              <div className="flex-1">
                <SkillCombobox
                  // 「以上」なら第 2 スキルを問わない、「一致」なら第 2 スキルなし
                  id="skill2"
                  skills={choices('pts2', skill2)}
                  value={skill2}
                  onChange={pickSkill2}
                  noneLabel={atLeast ? '問わない' : 'なし'}
                />
              </div>
              <ValueSelect
                value={pts2}
                onChange={setPts2}
                options={points(skill2, 'pts2')}
                placeholder="-"
                className="w-28"
                disabled={skill2 === null}
              />
            </div>
          </Field>
          <Field label="スロット">
            <ValueSelect value={slots} onChange={setSlots} options={slotOptions} className="w-full" />
          </Field>
        </div>
        <div className="space-y-2 border-t pt-4">
          <Button onClick={add} disabled={!ready || registered || checking || impossible !== null}>
            {checking ? <LoaderCircleIcon className="animate-spin" /> : <PlusIcon />}
            登録
          </Button>
          {coveredBy !== undefined ? (
            covers(draft, coveredBy, meldingSkills) ? (
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
