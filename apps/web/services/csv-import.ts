import { z } from "zod"
import { db, type GymDatabase } from "@/db/database"
import { snapshot } from "@/db/repository"
import {
  definitionSchema,
  templateSchema,
  templateExerciseSchema,
  sessionSchema,
  sessionExerciseSchema,
  setSchema,
  targetsSchema,
  newId,
  errorMessage,
  type Backup,
  type Targets,
  type WorkoutTemplate,
  type ExerciseDefinition,
} from "@/lib/schema"
import { validateBackup } from "./backup"

export type CsvKind = "templates" | "history"
type ParsedRow = { line: number; cells: string[] }
const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR")

// RFC-style quoted cells, including embedded semicolons, quotes and newlines.
export function parseCsv(text: string): ParsedRow[] {
  const source = text.replace(/^\uFEFF/, "")
  const rows: ParsedRow[] = []
  let cells: string[] = [],
    field = "",
    quoted = false,
    closed = false,
    line = 1,
    startLine = 1
  const pushField = () => {
    cells.push(field)
    field = ""
    closed = false
  }
  const pushRow = () => {
    pushField()
    if (cells.some((cell) => cell.trim())) rows.push({ line: startLine, cells })
    cells = []
  }
  for (let i = 0; i < source.length; i++) {
    const char = source[i]!
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"'
          i++
        } else {
          quoted = false
          closed = true
        }
      } else {
        field += char
        if (char === "\n") line++
      }
    } else if (char === ";") pushField()
    else if (char === "\r" || char === "\n") {
      pushRow()
      if (char === "\r" && source[i + 1] === "\n") i++
      line++
      startLine = line
    } else if (char === '"' && !field && !closed) quoted = true
    else {
      if (char === '"' || closed)
        throw new Error(
          `Linha ${line}: aspas ou conteúdo após o fechamento de uma célula inválidos.`
        )
      field += char
    }
  }
  if (quoted)
    throw new Error(`Linha ${startLine}: célula com aspas não fechadas.`)
  if (field || closed || cells.length) pushRow()
  return rows
}

