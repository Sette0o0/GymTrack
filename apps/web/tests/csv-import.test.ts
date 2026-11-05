import { afterEach, expect, it } from "vitest"
import { GymDatabase } from "@/db/database"
import { snapshot } from "@/db/repository"
import { newId, type Backup } from "@/lib/schema"
import {
  csv,
  templatesCsv,
  historyCsv,
  validateBackup,
} from "@/services/backup"
import { parseCsv, previewCsvImport, importCsv } from "@/services/csv-import"
import { guessMapping, previewImport, importRows } from "@/services/import"
import {
  startSession,
  updateSet,
  changeSession,
  toggleTimer,
} from "@/services/sessions"

const databases: GymDatabase[] = []
const database = () => {
  const db = new GymDatabase(`csv-${newId()}`)
  databases.push(db)
  return db
}
afterEach(async () => {
  for (const db of databases.splice(0)) await db.delete()
})
async function fixture() {
  const db = database()
  const data = [
    [
      "Treino",
      "Nome da ficha",
      "Exercício",
      "Séries",
      "Repetições",
      "Agrupamento muscular",
      "Observações",
    ],
    [
      "A",
      "Peito e abdômen",
      "Supino",
      2,
      "8-12",
      "Peito, tríceps",
      "Banco 3; manter postura",
    ],
    [
      "A",
      "Peito e abdômen",
      "Prancha",
      1,
      "45 s",
      "Core",
      "Respirar\nsem prender",
    ],
  ]
  await importRows(
    previewImport([
      {
        sheet: "A",
        data,
        mapping: guessMapping(data[0]!),
        selected: true,
        headerRow: 1,
        durationUnit: "seconds",
        excluded: [],
      },
    ]),
    {},
    db
  )
  const template = (await db.workoutTemplates.toArray())[0]!
  const id = await startSession(template.id, db)
  for (const set of await db.setRecords.toArray())
    await updateSet(
      set.id,
      {
        status: "completed",
        ...(set.type === "weight_reps"
          ? { weightKg: 57.5, repetitions: 9 }
          : { durationSeconds: 47 }),
      },
      db
    )
  await changeSession(id, "completed", db)
  return { db, data: await snapshot(db), id }
}
function edit(text: string, field: string, value: string, index = 1) {
  const rows = parseCsv(text).map((row) => row.cells)
  rows[index]![rows[0]!.indexOf(field)] = value
  return csv(rows)
}
const contents = (data: Backup) => ({ ...data, exportedAt: 0 })

