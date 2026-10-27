import { db, type GymDatabase } from "@/db/database"
import { snapshot } from "@/db/repository"
import { backupSchema, type Backup } from "@/lib/schema"

const tables = [
  "exerciseDefinitions",
  "workoutTemplates",
  "templateExercises",
  "workoutSessions",
  "sessionExercises",
  "setRecords",
  "settings",
] as const
export function validateBackup(input: unknown): Backup {
  if (
    typeof input === "object" &&
    input !== null &&
    "schemaVersion" in input &&
    input.schemaVersion !== 1 &&
    input.schemaVersion !== 2
  )
    throw new Error(
      "Versão de backup incompatível. Atualize o aplicativo antes de restaurar."
    )
  // V1 goals are discarded by the V2 schemas; actual set weights are unchanged.
  const normalized =
    typeof input === "object" &&
    input !== null &&
    "schemaVersion" in input &&
    input.schemaVersion === 1
      ? { ...input, schemaVersion: 2 }
      : input
  const backup = backupSchema.parse(normalized)
  for (const table of tables) {
    const keys = backup[table].map((row) => ("id" in row ? row.id : row.key))
    if (new Set(keys).size !== keys.length)
      throw new Error(`IDs duplicados em ${table}.`)
  }
  const definitions = new Map(
    backup.exerciseDefinitions.map((row) => [row.id, row])
  )
  const templates = new Map(backup.workoutTemplates.map((row) => [row.id, row]))
  const sessions = new Map(backup.workoutSessions.map((row) => [row.id, row]))
  const exercises = new Map(backup.sessionExercises.map((row) => [row.id, row]))
  if (
    new Set(backup.workoutTemplates.map((row) => row.code.toLocaleLowerCase()))
      .size !== templates.size
  )
    throw new Error(
      "Códigos de fichas duplicados. Renomeie as fichas antes de mesclar."
    )
  if (
    backup.workoutSessions.filter((row) => row.status !== "completed").length >
    1
  )
    throw new Error(
      "O resultado teria duas sessões pendentes. Encerre uma delas antes de mesclar."
    )
  for (const row of backup.templateExercises)
    if (!templates.has(row.templateId) || !definitions.has(row.exerciseId))
      throw new Error("Exercício de ficha com relacionamento inválido.")
  for (const row of backup.workoutSessions) {
    if (!templates.has(row.templateId))
      throw new Error("Sessão sem ficha de origem.")
    if (
      row.status === "completed"
        ? row.finishedAt === null || row.finishedAt < row.startedAt
        : row.finishedAt !== null
    )
      throw new Error("Data de conclusão de sessão inválida.")
  }
  for (const row of backup.sessionExercises)
    if (!sessions.has(row.sessionId) || !definitions.has(row.exerciseId))
      throw new Error("Exercício histórico com relacionamento inválido.")
  const numbers = new Set<string>()
  for (const row of backup.setRecords) {
    const parent = exercises.get(row.sessionExerciseId)
    if (!parent || parent.type !== row.type)
      throw new Error("Série com exercício ou tipo inválido.")
    const key = `${row.sessionExerciseId}/${row.setNumber}`
    if (numbers.has(key))
      throw new Error("Número de série duplicado no mesmo exercício.")
    numbers.add(key)
    if ((row.status === "completed") !== (row.completedAt !== null))
      throw new Error("Data de conclusão da série inválida.")
    const session = sessions.get(parent.sessionId)!
    if (session.status === "completed" && row.status === "pending")
      throw new Error("Sessão concluída com série pendente.")
    if (
      row.type === "time" &&
      row.timerStartedAt !== null &&
      (session.status !== "active" || row.status !== "pending")
    )
      throw new Error("Cronômetro ativo em sessão ou série encerrada.")
  }
  return backup
}