function readers(text: string, kind: CsvKind) {
  const [header, ...rows] = parseCsv(text)
  if (!header || !rows.length)
    throw new Error("O CSV precisa ter cabeçalho e pelo menos um registro.")
  const columns = header.cells.map(normalize)
  if (new Set(columns).size !== columns.length)
    throw new Error("O CSV contém cabeçalhos duplicados.")
  const required =
    kind === "templates"
      ? [
          "Treino",
          "Nome da ficha",
          "Exercício",
          "Tipo",
          "Séries",
          "Repetições",
          "Segundos",
          "Observações",
        ]
      : [
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
        ]
  for (const name of required)
    if (!columns.includes(normalize(name)))
      throw new Error(
        `Coluna obrigatória ausente: ${name}. Use o CSV de ${kind === "templates" ? "fichas" : "histórico"} exportado nas configurações, separado por ponto e vírgula.`
      )
  return rows.map((row) => {
    if (row.cells.length !== columns.length)
      throw new Error(
        `Linha ${row.line}: quantidade de colunas diferente do cabeçalho.`
      )
    const get = (name: string) => {
      const value = row.cells[columns.indexOf(normalize(name))] ?? ""
      // Undo only the spreadsheet formula escaping emitted by csvCell.
      return /^'(?:'|\s*[=+@-])/.test(value) ? value.slice(1) : value
    }
    if (columns.includes(normalize("Versão CSV")) && get("Versão CSV") !== "1")
      throw new Error(`Linha ${row.line}: versão CSV incompatível.`)
    if (columns.includes(normalize("Versão CSV"))) {
      const marker = normalize(get("Registro CSV"))
      const ids =
        kind === "templates"
          ? [
              "Ficha ID",
              ...(marker === "exercicio"
                ? ["Exercício ID", "Item da ficha ID", "Ordem exercício"]
                : []),
            ]
          : [
              "Ficha ID",
              ...(marker !== "sessao"
                ? ["Exercício ID", "Exercício da sessão ID", "Ordem exercício"]
                : []),
              ...(marker === "serie" ? ["Série ID"] : []),
            ]
      for (const name of ids)
        if (!get(name))
          throw new Error(
            `Linha ${row.line}: ${name} obrigatório no CSV versionado.`
          )
      if (!marker)
        throw new Error(`Linha ${row.line}: Registro CSV obrigatório.`)
      if (
        kind === "history" &&
        marker === "serie" &&
        get("Status série") === "completed" &&
        !get("Série concluída em")
      )
        throw new Error(
          `Linha ${row.line}: Série concluída em é obrigatório para séries concluídas.`
        )
    }
    return {
      line: row.line,
      get,
      has: (name: string) => columns.includes(normalize(name)),
    }
  })
}
type Row = ReturnType<typeof readers>[number]
const uuid = (value: string) => (value ? z.uuid().parse(value) : newId())
function number(row: Row, field: string) {
  const text = row.get(field).trim()
  if (!/^\d+(?:[.,]\d+)?$/.test(text))
    throw new Error(`${field}: informe um número válido.`)
  return Number(text.replace(",", "."))
}
function date(row: Row, field: string) {
  const text = row.get(field)
  const value = Date.parse(text)
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(text) ||
    !Number.isFinite(value) ||
    new Date(value).toISOString().slice(0, 19) !== text.slice(0, 19)
  )
    throw new Error(`${field}: data ISO inválida.`)
  return value
}
function boolean(row: Row, field: string) {
  const text = normalize(row.get(field))
  if (!["", "sim", "nao", "true", "false", "1", "0"].includes(text))
    throw new Error(`${field}: use sim ou não.`)
  return ["sim", "true", "1"].includes(text)
}
function targets(row: Row, history: boolean): Targets {
  const raw = normalize(row.get("Tipo"))
  if (
    ![
      "time",
      "tempo",
      "weight_reps",
      "peso e repeticoes",
      "peso + repeticoes",
    ].includes(raw)
  )
    throw new Error("Tipo: use tempo ou peso e repetições.")
  return targetsSchema.parse(
    ["time", "tempo"].includes(raw)
      ? {
          type: "time",
          targetSets: number(row, history ? "Meta séries" : "Séries"),
          targetSeconds: number(row, history ? "Meta segundos" : "Segundos"),
        }
      : {
          type: "weight_reps",
          targetSets: number(row, history ? "Meta séries" : "Séries"),
          targetReps: row.get(history ? "Meta reps" : "Repetições"),
        }
  )
}
function same(a: unknown, b: unknown, label: string) {
  if (JSON.stringify(a) !== JSON.stringify(b))
    throw new Error(
      `${label}: informações conflitantes entre linhas do mesmo registro.`
    )
}
function assertFresh(rows: { id: string }[], id: string, label: string) {
  if (rows.some((row) => row.id === id))
    throw new Error(`${label}: ID já utilizado por outro registro.`)
}