it("lê BOM, ponto e vírgula, aspas, quebras de linha e recusa CSV truncado", () => {
  expect(parseCsv('\uFEFFa;b\r\n"x;y";"texto ""citado""\nlinha"')[1]).toEqual({
    line: 2,
    cells: ["x;y", 'texto "citado"\nlinha'],
  })
  expect(() => parseCsv('a;b\n"sem fim')).toThrow("Linha 2")
  expect(() => parseCsv('a;b\n"fechado"erro;1')).toThrow("após")
})
it("exporta e importa fichas e histórico preservando IDs, grupos, medidas, notas e horários", async () => {
  const { data } = await fixture(),
    target = database()
  const preview = previewCsvImport(
    templatesCsv(data),
    "templates",
    await snapshot(target)
  )
  expect(preview.addedTemplates).toBe(1)
  expect(await target.workoutTemplates.count()).toBe(0)
  await importCsv(templatesCsv(data), "templates", target)
  await importCsv(historyCsv(data), "history", target)
  const restored = await snapshot(target)
  expect(restored.templateExercises).toEqual(data.templateExercises)
  expect(restored.workoutSessions).toEqual(data.workoutSessions)
  expect(restored.sessionExercises).toEqual(
    validateBackup(data).sessionExercises
  )
  expect(restored.setRecords).toEqual(data.setRecords)
  expect(
    restored.exerciseDefinitions.map((row) => [
      row.id,
      row.name,
      row.muscleGroup,
    ])
  ).toEqual(
    data.exerciseDefinitions.map((row) => [row.id, row.name, row.muscleGroup])
  )
})
it("importa histórico antes das fichas, preenchendo a referência vazia sem alterar sessões", async () => {
  const { data } = await fixture(),
    target = database()
  await importCsv(historyCsv(data), "history", target)
  expect((await target.workoutTemplates.toArray())[0]?.archived).toBe(true)
  const before = await target.sessionExercises.toArray()
  const result = await importCsv(templatesCsv(data), "templates", target)
  expect(result.filledTemplates).toBe(1)
  expect((await target.workoutTemplates.toArray())[0]?.archived).toBe(false)
  expect(await target.templateExercises.toArray()).toEqual(
    data.templateExercises
  )
  expect(await target.sessionExercises.toArray()).toEqual(before)
})
it("reimportar preserva alterações locais e não duplica sessões ou séries", async () => {
  const { db, data } = await fixture()
  await db.workoutTemplates.update(data.workoutTemplates[0]!.id, {
    name: "Nome local",
  })
  const definition = data.exerciseDefinitions[0]!
  await db.exerciseDefinitions.update(definition.id, {
    muscleGroup: "Classificação local",
  })
  const before = contents(await snapshot(db))
  expect((await importCsv(templatesCsv(data), "templates", db)).skipped).toBe(1)
  expect((await importCsv(historyCsv(data), "history", db)).skipped).toBe(1)
  expect(contents(await snapshot(db))).toEqual(before)
})
it("aceita os CSVs antigos sem agrupamentos/IDs adicionais e evita repetir histórico", async () => {
  const { data } = await fixture(),
    target = database()
  const templates = csv(
    parseCsv(templatesCsv(data)).map((row) => row.cells.slice(0, 8))
  )
  const history = csv(
    parseCsv(historyCsv(data)).map((row) => row.cells.slice(0, 20))
  )
  expect(
    previewCsvImport(history, "history", await snapshot(target)).warnings.join()
  ).toContain("CSV antigo")
  await importCsv(templates, "templates", target)
  await importCsv(history, "history", target)
  await importCsv(history, "history", target)
  expect(await target.workoutSessions.count()).toBe(1)
  expect(await target.setRecords.count()).toBe(3)
  expect(
    (await target.setRecords.toArray())
      .filter((row) => row.type === "weight_reps")
      .every((row) => row.weightKg === 57.5)
  ).toBe(true)
})
it("desfaz o escape de fórmulas como texto sem perder apóstrofos, delimitadores e novas linhas", async () => {
  const { data } = await fixture(),
    target = database()
  data.templateExercises[0]!.notes = "=SOMA(1;2)\n'@texto"
  data.templateExercises[1]!.notes = "'=literal"
  data.exerciseDefinitions[0]!.name = '+Exercício "especial"'
  const text = templatesCsv(data)
  expect(text).toContain("'=SOMA")
  await importCsv(text, "templates", target)
  expect(await target.templateExercises.toArray()).toEqual(
    data.templateExercises
  )
  expect(
    (await target.exerciseDefinitions.get(data.exerciseDefinitions[0]!.id))
      ?.name
  ).toBe('+Exercício "especial"')
})
it("recusa campos inválidos e metadados conflitantes com linha e sem gravar parcialmente", async () => {
  const { data } = await fixture(),
    target = database()
  const examples = [
    edit(historyCsv(data), "Carga kg", "abc"),
    edit(historyCsv(data), "Início", "2026-02-31T12:00:00.000Z"),
    edit(historyCsv(data), "Observação sessão", "inconsistente"),
    edit(historyCsv(data), "Versão CSV", "99"),
    edit(historyCsv(data), "Status série", "inexistente"),
    edit(historyCsv(data), "Sessão ID", "id-inválido"),
  ]
  for (const text of examples) {
    await expect(importCsv(text, "history", target)).rejects.toThrow("Linha")
    expect(await target.workoutSessions.count()).toBe(0)
    expect(await target.exerciseDefinitions.count()).toBe(0)
  }
})
it("reverte toda a importação quando uma gravação posterior falha", async () => {
  const { data } = await fixture(),
    target = database()
  await target.settings.put({ key: "local", value: true })
  const before = contents(await snapshot(target))
  const fail = () => {
    throw new Error("Sem espaço")
  }
  target.setRecords.hook("creating", fail)
  await expect(importCsv(historyCsv(data), "history", target)).rejects.toThrow(
    "Sem espaço"
  )
  target.setRecords.hook("creating").unsubscribe(fail)
  expect(contents(await snapshot(target))).toEqual(before)
})
it("preserva exercícios repetidos pelo ID e recusa a ambiguidade de CSV antigo", async () => {
  const { data } = await fixture(),
    target = database()
  const original = data.sessionExercises.find(
    (row) => row.type === "weight_reps"
  )!
  const duplicate = { ...original, id: newId(), order: 2 }
  data.sessionExercises.push(duplicate)
  for (const set of data.setRecords.filter(
    (row) => row.sessionExerciseId === original.id
  ))
    data.setRecords.push({
      ...set,
      id: newId(),
      sessionExerciseId: duplicate.id,
    })
  await importCsv(historyCsv(data), "history", target)
  expect(await target.sessionExercises.count()).toBe(3)
  const legacy = csv(
    parseCsv(historyCsv(data)).map((row) => row.cells.slice(0, 20))
  )
  await expect(importCsv(legacy, "history", database())).rejects.toThrow(
    "Série duplicada"
  )
})
it("preserva fichas vazias, sessões sem exercícios e exercícios sem séries", async () => {
  const { data } = await fixture(),
    target = database()
  const template = {
    ...data.workoutTemplates[0]!,
    id: newId(),
    code: "B",
    name: "Vazia",
    archived: true,
  }
  data.workoutTemplates.push(template)
  const session = {
    ...data.workoutSessions[0]!,
    id: newId(),
    templateId: template.id,
    workoutCode: "B",
  }
  data.workoutSessions.push(session)
  const emptyExercise = data.sessionExercises[0]!
  data.setRecords = data.setRecords.filter(
    (row) => row.sessionExerciseId !== emptyExercise.id
  )
  await importCsv(templatesCsv(data), "templates", target)
  await importCsv(historyCsv(data), "history", target)
  expect(await target.workoutTemplates.count()).toBe(2)
  expect(await target.workoutSessions.count()).toBe(2)
  expect(await target.sessionExercises.toArray()).toEqual(
    validateBackup(data).sessionExercises
  )
  expect(await target.setRecords.toArray()).toEqual(data.setRecords)
})
it("importa cronômetro ativo pausado com tempo acumulado e bloqueia sessão local pendente", async () => {
  const { db, data } = await fixture(),
    target = database()
  const id = await startSession(data.workoutTemplates[0]!.id, db)
  const exercise = (
    await db.sessionExercises.where("sessionId").equals(id).toArray()
  ).find((row) => row.type === "time")!
  const set = (
    await db.setRecords.where("sessionExerciseId").equals(exercise.id).toArray()
  )[0]!
  await toggleTimer(set.id, db)
  const running = await db.setRecords.get(set.id)
  if (!running || running.type !== "time")
    throw new Error("Fixture de tempo inválida")
  await db.setRecords.put({ ...running, timerStartedAt: Date.now() - 6000 })
  await importCsv(historyCsv(await snapshot(db)), "history", target)
  expect((await target.workoutSessions.get(id))?.status).toBe("paused")
  const restored = await target.setRecords.get(set.id)
  expect(
    restored?.type === "time" &&
      restored.timerStartedAt === null &&
      restored.durationSeconds >= 6
  ).toBe(true)
  await expect(
    importCsv(templatesCsv(data), "templates", target)
  ).rejects.toThrow("treino pendente")
})
it("recusa cabeçalhos ausentes/duplicados e IDs de séries usados por outra sessão", async () => {
  const { data } = await fixture(),
    target = database()
  await expect(importCsv("a;b\n1;2", "templates", target)).rejects.toThrow(
    "Coluna obrigatória"
  )
  await expect(
    importCsv("Treino;Treino\nA;B", "templates", target)
  ).rejects.toThrow("duplicados")
  await importCsv(historyCsv(data), "history", target)
  const incoming = structuredClone(data)
  const oldId = incoming.workoutSessions[0]!.id,
    id = newId()
  incoming.workoutSessions[0]!.id = id
  incoming.sessionExercises = incoming.sessionExercises.map((row) => ({
    ...row,
    sessionId: row.sessionId === oldId ? id : row.sessionId,
    id: newId(),
  }))
  // Keep existing set IDs but point them at the new session's new exercise IDs.
  incoming.setRecords = incoming.setRecords.map((row) => ({
    ...row,
    sessionExerciseId: incoming.sessionExercises.find(
      (exercise) => exercise.type === row.type
    )!.id,
  }))
  await expect(
    importCsv(historyCsv(incoming), "history", target)
  ).rejects.toThrow("Série ID")
  expect(await target.workoutSessions.count()).toBe(1)
})

