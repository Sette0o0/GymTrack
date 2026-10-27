"use client"

import { useState, type FormEvent } from "react"
import {
  Archive,
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  Dumbbell,
  Pencil,
  Play,
  Plus,
  Search,
  Trash2,
} from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Textarea } from "@workspace/ui/components/textarea"
import { Badge } from "@workspace/ui/components/badge"
import { useApp } from "./app-shell"
import {
  Choice,
  ConfirmAction,
  EmptyState,
  Field,
  PageHeading,
  TextLink,
} from "./ui-helpers"
import {
  archiveWorkout,
  emptyWorkout,
  saveDefinition,
  saveWorkout,
} from "@/services/workouts"
import { startSession } from "@/services/sessions"
import {
  definitionSchema,
  errorMessage,
  newId,
  numberValue,
  secondsValue,
  targetsSchema,
  templateExerciseSchema,
  templateSchema,
  type ExerciseDefinition,
  type Targets,
  type TemplateExercise,
  type WorkoutTemplate,
} from "@/lib/schema"

const typeOptions = [
  { value: "weight_reps", label: "Peso + repetições" },
  { value: "time", label: "Tempo" },
]
const param = (key: string) =>
  typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get(key)
    : null

export function WorkoutsScreen() {
  const { data, run, busy } = useApp()
  const [editing, setEditing] = useState<WorkoutTemplate | null>(() =>
    data
      ? (data.workoutTemplates.find((row) => row.id === param("id")) ??
        (param("novo") ? emptyWorkout(data.workoutTemplates.length) : null))
      : null
  )
  const [showArchived, setShowArchived] = useState(false)
  if (!data) return null
  const pending = data.workoutSessions.find((row) => row.status !== "completed")
  if (editing)
    return (
      <WorkoutEditor
        key={editing.id}
        template={editing}
        onClose={() => {
          setEditing(null)
          window.history.replaceState(null, "", "/treinos/")
        }}
      />
    )
  return (
    <>
      <PageHeading
        eyebrow="ORGANIZE SUA ROTINA"
        title="Minhas fichas"
        description="Monte treinos que acompanham o seu ritmo."
        action={
          <Button
            onClick={() =>
              setEditing(emptyWorkout(data.workoutTemplates.length))
            }
          >
            <Plus size={17} />
            Nova ficha
          </Button>
        }
      />
      <div className="filter-bar">
        <Button
          variant="outline"
          onClick={() => setShowArchived(!showArchived)}
        >
          <Archive size={16} />
          {showArchived ? "Mostrar ativas" : "Mostrar arquivadas"}
        </Button>
        <TextLink href="/importar/">Importar do Excel</TextLink>
        <TextLink href="/exercicios/">Catálogo de exercícios</TextLink>
      </div>
      {pending && (
        <div className="success-banner">
          Você tem um treino pendente.{" "}
          <a
            className="font-semibold underline"
            href={`/executar/?id=${pending.id}`}
          >
            Retomar ou encerrar
          </a>
        </div>
      )}
      {!data.workoutTemplates.some((row) => row.archived === showArchived) ? (
        <EmptyState
          title={
            showArchived
              ? "Nenhuma ficha arquivada"
              : "Sua rotina começa com uma ficha"
          }
          action={
            !showArchived && (
              <Button
                onClick={() =>
                  setEditing(emptyWorkout(data.workoutTemplates.length))
                }
              >
                <Plus size={17} />
                Criar primeira ficha
              </Button>
            )
          }
        >
          Escolha seus exercícios e defina as metas de cada treino.
        </EmptyState>
      ) : (
        <div className="workout-grid">
          {data.workoutTemplates
            .filter((row) => row.archived === showArchived)
            .map((template, index) => (
              <div className="panel" key={template.id}>
                <span className={`workout-letter tone-${index % 3}`}>
                  {template.code}
                </span>
                <h2 className="mt-4">{template.name}</h2>
                <p className="subtle">
                  {template.description ||
                    `${data.templateExercises.filter((row) => row.templateId === template.id).length} exercícios na ficha`}
                </p>
                <div className="form-actions">
                  <Button
                    variant="outline"
                    onClick={() => setEditing(template)}
                  >
                    <Pencil size={15} />
                    Editar
                  </Button>
                  {!template.archived && (
                    <Button
                      disabled={busy || !!pending}
                      onClick={async () => {
                        const id = await run(() => startSession(template.id))
                        if (id) window.location.assign(`/executar/?id=${id}`)
                      }}
                    >
                      <Play size={15} />
                      Iniciar
                    </Button>
                  )}
                  <ConfirmAction
                    label={
                      <>
                        <Archive size={15} />
                        {template.archived ? "Restaurar" : "Arquivar"}
                      </>
                    }
                    title={
                      template.archived ? "Restaurar ficha?" : "Arquivar ficha?"
                    }
                    description="Seus treinos já realizados e o histórico permanecem preservados."
                    disabled={busy}
                    onConfirm={() =>
                      run(() => archiveWorkout(template.id, !template.archived))
                    }
                  />
                </div>
              </div>
            ))}
        </div>
      )}
    </>
  )
}