export type CsvPreview = {
  data: Backup
  addedTemplates: number
  filledTemplates: number
  addedSessions: number
  addedSets: number
  skipped: number
  items: { name: string; detail: string }[]
  warnings: string[]
}
export function previewCsvImport(
  text: string,
  kind: CsvKind,
  current: Backup
): CsvPreview {
  const rows = readers(text, kind)
  const data = structuredClone(current)
  const now = Date.now()
  const items: CsvPreview["items"] = []
  let skipped = 0,
    filledTemplates = 0
  const findTemplate = (row: Row) => {
    const rawId = row.get("Ficha ID")
    if (rawId) z.uuid().parse(rawId)
    const byId = data.workoutTemplates.find((item) => item.id === rawId)
    const byCode = data.workoutTemplates.find(
      (item) => normalize(item.code) === normalize(row.get("Treino"))
    )
    if (byId && byCode && byId.id !== byCode.id)
      throw new Error(
        "Ficha ID e código apontam para fichas locais diferentes."
      )
    return byId ?? byCode
  }
  const createTemplate = (row: Row, history: boolean): WorkoutTemplate =>
    templateSchema.parse({
      id: uuid(row.get("Ficha ID")),
      code: row.get("Treino"),
      name: row.get(history ? "Nome" : "Nome da ficha"),
      description: history ? "" : row.get("Descrição da ficha"),
      order: data.workoutTemplates.length,
      archived: history || boolean(row, "Ficha arquivada"),
      createdAt: now,
      updatedAt: now,
    })
  const definition = (
    row: Row,
    target: Targets,
    history: boolean
  ): ExerciseDefinition => {
    const id = row.get("Exercício ID")
    if (id) z.uuid().parse(id)
    const existing =
      data.exerciseDefinitions.find((item) => item.id === id) ??
      data.exerciseDefinitions.find(
        (item) =>
          normalize(item.name) === normalize(row.get("Exercício")) &&
          item.defaultType === target.type
      )
    if (existing) {
      if (existing.defaultType !== target.type)
        throw new Error("Exercício ID: tipo diferente do catálogo local.")
      if (
        !history &&
        !existing.muscleGroup?.trim() &&
        row.get("Agrupamento muscular").trim()
      )
        existing.muscleGroup = definitionSchema.shape.muscleGroup.parse(
          row.get("Agrupamento muscular")
        )
      if (!history && !existing.notes && row.get("Observação catálogo"))
        existing.notes = definitionSchema.shape.notes.parse(
          row.get("Observação catálogo")
        )
      return existing
    }
    const result = definitionSchema.parse({
      id: uuid(id),
      name: row.get("Exercício"),
      defaultType: target.type,
      muscleGroup: row.get("Agrupamento muscular"),
      notes: history ? "" : row.get("Observação catálogo"),
      archived: boolean(row, "Exercício arquivado"),
      createdAt: now,
      updatedAt: now,
    })
    data.exerciseDefinitions.push(result)
    return result
  }
  const grouped = new Map<string, Row[]>()
  for (const row of rows) {
    const key =
      kind === "templates" ? normalize(row.get("Treino")) : row.get("Sessão ID")
    grouped.set(key, [...(grouped.get(key) ?? []), row])
  }
  for (const group of grouped.values()) {
    const first = group[0]!
    let activeLine = first.line
    try {
      if (kind === "templates") {
        const incoming = createTemplate(first, false)
        const existing = findTemplate(first)
        const preserve =
          existing &&
          data.templateExercises.some((row) => row.templateId === existing.id)
        const template = existing
          ? {
              ...incoming,
              id: existing.id,
              order: existing.order,
              createdAt: existing.createdAt,
            }
          : incoming
        const exercises: Backup["templateExercises"] = []
        for (const [index, row] of group.entries()) {
          activeLine = row.line
          // Validate repeated template metadata before deciding whether to skip.
          same(
            [
              row.get("Treino"),
              row.get("Nome da ficha"),
              row.get("Ficha ID"),
              row.get("Descrição da ficha"),
              row.get("Ficha arquivada"),
            ],
            [
              first.get("Treino"),
              first.get("Nome da ficha"),
              first.get("Ficha ID"),
              first.get("Descrição da ficha"),
              first.get("Ficha arquivada"),
            ],
            "Ficha"
          )
          const marker = normalize(row.get("Registro CSV") || "exercício")
          if (marker === "ficha") {
            if (group.length !== 1 || row.get("Exercício") || row.get("Séries"))
              throw new Error("Ficha vazia com conteúdo de exercício.")
            continue
          }
          if (marker !== "exercicio")
            throw new Error("Registro CSV: tipo inválido para fichas.")
          const target = targets(row, false)
          // Parse independently even when the local template will be preserved.
          definitionSchema.parse({
            id: uuid(row.get("Exercício ID")),
            name: row.get("Exercício"),
            defaultType: target.type,
            muscleGroup: row.get("Agrupamento muscular"),
            notes: row.get("Observação catálogo"),
            archived: false,
            createdAt: now,
            updatedAt: now,
          })
          const itemId = uuid(row.get("Item da ficha ID"))
          const order = row.get("Ordem exercício")
            ? number(row, "Ordem exercício")
            : index
          if (
            exercises.some((item) => item.order === order || item.id === itemId)
          )
            throw new Error(
              "Exercício de ficha duplicado ou com ordem repetida."
            )
          const parsed = templateExerciseSchema.parse({
            ...target,
            id: itemId,
            templateId: template.id,
            exerciseId: newId(),
            order,
            notes: row.get("Observações"),
          })
          exercises.push(parsed)
          if (!preserve) {
            const catalog = definition(row, target, false)
            parsed.exerciseId = catalog.id
            assertFresh(data.templateExercises, parsed.id, "Item da ficha ID")
            data.templateExercises.push(parsed)
          }
        }
        if (preserve || (existing && !exercises.length)) {
          skipped++
          continue
        }
        if (existing) {
          data.workoutTemplates[
            data.workoutTemplates.findIndex((row) => row.id === existing.id)
          ] = template
          filledTemplates++
        } else data.workoutTemplates.push(template)
        items.push({
          name: `${template.code} · ${template.name}`,
          detail: `${exercises.length} exercícios${existing ? " · preencher ficha vazia" : ""}`,
        })
      } else {
        const sessionId = z.uuid().parse(first.get("Sessão ID"))
        // Build a standalone session first; only merge a fully valid session.
        const localSession = data.workoutSessions.find(
          (row) => row.id === sessionId
        )
        const template = findTemplate(first) ?? createTemplate(first, true)
        const parsedSessions: Backup["workoutSessions"] = []
        const parsedExercises: Backup["sessionExercises"] = []
        const parsedSets: Backup["setRecords"] = []
        const exerciseKeys = new Map<string, string>()
        const catalogKeys = new Map<string, string>()
        for (const row of group) {
          activeLine = row.line
          same(
            [row.get("Ficha ID"), row.get("Status sessão")],
            [first.get("Ficha ID"), first.get("Status sessão")],
            "Sessão"
          )
          const rawStatus = row.get("Status sessão")
          const session = sessionSchema.parse({
            id: sessionId,
            templateId: template.id,
            workoutCode: row.get("Treino"),
            workoutName: row.get("Nome"),
            localDate: row.get("Data local"),
            startedAt: date(row, "Início"),
            finishedAt: row.get("Fim") ? date(row, "Fim") : null,
            status: rawStatus === "active" ? "paused" : rawStatus,
            notes: row.get("Observação sessão"),
          })
          if (parsedSessions.length) same(session, parsedSessions[0], "Sessão")
          else parsedSessions.push(session)
          const marker = normalize(row.get("Registro CSV") || "série")
          if (marker === "sessao") {
            if (group.length !== 1 || row.get("Exercício") || row.get("Série"))
              throw new Error(
                "Sessão vazia com conteúdo de exercício ou série."
              )
            continue
          }
          if (!["serie", "exercicio"].includes(marker))
            throw new Error("Registro CSV: tipo inválido para histórico.")
          const target = targets(row, true)
          const explicitId = row.get("Exercício da sessão ID")
          const key =
            explicitId || `${normalize(row.get("Exercício"))}/${target.type}`
          let exerciseId = exerciseKeys.get(key)
          const catalog = localSession
            ? definitionSchema.parse({
                id: uuid(row.get("Exercício ID")),
                name: row.get("Exercício"),
                defaultType: target.type,
                notes: "",
                archived: false,
                createdAt: now,
                updatedAt: now,
              })
            : definition(row, target, true)
          if (!exerciseId) {
            exerciseId = uuid(explicitId)
            exerciseKeys.set(key, exerciseId)
          }
          if (
            catalogKeys.has(exerciseId) &&
            catalogKeys.get(exerciseId) !== row.get("Exercício ID")
          )
            throw new Error(
              "Exercício ID: informações conflitantes entre linhas do mesmo exercício histórico."
            )
          catalogKeys.set(exerciseId, row.get("Exercício ID"))
          const exercise = sessionExerciseSchema.parse({
            ...target,
            id: exerciseId,
            sessionId,
            exerciseId: catalog.id,
            nameSnapshot: row.get("Exercício"),
            muscleGroupSnapshot: row.get("Agrupamento muscular"),
            order: row.get("Ordem exercício")
              ? number(row, "Ordem exercício")
              : [...exerciseKeys.values()].indexOf(exerciseId),
            notesSnapshot: row.get("Observação fixa"),
            sessionNotes: row.get("Observação exercício"),
          })
          const previous = parsedExercises.find(
            (item) => item.id === exerciseId
          )
          if (previous) {
            // Legacy rows without catalog IDs still refer to the same exercise.
            same(
              { ...exercise, exerciseId: previous.exerciseId },
              previous,
              "Exercício histórico"
            )
          } else {
            if (parsedExercises.some((item) => item.order === exercise.order))
              throw new Error("Ordem de exercício repetida na sessão.")
            parsedExercises.push(exercise)
          }
          if (marker === "exercicio") {
            if (row.get("Série"))
              throw new Error(
                "Exercício sem séries com número de série preenchido."
              )
            continue
          }
          const set = setSchema.parse({
            id: uuid(row.get("Série ID")),
            sessionExerciseId: exerciseId,
            setNumber: number(row, "Série"),
            type: target.type,
            status: row.get("Status série"),
            completedAt:
              row.get("Status série") === "completed"
                ? row.get("Série concluída em")
                  ? date(row, "Série concluída em")
                  : (session.finishedAt ?? session.startedAt)
                : null,
            ...(target.type === "time"
              ? {
                  durationSeconds: number(row, "Duração segundos"),
                  timerStartedAt: null,
                }
              : {
                  weightKg: number(row, "Carga kg"),
                  repetitions: number(row, "Repetições"),
                }),
          })
          if (
            row.get("Status série") !== "completed" &&
            row.get("Série concluída em")
          )
            throw new Error("Série não concluída com horário de conclusão.")
          if (
            parsedSets.some(
              (item) =>
                item.id === set.id ||
                (item.sessionExerciseId === exerciseId &&
                  item.setNumber === set.setNumber)
            )
          )
            throw new Error(
              "Série duplicada. Arquivos antigos com exercícios repetidos de mesmo nome precisam ser exportados novamente ou transferidos por JSON."
            )
          parsedSets.push(set)
        }
        if (localSession) {
          skipped++
          continue
        }
        if (!data.workoutTemplates.some((row) => row.id === template.id))
          data.workoutTemplates.push(template)
        for (const exercise of parsedExercises)
          assertFresh(
            data.sessionExercises,
            exercise.id,
            "Exercício da sessão ID"
          )
        for (const set of parsedSets)
          assertFresh(data.setRecords, set.id, "Série ID")
        data.workoutSessions.push(...parsedSessions)
        data.sessionExercises.push(...parsedExercises)
        data.setRecords.push(...parsedSets)
        items.push({
          name: `${parsedSessions[0]!.localDate} · ${parsedSessions[0]!.workoutCode} · ${parsedSessions[0]!.workoutName}`,
          detail: `${parsedExercises.length} exercícios · ${parsedSets.length} séries`,
        })
      }
    } catch (cause) {
      throw new Error(`Linha ${activeLine}: ${errorMessage(cause)}`, { cause })
    }
  }
  validateBackup(data)
  const legacy = !rows[0]!.has("Versão CSV")
  return {
    data,
    items,
    filledTemplates,
    skipped,
    addedTemplates:
      data.workoutTemplates.length - current.workoutTemplates.length,
    addedSessions: data.workoutSessions.length - current.workoutSessions.length,
    addedSets: data.setRecords.length - current.setRecords.length,
    warnings: [
      ...(legacy
        ? [
            "CSV antigo: campos ausentes serão reconstruídos. No histórico, a ordem segue a primeira ocorrência no arquivo e o horário de conclusão das séries usa o fim ou início da sessão.",
          ]
        : []),
      ...(kind === "history"
        ? [
            "Sessões em andamento serão importadas pausadas. Fichas ausentes serão criadas arquivadas e poderão ser preenchidas depois pelo CSV de fichas.",
          ]
        : []),
    ],
  }
}

export async function importCsv(
  text: string,
  kind: CsvKind,
  database: GymDatabase = db
) {
  return database.transaction("rw", database.tables, async () => {
    const current = await snapshot(database)
    if (current.workoutSessions.some((row) => row.status !== "completed"))
      throw new Error(
        "Finalize ou cancele o treino pendente antes de importar CSV."
      )
    const preview = previewCsvImport(text, kind, current)
    // Rebuild against the current transaction snapshot: no stale preview overwrites.
    for (const name of [
      "exerciseDefinitions",
      "workoutTemplates",
      "templateExercises",
      "workoutSessions",
      "sessionExercises",
      "setRecords",
    ] as const)
      await database.table(name).bulkPut(preview.data[name])
    return preview
  })
}
