import { db, type GymDatabase } from "@/db/database"
import {
  errorMessage,
  newId,
  numberValue,
  secondsValue,
  targetsSchema,
  type Targets,
  type TemplateExercise,
} from "@/lib/schema"

export const importFields = {
  code: "Código do treino",
  name: "Nome da ficha",
  exercise: "Exercício",
  type: "Tipo",
  sets: "Séries",
  reps: "Repetições",
  weight: "Carga (kg)",
  seconds: "Duração",
  notes: "Observações",
}
export type ImportField = keyof typeof importFields
export type Mapping = Partial<Record<ImportField, number>>
export type SheetInput = {
  sheet: string
  data: unknown[][]
  selected: boolean
  headerRow: number
  mapping: Mapping
  durationUnit: "seconds" | "minutes"
  excluded: number[]
}
export type ImportRow = {
  key: string
  sheet: string
  row: number
  code: string
  name: string
  exercise: string
  notes: string
  targets?: Targets
  durationHint?: string
  errors: string[]
  excluded: boolean
}
export type ImportPolicy = "skip" | "update" | "new"
const normalize = (value: string) =>
  value
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()

const durationSuffix = /^(.*\d)\s*(s|segs?|segundos?|mins?|minutos?)\.?$/i
function hasTimeNotation(value: string) {
  return durationSuffix.test(value) || /^\d[\d:\s–—-]*:\d{2}$/.test(value)
}
function importDuration(
  value: string,
  defaultUnit: SheetInput["durationUnit"]
) {
  const match = value.match(durationSuffix)
  const unit = match?.[2]?.toLocaleLowerCase()
  const multiplier = unit
    ? unit.startsWith("min")
      ? 60
      : 1
    : defaultUnit === "minutes"
      ? 60
      : 1
  const parts = (match?.[1] ?? value).trim().split(/\s*[-–—]\s*/)
  if (parts.length > 2)
    throw new Error("Duração: use um valor ou intervalo como 30–45 s.")
  const values = parts.map((part) => {
    const seconds = part.includes(":")
      ? secondsValue(part)
      : numberValue(part) * multiplier
    const rounded = Math.round(seconds)
    return Math.abs(seconds - rounded) < 1e-8 ? rounded : seconds
  })
  if (
    !values.every(
      (seconds) => Number.isInteger(seconds) && seconds >= 1 && seconds <= 86400
    )
  )
    throw new Error("Duração: use valores entre 1 e 86400 segundos inteiros.")
  if (values.length === 2 && values[0]! > values[1]!)
    throw new Error(
      "Duração: o intervalo deve estar em ordem crescente, como 30–45 s."
    )
  return { seconds: values.at(-1)!, range: values.length === 2 }
}