export async function restoreBackup(
  input: unknown,
  mode: "merge" | "replace",
  database: GymDatabase = db
) {
  const incoming = validateBackup(input)
  // A timer imported on another device resumes paused at the moment of export.
  const normalized: Backup = {
    ...incoming,
    workoutSessions: incoming.workoutSessions.map((row) =>
      row.status === "active" ? { ...row, status: "paused" as const } : row
    ),
    setRecords: incoming.setRecords.map((row) =>
      row.type === "time" && row.timerStartedAt !== null
        ? {
            ...row,
            timerStartedAt: null,
            durationSeconds: Math.min(
              86400,
              Math.max(
                1,
                Math.floor((incoming.exportedAt - row.timerStartedAt) / 1000)
              )
            ),
          }
        : row
    ),
  }
  await database.transaction("rw", database.tables, async () => {
    const current = await snapshot(database)
    if (current.workoutSessions.some((row) => row.status !== "completed"))
      throw new Error("Encerre o treino pendente antes de restaurar dados.")
    const result: Backup = { ...normalized }
    if (mode === "merge") {
      for (const name of tables) {
        const local = current[name]
        const existing = new Set(
          local.map((row) => ("id" in row ? row.id : row.key))
        )
        Object.assign(result, {
          [name]: [
            ...local,
            ...normalized[name].filter(
              (row) => !existing.has("id" in row ? row.id : row.key)
            ),
          ],
        })
      }
    }
    validateBackup(result)
    for (const name of tables) {
      await database.table(name).clear()
      await database.table(name).bulkAdd(result[name])
    }
  })
}

export function csvCell(input: unknown) {
  let value =
    typeof input === "number"
      ? String(input).replace(".", ",")
      : String(input ?? "")
  if (/^\s*[=+@-]/.test(value)) value = "'" + value
  return `"${value.replaceAll('"', '""')}"`
}
export function csv(rows: unknown[][]) {
  return "\ufeff" + rows.map((row) => row.map(csvCell).join(";")).join("\r\n")
}
export function templatesCsv(data: Backup) {
  return csv([
    [
      "Treino",
      "Nome da ficha",
      "Exercício",
      "Tipo",
      "Séries",
      "Repetições",
      "Segundos",
      "Observações",
    ],
    ...data.workoutTemplates
      .flatMap((template) =>
        [...data.templateExercises]
          .filter((row) => row.templateId === template.id)
          .sort((a, b) => a.order - b.order)
      )
      .map((row) => {
        const template = data.workoutTemplates.find(
          (item) => item.id === row.templateId
        )
        return [
          template?.code,
          template?.name,
          data.exerciseDefinitions.find((item) => item.id === row.exerciseId)
            ?.name,
          row.type === "time" ? "Tempo" : "Peso e repetições",
          row.targetSets,
          row.type === "weight_reps" ? row.targetReps : "",
          row.type === "time" ? row.targetSeconds : "",
          row.notes,
        ]
      }),
  ])
}
export function historyCsv(data: Backup) {
  return csv([
    [
      "Sessão ID",
      "Data local",
      "Início",
      "Fim",
      "Treino",
      "Nome",
      "Exercício",
      "Tipo",
      "Série",
      "Carga kg",
      "Repetições",
      "Duração segundos",
      "Status série",
      "Status sessão",
      "Meta séries",
      "Meta reps",
      "Meta segundos",
      "Observação fixa",
      "Observação exercício",
      "Observação sessão",
    ],
    ...data.setRecords.map((row) => {
      const exercise = data.sessionExercises.find(
        (item) => item.id === row.sessionExerciseId
      )!
      const session = data.workoutSessions.find(
        (item) => item.id === exercise.sessionId
      )!
      return [
        session.id,
        session.localDate,
        new Date(session.startedAt).toISOString(),
        session.finishedAt ? new Date(session.finishedAt).toISOString() : "",
        session.workoutCode,
        session.workoutName,
        exercise.nameSnapshot,
        row.type,
        row.setNumber,
        row.type === "weight_reps" ? row.weightKg : "",
        row.type === "weight_reps" ? row.repetitions : "",
        row.type === "time" ? row.durationSeconds : "",
        row.status,
        session.status,
        exercise.targetSets,
        exercise.type === "weight_reps" ? exercise.targetReps : "",
        exercise.type === "time" ? exercise.targetSeconds : "",
        exercise.notesSnapshot,
        exercise.sessionNotes,
        session.notes,
      ]
    }),
  ])
}
export function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = name
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}
export async function exportBackup(database: GymDatabase = db) {
  const data = validateBackup(await snapshot(database))
  downloadFile(
    `gymtrack-backup-${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify(data, null, 2),
    "application/json"
  )
  await database.settings.put({ key: "lastBackupAt", value: Date.now() })
}
