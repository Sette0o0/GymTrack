"use client"

import { useEffect, useRef, useState } from "react"
import {
  Check,
  Pause,
  Play,
  Plus,
  SkipForward,
  Square,
  Trash2,
  Undo2,
} from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion"
import { NumberInput } from "@workspace/ui/components/number-input"
import { numericText, numericValue } from "@workspace/ui/lib/numeric"
import { Textarea } from "@workspace/ui/components/textarea"
import { Progress } from "@workspace/ui/components/progress"
import { useApp } from "./app-shell"
import {
  ConfirmAction,
  EmptyState,
  Field,
  PageHeading,
  TextLink,
} from "./ui-helpers"
import { targetLabel } from "./workouts-screen"
import {
  addSet,
  changeSession,
  completePendingSets,
  removeSet,
  sessionNote,
  toggleTimer,
  updateSet,
} from "@/services/sessions"
import {
  duration,
  weight,
  type SetRecord,
  type SessionExercise,
} from "@/lib/schema"

export function SessionScreen() {
  const { data, run, busy, unsaved, settle } = useApp()
  const [open, setOpen] = useState<string[]>([])
  const [cardError, setCardError] = useState("")
  const expandRequest = useRef(0)
  const [requestedId] = useState(() =>
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("id")
  )
  if (!data) return null
  const session = requestedId
    ? data.workoutSessions.find((row) => row.id === requestedId)
    : data.workoutSessions.find((row) => row.status !== "completed")
  if (!session)
    return (
      <EmptyState
        title="Nenhum treino em andamento"
        action={
          <a href="/treinos/" className="button-link">
            Escolher ficha
          </a>
        }
      >
        Inicie uma ficha para registrar suas séries.
      </EmptyState>
    )
  if (session.status === "completed")
    return (
      <EmptyState
        title="Treino concluído"
        action={
          <a href={`/historico/?id=${session.id}`} className="button-link">
            Ver registro
          </a>
        }
      >
        Seu esforço está registrado no histórico.
      </EmptyState>
    )
  const exercises = data.sessionExercises
    .filter((row) => row.sessionId === session.id)
    .sort((a, b) => a.order - b.order)
  if (!exercises.length)
    return (
      <EmptyState title="Sessão sem exercícios">
        Restaure um backup válido ou encerre esta sessão nas configurações.
      </EmptyState>
    )
  const allSets = data.setRecords.filter((row) =>
    exercises.some((item) => item.id === row.sessionExerciseId)
  )
  const done = allSets.filter((row) => row.status !== "pending").length
  const paused = session.status === "paused"
  async function changeExercise(next: string[]) {
    const request = ++expandRequest.current
    const saved = await settle()
    if (request !== expandRequest.current) return
    if (saved) {
      setOpen(next)
      setCardError("")
    } else
      setCardError(
        "Corrija os campos destacados ou tente salvar novamente antes de recolher ou trocar de exercício."
      )
  }
  return (
    <>
      <PageHeading
        eyebrow={
          paused
            ? "VOCÊ PODE CONTINUAR QUANDO QUISER"
            : "FOCO EM UMA SÉRIE DE CADA VEZ"
        }
        title={`${session.workoutCode} · ${session.workoutName}`}
        description={
          paused
            ? "Treino pausado. Seus registros continuam salvos."
            : "Os valores são salvos a cada alteração. Você só precisa treinar."
        }
        action={<TextLink href="/">Voltar ao início</TextLink>}
      />
      <div className="session-progress">
        <p>
          <span>
            {done} de {allSets.length} séries registradas
          </span>
          <strong>
            {allSets.length ? Math.round((done / allSets.length) * 100) : 0}%
          </strong>
        </p>
        <Progress
          aria-label="Progresso das séries do treino"
          value={allSets.length ? (done / allSets.length) * 100 : 0}
        />
      </div>
      {paused && (
        <div className="success-banner flex flex-wrap items-center justify-between gap-3">
          <span>Treino pausado.</span>
          <Button
            disabled={busy}
            onClick={async () => {
              if (await settle())
                await run(() => changeSession(session.id, "active"))
            }}
          >
            <Play size={16} />
            Retomar treino
          </Button>
        </div>
      )}
      <p className="subtle mb-4">
        Toque em um exercício para abrir suas séries.
      </p>
      {cardError && unsaved && (
        <p className="error-banner" role="alert">
          {cardError}
        </p>
      )}
      <Accordion
        value={open}
        multiple={false}
        onValueChange={(next) => {
          void changeExercise(next as string[])
        }}
        className="exercise-cards"
        aria-label="Exercícios da sessão"
      >
        {exercises.map((exercise, index) => (
          <ExerciseCard
            key={exercise.id}
            exercise={exercise}
            ordinal={index + 1}
            paused={paused}
          />
        ))}
      </Accordion>
      <section className="panel">
        <h2>Seu treino</h2>
        <Field label="Observação geral do treino">
          {(id) => (
            <Textarea
              id={id}
              disabled={paused}
              maxLength={10000}
              defaultValue={session.notes}
              placeholder="Como você se sentiu neste treino?"
              onChange={(event) => {
                const text = event.target.value
                void run(
                  () => sessionNote(session.id, text),
                  `notes:${session.id}`
                )
              }}
            />
          )}
        </Field>
        <div className="form-actions">
          {!paused && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={async () => {
                if (await settle())
                  await run(() => changeSession(session.id, "paused"))
              }}
            >
              <Pause size={16} />
              Pausar treino
            </Button>
          )}
          <ConfirmAction
            disabled={busy}
            label={
              <>
                <Check size={16} />
                Finalizar treino
              </>
            }
            title="Finalizar este treino?"
            description={
              allSets.some((row) => row.status === "pending")
                ? "Existem séries pendentes. Elas serão registradas como ignoradas. Tudo o que você concluiu e suas observações serão preservados."
                : "Suas séries e observações ficarão disponíveis no histórico."
            }
            onConfirm={async () => {
              if (!(await settle())) return
              const saved = await run(async () => {
                await changeSession(session.id, "completed")
                return true
              })
              if (saved) window.location.assign(`/historico/?id=${session.id}`)
            }}
          />
        </div>
      </section>
    </>
  )
}

