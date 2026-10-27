import { z } from "zod"

export const exerciseType = z.enum(["weight_reps", "time"])
const id = z.uuid()
const timestamp = z.number().int().nonnegative()
const note = z.string().max(10000)
export function validReps(value: string) {
  if (!/^\d+(?:\s*[-–]\s*\d+)?$/.test(value)) return false
  const [min = 0, max = min] = value.split(/[-–]/).map(Number)
  return min > 0 && max >= min && max <= 10000
}
export const targetsSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("weight_reps"),
    targetSets: z.number().int().min(1).max(100),
    targetReps: z
      .string()
      .refine(validReps, "Informe repetições como 10 ou 8-12"),
  }),
  z.object({
    type: z.literal("time"),
    targetSets: z.number().int().min(1).max(100),
    targetSeconds: z.number().int().min(1).max(86400),
  }),
])
export const definitionSchema = z.object({
  id,
  name: z.string().trim().min(1).max(200),
  defaultType: exerciseType,
  notes: note,
  archived: z.boolean(),
  createdAt: timestamp,
  updatedAt: timestamp,
})
export const templateSchema = z.object({
  id,
  code: z.string().trim().min(1).max(30),
  name: z.string().trim().min(1).max(200),
  description: note,
  order: z.number().int().nonnegative(),
  archived: z.boolean(),
  createdAt: timestamp,
  updatedAt: timestamp,
})
const templateExerciseBase = z.object({
  id,
  templateId: id,
  exerciseId: id,
  order: z.number().int().nonnegative(),
  notes: note,
})
export const templateExerciseSchema = z.intersection(
  templateExerciseBase,
  targetsSchema
)
export const sessionSchema = z.object({
  id,
  templateId: id,
  workoutName: z.string().min(1),
  workoutCode: z.string().min(1),
  startedAt: timestamp,
  localDate: z.iso.date(),
  finishedAt: timestamp.nullable(),
  status: z.enum(["active", "paused", "completed"]),
  notes: note,
})
export const sessionExerciseSchema = z.intersection(
  z.object({
    id,
    sessionId: id,
    exerciseId: id,
    nameSnapshot: z.string().min(1),
    order: z.number().int().nonnegative(),
    notesSnapshot: note,
    sessionNotes: note,
  }),
  targetsSchema
)
const setBase = {
  id,
  sessionExerciseId: id,
  setNumber: z.number().int().min(1),
  status: z.enum(["pending", "completed", "skipped"]),
  completedAt: timestamp.nullable(),
}
export const setSchema = z.discriminatedUnion("type", [
  z.object({
    ...setBase,
    type: z.literal("weight_reps"),
    weightKg: z.number().min(0).max(10000),
    repetitions: z.number().int().min(1).max(10000),
  }),
  z.object({
    ...setBase,
    type: z.literal("time"),
    durationSeconds: z.number().int().min(1).max(86400),
    timerStartedAt: timestamp.nullable(),
  }),
])
export const settingSchema = z.object({
  key: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
})
export const backupSchema = z.object({
  format: z.literal("gymtrack-backup"),
  schemaVersion: z.literal(2),
  exportedAt: timestamp,
  exerciseDefinitions: z.array(definitionSchema),
  workoutTemplates: z.array(templateSchema),
  templateExercises: z.array(templateExerciseSchema),
  workoutSessions: z.array(sessionSchema),
  sessionExercises: z.array(sessionExerciseSchema),
  setRecords: z.array(setSchema),
  settings: z.array(settingSchema),
})
export type Targets = z.infer<typeof targetsSchema>
export type ExerciseDefinition = z.infer<typeof definitionSchema>
export type WorkoutTemplate = z.infer<typeof templateSchema>
export type TemplateExercise = z.infer<typeof templateExerciseSchema>
export type WorkoutSession = z.infer<typeof sessionSchema>
export type SessionExercise = z.infer<typeof sessionExerciseSchema>
export type SetRecord = z.infer<typeof setSchema>
export type Setting = z.infer<typeof settingSchema>
export type Backup = z.infer<typeof backupSchema>

export function numberValue(value: string) {
  if (!value.trim()) throw new Error("Preencha o valor numérico.")
  const parsed = Number(value.trim().replace(",", "."))
  if (!Number.isFinite(parsed)) throw new Error("Informe um número válido.")
  return parsed
}
export function secondsValue(value: string) {
  if (!value.includes(":")) return numberValue(value)
  if (!/^\d+:\d{2}$/.test(value)) throw new Error("Use segundos ou mm:ss.")
  const [minutes = 0, seconds = 0] = value.split(":").map(Number)
  if (seconds > 59) throw new Error("Segundos devem estar entre 00 e 59.")
  return minutes * 60 + seconds
}
export function duration(seconds: number) {
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`
}
export const weight = (value: number) =>
  value.toLocaleString("pt-BR", { maximumFractionDigits: 3 })
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}
export const newId = () => crypto.randomUUID()
export function errorMessage(error: unknown) {
  if (error instanceof z.ZodError) {
    const labels: Record<string, string> = {
      name: "Nome",
      code: "Código do treino",
      targetSets: "Séries",
      targetReps: "Repetições",
      targetSeconds: "Duração (segundos)",
      notes: "Observações",
      weightKg: "Carga (kg)",
      repetitions: "Repetições",
      durationSeconds: "Duração (segundos)",
      type: "Tipo",
      id: "Identificador",
      format: "Formato do backup",
      schemaVersion: "Versão do backup",
    }
    return error.issues
      .map((issue) => {
        const key = String(issue.path.at(-1) ?? "Dados")
        const field = labels[key] ?? "Dados do arquivo"
        if (issue.code === "too_small")
          return `${field}: informe um valor de pelo menos ${issue.minimum}.`
        if (issue.code === "too_big")
          return `${field}: o limite é ${issue.maximum}.`
        if (issue.code === "invalid_type")
          return `${field}: valor obrigatório ou em formato inválido.`
        if (issue.code === "custom") return `${field}: ${issue.message}.`
        return `${field}: valor ou formato inválido.`
      })
      .join(" ")
  }
  return error instanceof Error
    ? error.message
    : "Não foi possível salvar. Tente novamente."
}