export function guessMapping(headers: unknown[]): Mapping {
  const aliases: Record<ImportField, string[]> = {
    code: ["treino", "codigo", "codigo do treino"],
    name: ["nome da ficha", "ficha", "grupo"],
    exercise: ["exercicio", "exercicios", "nome do exercicio"],
    type: ["tipo", "medicao"],
    sets: ["series", "sets"],
    reps: ["repeticoes", "reps"],
    weight: ["carga", "peso", "carga kg", "carga (kg)"],
    seconds: ["tempo", "duracao", "segundos"],
    notes: ["observacoes", "observacao", "notas"],
  }
  const mapping: Mapping = {}
  for (const [field, names] of Object.entries(aliases)) {
    const index = headers.findIndex((header) =>
      names.includes(normalize(String(header ?? "")))
    )
    if (index !== -1) mapping[field as ImportField] = index
  }
  return mapping
}
export function previewImport(sheets: SheetInput[]): ImportRow[] {
  const result: ImportRow[] = []
  for (const sheet of sheets.filter((row) => row.selected)) {
    for (let index = sheet.headerRow; index < sheet.data.length; index++) {
      const row = sheet.data[index]!
      if (
        row.every(
          (cell) =>
            cell === null || cell === undefined || String(cell).trim() === ""
        )
      )
        continue
      const read = (field: ImportField) =>
        sheet.mapping[field] === undefined
          ? ""
          : String(row[sheet.mapping[field]!] ?? "").trim()
      const entry: ImportRow = {
        key: `${sheet.sheet}/${index + 1}`,
        sheet: sheet.sheet,
        row: index + 1,
        code:
          sheet.mapping.code === undefined ? sheet.sheet.trim() : read("code"),
        name: read("name"),
        exercise: read("exercise"),
        notes: read("notes"),
        errors: [],
        excluded: sheet.excluded.includes(index + 1),
      }
      if (!entry.code || entry.code.length > 30)
        entry.errors.push("Código do treino: obrigatório, até 30 caracteres")
      if (entry.name.length > 200)
        entry.errors.push("Nome da ficha: até 200 caracteres")
      if (!entry.exercise || entry.exercise.length > 200)
        entry.errors.push("Exercício: obrigatório, até 200 caracteres")
      const typeText = normalize(read("type"))
      const time =
        ["tempo", "time", "duracao"].includes(typeText) ||
        (!typeText && (!!read("seconds") || hasTimeNotation(read("reps"))))
      if (
        typeText &&
        ![
          "tempo",
          "time",
          "duracao",
          "peso",
          "weight_reps",
          "peso e repeticoes",
          "peso + reps",
          "peso + repeticoes",
        ].includes(typeText)
      )
        entry.errors.push("Tipo: use peso ou tempo")
      try {
        const sets = numberValue(read("sets"))
        const durationSource = read("seconds") || read("reps")
        const parsedDuration = time
          ? importDuration(durationSource, sheet.durationUnit)
          : undefined
        if (parsedDuration && (parsedDuration.range || !read("seconds"))) {
          entry.durationHint = `Duração “${durationSource}”${!read("seconds") ? " na coluna de repetições" : ""}: ${parsedDuration.range ? "usando o limite superior de " : "usando "}${parsedDuration.seconds} segundos.`
          if (parsedDuration.range)
            entry.notes = [
              entry.notes,
              `Meta de duração importada: ${durationSource}.`,
            ]
              .filter(Boolean)
              .join("\n")
        }
        const target = time
          ? {
              type: "time",
              targetSets: sets,
              targetSeconds: parsedDuration!.seconds,
            }
          : {
              type: "weight_reps",
              targetSets: sets,
              targetReps: read("reps"),
              targetWeight: read("weight") ? numberValue(read("weight")) : 0,
            }
        entry.targets = targetsSchema.parse(target)
      } catch (error) {
        entry.errors.push(errorMessage(error))
      }
      if (entry.notes.length > 10000)
        entry.errors.push("Observações: até 10.000 caracteres")
      result.push(entry)
    }
  }
  return result
}
export async function importRows(
  input: ImportRow[],
  policies: Record<string, ImportPolicy>,
  database: GymDatabase = db
) {
  const rows = input.filter((row) => !row.excluded)
  if (!rows.length) throw new Error("Nenhuma linha selecionada para importar.")
  if (rows.some((row) => row.errors.length || !row.targets))
    throw new Error("Corrija ou exclua explicitamente as linhas inválidas.")
  const groups = new Map<string, ImportRow[]>()
  for (const row of rows) {
    const key = row.code.toLocaleLowerCase()
    groups.set(key, [...(groups.get(key) ?? []), row])
  }
  return database.transaction(
    "rw",
    [
      database.workoutTemplates,
      database.exerciseDefinitions,
      database.templateExercises,
    ],
    async () => {
      let imported = 0
      const definitions = await database.exerciseDefinitions.toArray()
      const templates = await database.workoutTemplates.toArray()
      for (const [code, exercises] of groups) {
        const existing = templates.find(
          (row) => row.code.toLocaleLowerCase() === code
        )
        const policy = policies[code]
        if (existing && !policy)
          throw new Error(`Escolha como resolver a ficha ${code}.`)
        if (existing && policy === "skip") continue
        const first = exercises[0]!
        const templateId =
          existing && policy === "update" ? existing.id : newId()
        let nextCode = first.code
        if (existing && policy === "new") {
          let suffix = 2
          while (
            templates.some(
              (row) =>
                row.code.toLocaleLowerCase() === nextCode.toLocaleLowerCase()
            )
          )
            nextCode = `${first.code.slice(0, 24)} (${suffix++})`
        }
        const now = Date.now()
        const template = {
          id: templateId,
          code: nextCode,
          name: first.name || existing?.name || `Treino ${nextCode}`,
          description: existing?.description ?? "",
          order: existing?.order ?? templates.length,
          archived: false,
          createdAt: existing && policy === "update" ? existing.createdAt : now,
          updatedAt: now,
        }
        await database.workoutTemplates.put(template)
        if (!existing || policy === "new") templates.push(template)
        await database.templateExercises
          .where("templateId")
          .equals(templateId)
          .delete()
        for (const [order, row] of exercises.entries()) {
          const targets = targetsSchema.parse(row.targets)
          let definition = definitions.find(
            (item) =>
              normalize(item.name) === normalize(row.exercise) &&
              item.defaultType === targets.type
          )
          if (!definition) {
            definition = {
              id: newId(),
              name: row.exercise,
              defaultType: targets.type,
              notes: "",
              archived: false,
              createdAt: now,
              updatedAt: now,
            }
            definitions.push(definition)
            await database.exerciseDefinitions.add(definition)
          }
          const exercise: TemplateExercise = {
            ...targets,
            id: newId(),
            templateId,
            exerciseId: definition.id,
            order,
            notes: row.notes,
          }
          await database.templateExercises.add(exercise)
        }
        imported++
      }
      return imported
    }
  )
}