type Draft = {
  id: string
  exerciseId: string
  type: "weight_reps" | "time"
  sets: string
  reps: string
  seconds: string
  notes: string
}
function toDraft(exercise: TemplateExercise): Draft {
  return {
    id: exercise.id,
    exerciseId: exercise.exerciseId,
    type: exercise.type,
    sets: String(exercise.targetSets),
    reps: exercise.type === "weight_reps" ? exercise.targetReps : "8-12",
    seconds: exercise.type === "time" ? String(exercise.targetSeconds) : "45",
    notes: exercise.notes,
  }
}

function WorkoutEditor({
  template,
  onClose,
}: {
  template: WorkoutTemplate
  onClose: () => void
}) {
  const { data, run, busy } = useApp()
  const [name, setName] = useState(template.name)
  const [code, setCode] = useState(template.code)
  const [description, setDescription] = useState(template.description)
  const [rows, setRows] = useState<Draft[]>(() =>
    (
      data?.templateExercises.filter((row) => row.templateId === template.id) ??
      []
    )
      .sort((a, b) => a.order - b.order)
      .map(toDraft)
  )
  const [selected, setSelected] = useState("none")
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState("")
  if (!data) return null
  function update(id: string, patch: Partial<Draft>) {
    setRows((previous) =>
      previous.map((row) => (row.id === id ? { ...row, ...patch } : row))
    )
  }
  function add(definition: ExerciseDefinition) {
    setRows((previous) => [
      ...previous,
      {
        id: newId(),
        exerciseId: definition.id,
        type: definition.defaultType,
        sets: "3",
        reps: "8-12",
        seconds: "45",
        notes: "",
      },
    ])
    setSelected("none")
  }
  function move(index: number, offset: number) {
    setRows((previous) => {
      const next = [...previous]
      const [row] = next.splice(index, 1)
      if (row) next.splice(index + offset, 0, row)
      return next
    })
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    setError("")
    try {
      const nextTemplate = templateSchema.parse({
        ...template,
        code,
        name,
        description,
      })
      const exercises = rows.map((row, order) =>
        templateExerciseSchema.parse({
          id: row.id,
          templateId: template.id,
          exerciseId: row.exerciseId,
          order,
          notes: row.notes,
          ...targetsSchema.parse(
            row.type === "time"
              ? {
                  type: row.type,
                  targetSets: numberValue(row.sets),
                  targetSeconds: secondsValue(row.seconds),
                }
              : {
                  type: row.type,
                  targetSets: numberValue(row.sets),
                  targetReps: row.reps,
                }
          ),
        })
      )
      const saved = await run(async () => {
        await saveWorkout(nextTemplate, exercises)
        return true
      })
      if (saved) onClose()
    } catch (cause) {
      setError(errorMessage(cause))
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="DO SEU JEITO"
        title={template.name ? "Editar ficha" : "Nova ficha"}
        description="Defina as metas. As sessões anteriores continuam como foram realizadas."
      />
      <form onSubmit={submit}>
        <section className="panel">
          <h2>Informações da ficha</h2>
          <div className="form-grid">
            <Field label="Código do treino">
              {(id) => (
                <Input
                  id={id}
                  required
                  maxLength={30}
                  placeholder="Ex.: A"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                />
              )}
            </Field>
            <Field label="Nome da ficha">
              {(id) => (
                <Input
                  id={id}
                  required
                  maxLength={200}
                  placeholder="Ex.: Peito e tríceps"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              )}
            </Field>
          </div>
          <div className="mt-5">
            <Field label="Descrição (opcional)">
              {(id) => (
                <Textarea
                  id={id}
                  maxLength={10000}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              )}
            </Field>
          </div>
        </section>
        <section className="panel">
          <div className="section-heading">
            <h2>Exercícios da ficha</h2>
            <Badge variant="secondary">{rows.length} exercícios</Badge>
          </div>
          {rows.map((row, index) => (
            <section className="exercise-editor" key={row.id}>
              <header>
                <span className="order-number">{index + 1}</span>
                <h3>
                  {
                    data.exerciseDefinitions.find(
                      (exercise) => exercise.id === row.exerciseId
                    )?.name
                  }
                </h3>
                <div className="editor-controls">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={index === 0}
                    aria-label={`Subir exercício ${index + 1}`}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp size={15} />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={index === rows.length - 1}
                    aria-label={`Descer exercício ${index + 1}`}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown size={15} />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label={`Remover exercício ${index + 1}`}
                    onClick={() =>
                      setRows(rows.filter((item) => item.id !== row.id))
                    }
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
              </header>
              <div className="form-grid">
                <Field label="Medição">
                  {(id) => (
                    <Choice
                      id={id}
                      value={row.type}
                      options={typeOptions}
                      onChange={(type) =>
                        update(row.id, { type: type as Draft["type"] })
                      }
                    />
                  )}
                </Field>
                <Field label="Quantidade de séries">
                  {(id) => (
                    <Input
                      id={id}
                      required
                      inputMode="numeric"
                      value={row.sets}
                      onChange={(event) =>
                        update(row.id, { sets: event.target.value })
                      }
                    />
                  )}
                </Field>
                {row.type === "weight_reps" ? (
                  <>
                    <Field
                      label="Meta de repetições"
                      hint="Um valor ou intervalo, como 8-12."
                    >
                      {(id) => (
                        <Input
                          id={id}
                          required
                          value={row.reps}
                          onChange={(event) =>
                            update(row.id, { reps: event.target.value })
                          }
                        />
                      )}
                    </Field>
                  </>
                ) : (
                  <Field
                    label="Meta de duração"
                    hint="Segundos ou mm:ss. Ex.: 45 ou 01:30."
                  >
                    {(id) => (
                      <Input
                        id={id}
                        required
                        inputMode="text"
                        value={row.seconds}
                        onChange={(event) =>
                          update(row.id, { seconds: event.target.value })
                        }
                      />
                    )}
                  </Field>
                )}
              </div>
              <div className="mt-4">
                <Field label="Observação fixa nesta ficha">
                  {(id) => (
                    <Textarea
                      id={id}
                      maxLength={10000}
                      value={row.notes}
                      placeholder="Ajustes, técnica ou lembretes…"
                      onChange={(event) =>
                        update(row.id, { notes: event.target.value })
                      }
                    />
                  )}
                </Field>
              </div>
            </section>
          ))}
          {!rows.length && (
            <p className="subtle mb-5">
              Adicione exercícios do seu catálogo. Você também pode criar um
              agora.
            </p>
          )}
          <div className="form-grid">
            <Field label="Escolher do catálogo">
              {(id) => (
                <Choice
                  id={id}
                  value={selected}
                  options={[
                    { value: "none", label: "Selecione um exercício" },
                    ...data.exerciseDefinitions
                      .filter((row) => !row.archived)
                      .map((row) => ({ value: row.id, label: row.name })),
                  ]}
                  onChange={setSelected}
                />
              )}
            </Field>
            <div className="flex items-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={selected === "none"}
                onClick={() => {
                  const definition = data.exerciseDefinitions.find(
                    (row) => row.id === selected
                  )
                  if (definition) add(definition)
                }}
              >
                <Plus size={16} />
                Adicionar
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCreating(!creating)}
              >
                Criar exercício
              </Button>
            </div>
          </div>
        </section>
        {error && (
          <p role="alert" className="error-banner">
            {error}
          </p>
        )}
        <div className="form-actions">
          <Button type="submit" disabled={busy}>
            Salvar ficha
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
      {creating && (
        <div className="panel mt-5">
          <DefinitionForm
            onSaved={(definition) => {
              add(definition)
              setCreating(false)
            }}
            onCancel={() => setCreating(false)}
          />
        </div>
      )}
    </>
  )
}