function ExerciseCard({
  exercise,
  ordinal,
  paused,
}: {
  exercise: SessionExercise
  ordinal: number
  paused: boolean
}) {
  const { data, run, busy, unsaved, settle } = useApp()
  const [result, setResult] = useState("")
  if (!data) return null
  const sets = data.setRecords
    .filter((row) => row.sessionExerciseId === exercise.id)
    .sort((a, b) => a.setNumber - b.setNumber)
  const pending = sets.filter((row) => row.status === "pending").length
  const completedCount = sets.filter((row) => row.status === "completed").length
  const skipped = sets.filter((row) => row.status === "skipped").length
  const running = sets.some(
    (row) => row.type === "time" && row.timerStartedAt !== null
  )
  const completed = data.workoutSessions.filter(
    (row) => row.status === "completed"
  )
  const previous = data.sessionExercises
    .filter(
      (row) =>
        row.exerciseId === exercise.exerciseId &&
        row.type === exercise.type &&
        completed.some((session) => session.id === row.sessionId)
    )
    .sort(
      (a, b) =>
        (completed.find((row) => row.id === b.sessionId)?.startedAt ?? 0) -
        (completed.find((row) => row.id === a.sessionId)?.startedAt ?? 0)
    )[0]
  const previousSets = previous
    ? data.setRecords
        .filter(
          (row) =>
            row.sessionExerciseId === previous.id && row.status === "completed"
        )
        .sort((a, b) => a.setNumber - b.setNumber)
    : []
  return (
    <AccordionItem value={exercise.id} className="exercise-card">
      <AccordionTrigger className="exercise-card-trigger">
        <span className="order-number">{ordinal}</span>
        <span className="exercise-card-summary">
          <span className="exercise-card-name">{exercise.nameSnapshot}</span>
          <span className="exercise-card-target">
            Meta: {targetLabel(exercise)}
            {exercise.type === "time"
              ? ` (${duration(exercise.targetSeconds)})`
              : ""}
          </span>
          <span className="exercise-card-counts">
            <span>
              {completedCount}{" "}
              {completedCount === 1 ? "concluída" : "concluídas"}
            </span>
            <span>
              {skipped} {skipped === 1 ? "ignorada" : "ignoradas"}
            </span>
            <span>
              {pending} {pending === 1 ? "pendente" : "pendentes"}
            </span>
          </span>
        </span>
      </AccordionTrigger>
      <AccordionContent className="exercise-card-content">
        {exercise.notesSnapshot && (
          <p className="fixed-note">{exercise.notesSnapshot}</p>
        )}
        {previousSets.length > 0 && (
          <p className="subtle mb-4">
            Última sessão concluída:{" "}
            {previousSets
              .map((row) =>
                row.type === "time"
                  ? duration(row.durationSeconds)
                  : `${weight(row.weightKg)} kg × ${row.repetitions}`
              )
              .join(" · ")}
          </p>
        )}
        {sets.map((set) => (
          <SetRow key={set.id} set={set} disabled={paused} />
        ))}
        {!sets.length && (
          <p className="subtle">
            Este exercício está sem séries. Adicione uma para registrar.
          </p>
        )}
        <div className="form-actions">
          <Button
            variant="outline"
            disabled={busy || paused || unsaved}
            onClick={async () => {
              if (await settle()) await run(() => addSet(exercise.id))
            }}
          >
            <Plus size={16} />
            Adicionar série
          </Button>
          <ConfirmAction
            label={
              <>
                <Check size={16} />
                Concluir todas
              </>
            }
            title={`Concluir séries pendentes de ${exercise.nameSnapshot}?`}
            description={`Somente ${pending} ${pending === 1 ? "série pendente será concluída" : "séries pendentes serão concluídas"} com os valores atuais. Séries ignoradas e já concluídas serão preservadas. Esta ação não encerra o treino.`}
            disabled={busy || paused || unsaved || running || !pending}
            onConfirm={async () => {
              if (!(await settle())) return
              const count = await run(() => completePendingSets(exercise.id))
              if (count !== undefined)
                setResult(
                  count
                    ? `${count} ${count === 1 ? "série concluída" : "séries concluídas"} nesta ação.`
                    : "Nenhuma série pendente para concluir."
                )
            }}
          />
        </div>
        {(running || unsaved) && (
          <p className="invalid-hint" role="status">
            {running
              ? "Pare o cronômetro deste exercício para concluir todas as séries."
              : "Corrija os campos ou tente salvar novamente para concluir todas."}
          </p>
        )}
        {result && (
          <p className="success-banner" role="status">
            {result}
          </p>
        )}
        <p className="save-indicator" role="status">
          {busy
            ? "Salvando…"
            : unsaved
              ? "Há alterações não salvas"
              : "Alterações gravadas"}
        </p>
        <div className="mt-6">
          <Field label="Observação deste exercício nesta sessão">
            {(id) => (
              <Textarea
                id={id}
                maxLength={10000}
                disabled={paused}
                defaultValue={exercise.sessionNotes}
                placeholder="Como foi hoje? Algo para lembrar no próximo treino?"
                onChange={(event) => {
                  const text = event.target.value
                  void run(
                    () => sessionNote(exercise.id, text, true),
                    `notes:${exercise.id}`
                  )
                }}
              />
            )}
          </Field>
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}

function SetRow({ set, disabled }: { set: SetRecord; disabled: boolean }) {
  const { run, busy, settle } = useApp()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (set.type !== "time" || set.timerStartedAt === null) return
    const interval = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(interval)
  }, [set])
  const running = set.type === "time" && set.timerStartedAt !== null
  const elapsed =
    running && set.type === "time"
      ? Math.max(0, Math.floor((now - set.timerStartedAt!) / 1000))
      : 0
  return (
    <div
      className={`set-row ${set.type === "time" ? "is-time" : ""} ${set.status === "completed" ? "is-completed" : ""}`}
    >
      <span className="order-number">{set.setNumber}</span>
      {set.type === "weight_reps" ? (
        <>
          <EditableValue
            label={`Carga da série ${set.setNumber} (kg)`}
            fieldKey={`${set.id}/weight`}
            value={set.weightKg}
            disabled={disabled}
            max={10000}
            min={0}
            onValue={(value) =>
              run(
                () => updateSet(set.id, { weightKg: value }),
                `${set.id}/weight`
              )
            }
          />
          <EditableValue
            label={`Repetições da série ${set.setNumber}`}
            fieldKey={`${set.id}/reps`}
            value={set.repetitions}
            disabled={disabled}
            max={10000}
            min={1}
            integer
            onValue={(value) =>
              run(
                () => updateSet(set.id, { repetitions: value }),
                `${set.id}/reps`
              )
            }
          />
        </>
      ) : (
        <>
          <EditableValue
            label={`Duração da série ${set.setNumber} (segundos)`}
            fieldKey={`${set.id}/time`}
            value={set.durationSeconds}
            disabled={disabled || running}
            max={86400}
            min={1}
            integer
            durationHint
            onValue={(value) =>
              run(
                () => updateSet(set.id, { durationSeconds: value }),
                `${set.id}/time`
              )
            }
          />
          <div className="field">
            <span className="subtle">Cronômetro</span>
            {running ? (
              <span className="timer-value" role="timer">
                {duration(elapsed)}
              </span>
            ) : (
              <span className="subtle">Medição de uma nova série</span>
            )}
            <Button
              variant="outline"
              disabled={disabled || busy || set.status !== "pending"}
              onClick={async () => {
                if (await settle()) await run(() => toggleTimer(set.id))
              }}
            >
              {running ? (
                <>
                  <Square size={14} />
                  Parar
                </>
              ) : (
                <>
                  <Play size={14} />
                  Cronometrar
                </>
              )}
            </Button>
          </div>
        </>
      )}
      <div className="set-buttons">
        <Button
          aria-label={`${set.status === "completed" ? "Desfazer" : "Concluir"} série ${set.setNumber}`}
          disabled={disabled || busy || running}
          variant={set.status === "completed" ? "default" : "outline"}
          onClick={async () => {
            if (await settle())
              await run(() =>
                updateSet(set.id, {
                  status: set.status === "completed" ? "pending" : "completed",
                })
              )
          }}
        >
          {set.status === "completed" ? (
            <Undo2 size={17} />
          ) : (
            <Check size={17} />
          )}
          {set.status === "completed" ? "Desfazer" : "Concluir"}
        </Button>
        <Button
          variant="ghost"
          aria-label={`${set.status === "skipped" ? "Retomar" : "Ignorar"} série ${set.setNumber}`}
          title={`${set.status === "skipped" ? "Retomar" : "Ignorar"} série ${set.setNumber}`}
          disabled={disabled || busy || running}
          onClick={async () => {
            if (await settle())
              await run(() =>
                updateSet(set.id, {
                  status: set.status === "skipped" ? "pending" : "skipped",
                })
              )
          }}
        >
          <SkipForward size={17} />
        </Button>
        <ConfirmAction
          label={<Trash2 size={15} />}
          disabled={disabled || busy || running}
          title={`Remover série ${set.setNumber}?`}
          description="A série e seus valores serão removidos apenas desta sessão."
          destructive
          onConfirm={async () => {
            if (await settle()) await run(() => removeSet(set.id))
          }}
        />
        <span className="set-status">
          {set.status === "completed"
            ? "Concluída"
            : set.status === "skipped"
              ? "Ignorada"
              : "Pendente"}
        </span>
      </div>
    </div>
  )
}