it("serializa importações concorrentes em conexões diferentes sem duplicar dados", async () => {
  const { data } = await fixture(),
    target = database()
  const other = new GymDatabase(target.name)
  await other.open()
  try {
    await Promise.all([
      importCsv(historyCsv(data), "history", target),
      importCsv(historyCsv(data), "history", other),
    ])
    expect(await target.workoutSessions.count()).toBe(1)
    expect(await target.setRecords.count()).toBe(3)
    await importCsv(templatesCsv(data), "templates", other)
    expect(await target.workoutTemplates.count()).toBe(1)
    expect(await target.templateExercises.count()).toBe(2)
  } finally {
    other.close()
  }
})

it("CSV versionado não aceita perder IDs ou horários nem referências conflitantes", async () => {
  const { data } = await fixture(),
    target = database()
  for (const field of [
    "Ficha ID",
    "Série ID",
    "Série concluída em",
    "Exercício ID",
  ]) {
    await expect(
      importCsv(edit(historyCsv(data), field, ""), "history", target)
    ).rejects.toThrow("Linha")
  }
  await expect(
    importCsv(
      edit(historyCsv(data), "Exercício ID", newId(), 2),
      "history",
      target
    )
  ).rejects.toThrow("conflitantes")
  expect(await target.workoutSessions.count()).toBe(0)
})

it("preserva cargas muito pequenas sem exportar notação científica", async () => {
  const { data } = await fixture(),
    target = database()
  const values = [0.0000001, Number.MIN_VALUE]
  for (const [index, set] of data.setRecords
    .filter((row) => row.type === "weight_reps")
    .entries())
    if (set.type === "weight_reps") set.weightKg = values[index]!
  const text = historyCsv(data)
  expect(text).toContain('"0,0000001"')
  expect(text).not.toContain('"5e-324"')
  await importCsv(text, "history", target)
  expect(await target.setRecords.toArray()).toEqual(data.setRecords)
})