export function DefinitionForm({
  definition,
  onSaved,
  onCancel,
}: {
  definition?: ExerciseDefinition
  onSaved: (definition: ExerciseDefinition) => void
  onCancel: () => void
}) {
  const { run, busy } = useApp()
  const [name, setName] = useState(definition?.name ?? "")
  const [type, setType] = useState(definition?.defaultType ?? "weight_reps")
  const [notes, setNotes] = useState(definition?.notes ?? "")
  const [error, setError] = useState("")
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault()
        setError("")
        try {
          const item = definitionSchema.parse({
            id: definition?.id ?? newId(),
            name,
            defaultType: type,
            notes,
            archived: definition?.archived ?? false,
            createdAt: definition?.createdAt ?? Date.now(),
            updatedAt: Date.now(),
          })
          if (
            await run(async () => {
              await saveDefinition(item)
              return true
            })
          )
            onSaved(item)
        } catch (cause) {
          setError(errorMessage(cause))
        }
      }}
    >
      <h2>{definition ? "Editar exercício" : "Novo exercício"}</h2>
      <div className="form-grid">
        <Field label="Nome do exercício">
          {(id) => (
            <Input
              id={id}
              autoFocus
              required
              maxLength={200}
              placeholder="Ex.: Supino reto"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          )}
        </Field>
        <Field label="Tipo padrão">
          {(id) => (
            <Choice
              id={id}
              value={type}
              options={typeOptions}
              onChange={(value) => setType(value as "weight_reps" | "time")}
            />
          )}
        </Field>
      </div>
      <div className="mt-5">
        <Field label="Instruções gerais (opcional)">
          {(id) => (
            <Textarea
              id={id}
              maxLength={10000}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          )}
        </Field>
      </div>
      {error && (
        <p role="alert" className="invalid-hint mt-3">
          {error}
        </p>
      )}
      <div className="form-actions">
        <Button type="submit" disabled={busy}>
          Salvar exercício
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}