function EditableValue({
  label,
  fieldKey,
  value,
  disabled,
  durationHint,
  integer,
  min,
  max,
  onValue,
}: {
  label: string
  fieldKey: string
  value: number
  disabled: boolean
  durationHint?: boolean
  integer?: boolean
  min: number
  max: number
  onValue: (value: number) => Promise<unknown>
}) {
  const { invalid } = useApp()
  const [text, setText] = useState(() => numericText(String(value)))
  const [error, setError] = useState("")
  const editing = useRef(false)
  const invalidDraft = useRef(false)
  useEffect(() => {
    if (!editing.current && !invalidDraft.current)
      setText(numericText(String(value)))
  }, [value])
  useEffect(() => () => invalid(fieldKey, false), [fieldKey, invalid])
  return (
    <Field label={label}>
      {(id) => (
        <>
          <NumberInput
            id={id}
            required
            integer={integer}
            min={min}
            max={max}
            value={text}
            disabled={disabled}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : undefined}
            onFocus={() => {
              editing.current = true
            }}
            onBlur={() => {
              editing.current = false
            }}
            onValueChange={(next) => {
              setText(next)
              try {
                const parsed = numericValue(next, integer)
                if (parsed === null)
                  throw new Error(
                    next
                      ? "Informe um número completo."
                      : "Preencha este campo antes de continuar."
                  )
                if (
                  parsed < min ||
                  parsed > max ||
                  (integer && !Number.isInteger(parsed))
                )
                  throw new Error(
                    `Use ${integer ? "um inteiro" : "um valor"} entre ${min} e ${max}.`
                  )
                setError("")
                invalidDraft.current = false
                invalid(fieldKey, false)
                void onValue(parsed)
              } catch (cause) {
                invalidDraft.current = true
                setError(
                  cause instanceof Error ? cause.message : "Valor inválido"
                )
                invalid(fieldKey, true)
              }
            }}
          />
          {durationHint && (
            <span className="subtle">
              {numericValue(text, true) === null
                ? "—"
                : duration(numericValue(text, true)!)}{" "}
              (mm:ss)
            </span>
          )}
          {error && (
            <span className="invalid-hint" id={`${id}-error`}>
              {error}
            </span>
          )}
        </>
      )}
    </Field>
  )
}
