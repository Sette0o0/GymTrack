"use client"

import { useState } from "react"
import { ArrowUpRight, CalendarDays, Check, Clock3, Trash2 } from "lucide-react"
import { Input } from "@workspace/ui/components/input"
import { Badge } from "@workspace/ui/components/badge"
import { useApp } from "./app-shell"
import {
  Choice,
  ConfirmAction,
  EmptyState,
  Field,
  formatDate,
  PageHeading,
  TextLink,
} from "./ui-helpers"
import {
  duration,
  weight,
  type SessionExercise,
  type SetRecord,
} from "@/lib/schema"
import { deleteSession } from "@/services/sessions"
import { targetLabel } from "./workouts-screen"

export function HistoryScreen() {
  const { data, run, busy } = useApp()
  const [query] = useState(
    () =>
      new URLSearchParams(
        typeof window === "undefined" ? "" : window.location.search
      )
  )
  const [templateId, setTemplateId] = useState("all")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [exerciseId, setExerciseId] = useState(query.get("exercicio") ?? "all")
  const [now] = useState(() => Date.now())
  if (!data) return null
  const id = query.get("id")
  const session = data.workoutSessions.find((row) => row.id === id)
  if (id && !session)
    return (
      <EmptyState
        title="Registro não encontrado"
        action={
          <a className="button-link" href="/historico/">
            Ver histórico
          </a>
        }
      >
        O registro pode ter sido excluído ou pertencer a outro dispositivo.
      </EmptyState>
    )
  if (session) {
    const exercises = data.sessionExercises
      .filter((row) => row.sessionId === session.id)
      .sort((a, b) => a.order - b.order)
    const total = Math.max(
      0,
      Math.round(((session.finishedAt ?? now) - session.startedAt) / 60000)
    )
    return (
      <>
        <PageHeading
          eyebrow="CADA SÉRIE CONTA UMA HISTÓRIA"
          title={`${session.workoutCode} · ${session.workoutName}`}
          description={`${formatDate(session.localDate)} · ${new Date(session.startedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}${session.finishedAt ? ` — ${new Date(session.finishedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""} · ${total} min`}
          action={<TextLink href="/historico/">Todos os registros</TextLink>}
        />
        <div className="mb-6 flex items-center gap-3">
          <Badge variant="secondary">
            {session.status === "completed"
              ? "Concluído"
              : session.status === "paused"
                ? "Pausado"
                : "Em andamento"}
          </Badge>
          {session.status !== "completed" && (
            <a className="button-link" href={`/executar/?id=${session.id}`}>
              Retomar treino
            </a>
          )}
        </div>
        {session.notes && (
          <section className="panel">
            <h2>Observação do treino</h2>
            <p className="history-note">{session.notes}</p>
          </section>
        )}
        {exercises.map((exercise) => (
          <section className="panel" key={exercise.id}>
            <div className="section-heading">
              <div>
                <h2>
                  {exercise.order + 1}. {exercise.nameSnapshot}
                </h2>
                <p>Meta da sessão: {targetLabel(exercise)}</p>
              </div>
              <TextLink href={`/historico/?exercicio=${exercise.exerciseId}`}>
                Ver evolução
              </TextLink>
            </div>
            {exercise.notesSnapshot && (
              <p className="fixed-note">{exercise.notesSnapshot}</p>
            )}
            <SetsTable
              sets={data.setRecords
                .filter((row) => row.sessionExerciseId === exercise.id)
                .sort((a, b) => a.setNumber - b.setNumber)}
              exercise={exercise}
            />
            {exercise.sessionNotes && (
              <p className="history-note">
                <strong>Observação desta sessão:</strong>{" "}
                {exercise.sessionNotes}
              </p>
            )}
          </section>
        ))}
        <ConfirmAction
          label={
            <>
              <Trash2 size={15} />
              Excluir registro
            </>
          }
          title="Excluir este treino definitivamente?"
          description="Todas as séries e observações desta sessão serão removidas. Exporte um backup antes se quiser preservar uma cópia."
          disabled={busy}
          destructive
          onConfirm={async () => {
            if (
              await run(async () => {
                await deleteSession(session.id)
                return true
              })
            )
              window.location.assign("/historico/")
          }}
        />
      </>
    )
  }
  const sessions = data.workoutSessions.filter(
    (row) =>
      (templateId === "all" || row.templateId === templateId) &&
      (!from || row.localDate >= from) &&
      (!to || row.localDate <= to)
  )
  const exercise = data.exerciseDefinitions.find((row) => row.id === exerciseId)
  const exerciseRows = data.sessionExercises
    .filter(
      (row) =>
        row.exerciseId === exerciseId &&
        sessions.some(
          (session) =>
            session.id === row.sessionId && session.status === "completed"
        )
    )
    .sort(
      (a, b) =>
        (sessions.find((row) => row.id === b.sessionId)?.startedAt ?? 0) -
        (sessions.find((row) => row.id === a.sessionId)?.startedAt ?? 0)
    )
  return (
    <>
      <PageHeading
        eyebrow="SEU ESFORÇO FICA REGISTRADO"
        title={
          exercise ? `Evolução · ${exercise.name}` : "Histórico de treinos"
        }
        description="Consulte suas sessões e os valores de cada série, exatamente como foram registrados."
      />
      <div className="panel">
        <div className="filter-bar">
          <Field label="Ficha">
            {(id) => (
              <Choice
                id={id}
                value={templateId}
                onChange={setTemplateId}
                options={[
                  { value: "all", label: "Todas as fichas" },
                  ...data.workoutTemplates.map((row) => ({
                    value: row.id,
                    label: `${row.code} · ${row.name}`,
                  })),
                ]}
              />
            )}
          </Field>
          <Field label="A partir de">
            {(id) => (
              <Input
                type="date"
                id={id}
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            )}
          </Field>
          <Field label="Até">
            {(id) => (
              <Input
                type="date"
                id={id}
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            )}
          </Field>
        </div>
        <Field label="Evolução por exercício">
          {(id) => (
            <Choice
              id={id}
              value={exerciseId}
              onChange={setExerciseId}
              options={[
                {
                  value: "all",
                  label: "Mostrar sessões de todos os exercícios",
                },
                ...data.exerciseDefinitions.map((row) => ({
                  value: row.id,
                  label: row.name,
                })),
              ]}
            />
          )}
        </Field>
        {from && to && from > to && (
          <p className="invalid-hint mt-3">
            A data inicial deve ser anterior à data final.
          </p>
        )}
      </div>
      {exerciseId !== "all" ? (
        exerciseRows.length ? (
          exerciseRows.map((row) => {
            const session = sessions.find(
              (session) => session.id === row.sessionId
            )!
            return (
              <section className="panel" key={row.id}>
                <div className="section-heading">
                  <div>
                    <h2>{row.nameSnapshot}</h2>
                    <p>
                      {formatDate(session.localDate)} · {session.workoutCode} ·{" "}
                      {targetLabel(row)}
                    </p>
                  </div>
                  <TextLink href={`/historico/?id=${session.id}`}>
                    Abrir treino
                  </TextLink>
                </div>
                <SetsTable
                  sets={data.setRecords
                    .filter((set) => set.sessionExerciseId === row.id)
                    .sort((a, b) => a.setNumber - b.setNumber)}
                  exercise={row}
                />
                {row.sessionNotes && (
                  <p className="history-note">{row.sessionNotes}</p>
                )}
              </section>
            )
          })
        ) : (
          <EmptyState title="O primeiro registro ainda está por vir">
            Conclua um treino com este exercício para começar a acompanhar a
            evolução.
          </EmptyState>
        )
      ) : sessions.length ? (
        <div className="recent-list">
          {sessions.map((row) => (
            <a
              href={`/historico/?id=${row.id}`}
              className="recent-row"
              key={row.id}
            >
              <span className="recent-check">
                {row.status === "completed" ? (
                  <Check size={19} />
                ) : (
                  <Clock3 size={19} />
                )}
              </span>
              <div>
                <strong>
                  {row.workoutCode} · {row.workoutName}
                </strong>
                <small>
                  <CalendarDays size={13} />
                  {formatDate(row.localDate)}
                </small>
              </div>
              <Badge variant="secondary" className="ml-auto">
                {row.status === "completed" ? "Concluído" : "Pendente"}
              </Badge>
              <ArrowUpRight size={17} />
            </a>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Cada treino é um novo registro"
          action={
            <a className="button-link" href="/treinos/">
              Escolher ficha
            </a>
          }
        >
          Os treinos realizados aparecerão aqui. Se você aplicou filtros, tente
          outro período.
        </EmptyState>
      )}
    </>
  )
}

function SetsTable({
  sets,
  exercise,
}: {
  sets: SetRecord[]
  exercise: SessionExercise
}) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Série</th>
            <th>{exercise.type === "time" ? "Duração" : "Carga"}</th>
            {exercise.type === "weight_reps" && <th>Repetições</th>}
            <th>Status</th>
            <th>Em relação à meta</th>
          </tr>
        </thead>
        <tbody>
          {sets.map((set) => (
            <tr key={set.id}>
              <td>{set.setNumber}</td>
              <td>
                {set.type === "time"
                  ? duration(set.durationSeconds)
                  : `${weight(set.weightKg)} kg`}
              </td>
              {set.type === "weight_reps" && <td>{set.repetitions}</td>}
              <td>
                {set.status === "completed"
                  ? "Concluída"
                  : set.status === "skipped"
                    ? "Ignorada"
                    : "Pendente"}
              </td>
              <td>
                {set.status !== "completed"
                  ? "—"
                  : set.type === "time" && exercise.type === "time"
                    ? `${set.durationSeconds - exercise.targetSeconds >= 0 ? "+" : ""}${set.durationSeconds - exercise.targetSeconds}s`
                    : set.type === "weight_reps" &&
                        exercise.type === "weight_reps"
                      ? `${set.weightKg - exercise.targetWeight >= 0 ? "+" : ""}${weight(set.weightKg - exercise.targetWeight)} kg · meta ${exercise.targetReps} reps`
                      : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!sets.length && (
        <p className="subtle mt-4">Nenhuma série nesta sessão.</p>
      )}
    </div>
  )
}