export function ExercisesScreen() {
  const { data, run, busy } = useApp()
  const [query, setQuery] = useState("")
  const [editing, setEditing] = useState<ExerciseDefinition | "new" | null>(
    null
  )
  const [archived, setArchived] = useState(false)
  if (!data) return null
  return (
    <>
      <PageHeading
        eyebrow="SEU CATÁLOGO"
        title="Exercícios"
        description="Cadastre uma vez e use em quantas fichas quiser."
        action={
          <Button onClick={() => setEditing("new")}>
            <Plus size={17} />
            Novo exercício
          </Button>
        }
      />
      {editing && (
        <section className="panel">
          <DefinitionForm
            key={editing === "new" ? "new" : editing.id}
            definition={editing === "new" ? undefined : editing}
            onSaved={() => setEditing(null)}
            onCancel={() => setEditing(null)}
          />
        </section>
      )}
      <div className="filter-bar">
        <Field label="Buscar exercício">
          {(id) => (
            <div className="relative">
              <Search
                className="absolute top-3 left-3 text-muted-foreground"
                size={17}
              />
              <Input
                className="pl-10"
                id={id}
                placeholder="Nome do exercício"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          )}
        </Field>
        <Button variant="outline" onClick={() => setArchived(!archived)}>
          {archived ? "Ver ativos" : "Ver arquivados"}
        </Button>
      </div>
      <section className="panel">
        {data.exerciseDefinitions
          .filter(
            (row) =>
              row.archived === archived &&
              row.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())
          )
          .map((row) => (
            <div className="catalog-row" key={row.id}>
              <span className="stat-icon green">
                <Dumbbell size={19} />
              </span>
              <div>
                <h3>{row.name}</h3>
                <p>
                  {row.defaultType === "time" ? "Tempo" : "Peso + repetições"}
                  {row.notes ? ` · ${row.notes}` : ""}
                </p>
              </div>
              <div className="catalog-actions">
                <a
                  className="text-link"
                  href={`/historico/?exercicio=${row.id}`}
                >
                  Evolução <ArrowUpRight size={15} />
                </a>
                <Button
                  variant="ghost"
                  aria-label={`Editar ${row.name}`}
                  onClick={() => setEditing(row)}
                >
                  <Pencil size={16} />
                </Button>
                <ConfirmAction
                  disabled={busy}
                  label={<Archive size={16} />}
                  title={
                    row.archived
                      ? "Restaurar exercício?"
                      : "Arquivar exercício?"
                  }
                  description="As fichas existentes e o histórico continuam disponíveis."
                  onConfirm={() =>
                    run(() =>
                      saveDefinition({ ...row, archived: !row.archived })
                    )
                  }
                />
              </div>
            </div>
          ))}
        {!data.exerciseDefinitions.length && (
          <EmptyState title="Um catálogo com a sua cara">
            Cadastre seus exercícios para montar a primeira ficha.
          </EmptyState>
        )}
      </section>
    </>
  )
}

export function targetLabel(target: Targets) {
  return target.type === "time"
    ? `${target.targetSets} séries · ${target.targetSeconds}s`
    : `${target.targetSets} séries · ${target.targetReps} reps`
}
