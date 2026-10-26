import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { GymDatabase } from "@/db/database"
import { snapshot } from "@/db/repository"
import {
  newId,
  localDate,
  numberValue,
  secondsValue,
  type TemplateExercise,
} from "@/lib/schema"
import {
  addSet,
  changeSession,
  deleteSession,
  removeSet,
  sessionNote,
  startSession,
  toggleTimer,
  updateSet,
} from "@/services/sessions"
import { saveWorkout } from "@/services/workouts"
import {
  csv,
  historyCsv,
  restoreBackup,
  validateBackup,
} from "@/services/backup"
import {
  guessMapping,
  importRows,
  previewImport,
  type SheetInput,
} from "@/services/import"

let database: GymDatabase
const databases: GymDatabase[] = []
function createDatabase() {
  const value = new GymDatabase(`test-${newId()}`)
  databases.push(value)
  return value
}
beforeEach(() => {
  database = createDatabase()
})
afterEach(async () => {
  vi.restoreAllMocks()
  for (const item of databases.splice(0)) await item.delete()
})
async function fixture() {
  const exerciseId = newId(),
    templateId = newId(),
    timedId = newId()
  const now = Date.now()
  await database.exerciseDefinitions.bulkAdd([
    {
      id: exerciseId,
      name: "Supino reto",
      defaultType: "weight_reps",
      notes: "Banco 3",
      archived: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: timedId,
      name: "Prancha",
      defaultType: "time",
      notes: "Abdômen firme",
      archived: false,
      createdAt: now,
      updatedAt: now,
    },
  ])
  const template = {
    id: templateId,
    code: "A",
    name: "Peito e abdômen",
    description: "",
    order: 0,
    archived: false,
    createdAt: now,
    updatedAt: now,
  }
  const exercises: TemplateExercise[] = [
    {
      id: newId(),
      templateId,
      exerciseId,
      order: 0,
      type: "weight_reps",
      targetSets: 2,
      targetReps: "8-12",
      targetWeight: 60,
      notes: "Controle a descida",
    },
    {
      id: newId(),
      templateId,
      exerciseId: timedId,
      order: 1,
      type: "time",
      targetSets: 1,
      targetSeconds: 45,
      notes: "",
    },
  ]
  await saveWorkout(template, exercises, database)
  return { exerciseId, templateId, template, exercises }
}
async function completeFixture() {
  const fixtureData = await fixture()
  const sessionId = await startSession(fixtureData.templateId, database)
  const exercises = await database.sessionExercises
    .where("sessionId")
    .equals(sessionId)
    .toArray()
  const sets = await database.setRecords.toArray()
  for (const row of sets)
    await updateSet(row.id, { status: "completed" }, database)
  await sessionNote(sessionId, "Bom treino", false, database)
  await changeSession(sessionId, "completed", database)
  return { ...fixtureData, sessionId, sessionExercises: exercises, sets }
}

describe("sessões e preservação do histórico", () => {
  it("cria snapshots e preserva histórico ao editar e arquivar a ficha", async () => {
    const { templateId, template, exercises, exerciseId } = await fixture()
    const id = await startSession(templateId, database)
    await saveWorkout(
      { ...template, name: "Nova ficha", archived: true },
      [],
      database
    )
    await database.exerciseDefinitions.update(exerciseId, {
      name: "Outro nome",
      notes: "Outra nota",
      archived: true,
    })
    const stored = await database.workoutSessions.get(id)
    const exercise = await database.sessionExercises
      .where("exerciseId")
      .equals(exerciseId)
      .first()
    expect(stored?.workoutName).toBe("Peito e abdômen")
    expect(exercise?.nameSnapshot).toBe("Supino reto")
    expect(exercise?.notesSnapshot).toBe("Banco 3\nControle a descida")
    expect(exercise?.targetSets).toBe(exercises[0]?.targetSets)
    expect(await database.setRecords.count()).toBe(3)
  })
  it("permite apenas uma sessão pendente sob chamadas concorrentes", async () => {
    const { templateId } = await fixture()
    const attempts = await Promise.allSettled([
      startSession(templateId, database),
      startSession(templateId, database),
    ])
    expect(attempts.filter((row) => row.status === "fulfilled")).toHaveLength(1)
    expect(await database.workoutSessions.count()).toBe(1)
    expect(await database.setRecords.count()).toBe(3)
  })
  it("reverte a criação inteira quando falta um exercício", async () => {
    const { templateId, exerciseId } = await fixture()
    await database.exerciseDefinitions.delete(exerciseId)
    await expect(startSession(templateId, database)).rejects.toThrow(
      "não existe"
    )
    expect(await database.workoutSessions.count()).toBe(0)
    expect(await database.sessionExercises.count()).toBe(0)
    expect(await database.setRecords.count()).toBe(0)
  })
  it("sugere valores concluídos por número da série e mantém metas nas restantes", async () => {
    const { templateId, sessionId, sets } = await completeFixture()
    const first = sets.find(
      (row) => row.type === "weight_reps" && row.setNumber === 1
    )!
    // Simulate a distinct recorded load before completion in a separate fixture below.
    if (first.type !== "weight_reps") throw new Error("Série de peso esperada")
    await database.setRecords.put({
      ...first,
      status: "completed",
      completedAt: Date.now(),
      weightKg: 62.5,
      repetitions: 9,
    })
    const next = await startSession(templateId, database)
    const exercise = await database.sessionExercises
      .where("sessionId")
      .equals(next)
      .filter((row) => row.type === "weight_reps")
      .first()
    const suggested = await database.setRecords
      .where("sessionExerciseId")
      .equals(exercise!.id)
      .sortBy("setNumber")
    expect(suggested[0]).toMatchObject({
      weightKg: 62.5,
      repetitions: 9,
      status: "pending",
    })
    expect(next).not.toBe(sessionId)
  })
  it("finaliza de forma idempotente e marca séries pendentes como ignoradas", async () => {
    const { templateId } = await fixture()
    const id = await startSession(templateId, database)
    const first = (await database.setRecords.toArray())[0]!
    await updateSet(first.id, { status: "completed" }, database)
    await changeSession(id, "completed", database)
    const before = await snapshot(database)
    await changeSession(id, "completed", database)
    const after = await snapshot(database)
    expect(after.workoutSessions).toEqual(before.workoutSessions)
    expect(after.setRecords).toEqual(before.setRecords)
    expect(
      after.setRecords.filter((row) => row.status === "skipped")
    ).toHaveLength(2)
    await expect(
      updateSet(first.id, { status: "pending" }, database)
    ).rejects.toThrow("encerrado")
  })
  it("preserva séries e observações ao fechar e reabrir o banco", async () => {
    const { templateId } = await fixture()
    const id = await startSession(templateId, database)
    const first = (await database.setRecords.toArray()).find(
      (row) => row.type === "weight_reps"
    )!
    await updateSet(first.id, { weightKg: 57.5, repetitions: 11 }, database)
    await sessionNote(id, "Retomar amanhã", false, database)
    database.close()
    await database.open()
    expect(await database.setRecords.get(first.id)).toMatchObject({
      weightKg: 57.5,
      repetitions: 11,
    })
    expect(await database.workoutSessions.get(id)).toMatchObject({
      notes: "Retomar amanhã",
      status: "active",
    })
  })
  it("calcula tempo pelo relógio e para o cronômetro ao pausar", async () => {
    const { templateId } = await fixture()
    const id = await startSession(templateId, database)
    const set = (await database.setRecords.toArray()).find(
      (row) => row.type === "time"
    )!
    const time = Date.now()
    vi.spyOn(Date, "now").mockReturnValue(time)
    await toggleTimer(set.id, database)
    vi.spyOn(Date, "now").mockReturnValue(time + 45000)
    await changeSession(id, "paused", database)
    expect(await database.setRecords.get(set.id)).toMatchObject({
      durationSeconds: 45,
      timerStartedAt: null,
    })
    await expect(toggleTimer(set.id, database)).rejects.toThrow("Retome")
  })
  it("valores inválidos falham sem alterar a série", async () => {
    const { templateId } = await fixture()
    await startSession(templateId, database)
    const set = (await database.setRecords.toArray()).find(
      (row) => row.type === "weight_reps"
    )!
    await expect(
      updateSet(set.id, { weightKg: -1 }, database)
    ).rejects.toThrow()
    expect(await database.setRecords.get(set.id)).toEqual(set)
  })
  it("adiciona/remove séries e exclui sessão sem apagar catálogo ou ficha", async () => {
    const { templateId } = await fixture()
    const id = await startSession(templateId, database)
    const exercise = (await database.sessionExercises.toArray())[0]!
    await addSet(exercise.id, database)
    const added = await database.setRecords
      .where("sessionExerciseId")
      .equals(exercise.id)
      .last()
    await removeSet(added!.id, database)
    expect(await database.setRecords.count()).toBe(3)
    await deleteSession(id, database)
    expect(await database.sessionExercises.count()).toBe(0)
    expect(await database.setRecords.count()).toBe(0)
    expect(await database.workoutTemplates.count()).toBe(1)
    expect(await database.exerciseDefinitions.count()).toBe(2)
  })
})

describe("backup e CSV", () => {
  it("reverte toda a restauração se o armazenamento falhar durante a gravação", async () => {
    await completeFixture()
    const exported = await snapshot(database)
    const target = createDatabase()
    await target.settings.put({ key: "local", value: "preservar" })
    target.workoutSessions.hook("creating", () => {
      throw new DOMException("Sem espaço", "QuotaExceededError")
    })
    await expect(restoreBackup(exported, "replace", target)).rejects.toThrow(
      "Sem espaço"
    )
    expect(await target.exerciseDefinitions.count()).toBe(0)
    expect(await target.workoutTemplates.count()).toBe(0)
    expect(await target.settings.get("local")).toEqual({
      key: "local",
      value: "preservar",
    })
  })
  it("migra uma versão anterior sem recriar o banco ou perder registros", async () => {
    await completeFixture()
    const before = await snapshot(database)
    const name = database.name
    database.close()
    const upgraded = new GymDatabase(name)
    upgraded
      .version(2)
      .stores({ settings: "key" })
      .upgrade(async (transaction) => {
        await transaction
          .table("settings")
          .put({ key: "migrationFixture", value: true })
      })
    await upgraded.open()
    expect((await snapshot(upgraded)).setRecords).toEqual(before.setRecords)
    expect((await snapshot(upgraded)).workoutSessions).toEqual(
      before.workoutSessions
    )
    expect(await upgraded.settings.get("migrationFixture")).toEqual({
      key: "migrationFixture",
      value: true,
    })
    upgraded.close()
  })
  it("restaura registros e relacionamentos em outro banco", async () => {
    await completeFixture()
    const exported = await snapshot(database)
    const target = createDatabase()
    await restoreBackup(JSON.parse(JSON.stringify(exported)), "replace", target)
    const restored = await snapshot(target)
    expect(restored.workoutSessions).toEqual(exported.workoutSessions)
    expect(restored.sessionExercises).toEqual(
      validateBackup(exported).sessionExercises
    )
    expect(restored.setRecords).toEqual(exported.setRecords)
  })
  it("mescla por ID preservando valores locais", async () => {
    await completeFixture()
    const exported = await snapshot(database)
    exported.workoutTemplates[0]!.name = "Nome no backup"
    await restoreBackup(exported, "merge", database)
    expect((await database.workoutTemplates.toArray())[0]?.name).toBe(
      "Peito e abdômen"
    )
    expect(await database.workoutSessions.count()).toBe(1)
  })
  it("recusa versão futura e relações órfãs sem alterar dados", async () => {
    await completeFixture()
    const exported = await snapshot(database)
    const before = await database.setRecords.toArray()
    await expect(
      restoreBackup({ ...exported, schemaVersion: 99 }, "replace", database)
    ).rejects.toThrow("incompatível")
    await expect(
      restoreBackup({ ...exported, sessionExercises: [] }, "replace", database)
    ).rejects.toThrow("inválido")
    expect(await database.setRecords.toArray()).toEqual(before)
  })
  it("recusa números de série duplicados e mais de uma sessão pendente", async () => {
    const { templateId } = await fixture()
    await startSession(templateId, database)
    const exported = await snapshot(database)
    expect(() =>
      validateBackup({
        ...exported,
        setRecords: [
          ...exported.setRecords,
          { ...exported.setRecords[0], id: newId() },
        ],
      })
    ).toThrow("duplicado")
    expect(() =>
      validateBackup({
        ...exported,
        workoutSessions: [
          ...exported.workoutSessions,
          { ...exported.workoutSessions[0], id: newId() },
        ],
      })
    ).toThrow("duas sessões")
  })
  it("impede restauração sobre treino pendente e pausa cronômetros importados", async () => {
    const { templateId } = await fixture()
    await startSession(templateId, database)
    const set = (await database.setRecords.toArray()).find(
      (row) => row.type === "time"
    )!
    await toggleTimer(set.id, database)
    const exported = await snapshot(database)
    await expect(restoreBackup(exported, "replace", database)).rejects.toThrow(
      "Encerre"
    )
    const target = createDatabase()
    await restoreBackup(exported, "replace", target)
    expect((await target.workoutSessions.toArray())[0]?.status).toBe("paused")
    expect(await target.setRecords.get(set.id)).toMatchObject({
      timerStartedAt: null,
    })
  })
  it("exporta CSV com BOM, acentos, vírgula decimal, escape e proteção de fórmulas", async () => {
    expect(csv([["Observações", "=1+1", 57.5, 'aspas " e;\nlinha']])).toBe(
      '\ufeff"Observações";"\'=1+1";"57,5";"aspas "" e;\nlinha"'
    )
    await completeFixture()
    const value = historyCsv(await snapshot(database))
    expect(value.split("\r\n")).toHaveLength(4)
    expect(value).toContain("Bom treino")
  })
})

function sheet(data: unknown[][]): SheetInput {
  return {
    sheet: "B",
    data,
    headerRow: 1,
    selected: true,
    mapping: guessMapping(data[0]!),
    durationUnit: "seconds",
    excluded: [],
  }
}
describe("importação Excel", () => {
  it("mapeia colunas, interpreta repetições e tempo, indicando a linha inválida", () => {
    const rows = previewImport([
      sheet([
        ["Exercício", "Séries", "Repetições", "Carga", "Tempo"],
        ["Supino", 3, "8-12", "57,5", null],
        ["Prancha", 3, null, null, "01:30"],
        ["Inválido", 0, "12-8", -2, null],
      ]),
    ])
    expect(rows[0]).toMatchObject({
      code: "B",
      errors: [],
      targets: { type: "weight_reps", targetWeight: 57.5, targetReps: "8-12" },
    })
    expect(rows[1]).toMatchObject({
      errors: [],
      targets: { type: "time", targetSeconds: 90 },
    })
    expect(rows[2]?.row).toBe(4)
    expect(rows[2]?.errors.length).toBeGreaterThan(0)
  })
  it("bloqueia linhas inválidas até a exclusão explícita", async () => {
    const input = sheet([
      ["Exercício", "Séries", "Repetições"],
      ["Supino", 3, "10"],
      ["", 0, ""],
    ])
    await expect(
      importRows(previewImport([input]), {}, database)
    ).rejects.toThrow("inválidas")
    expect(await database.workoutTemplates.count()).toBe(0)
    input.excluded = [3]
    expect(await importRows(previewImport([input]), {}, database)).toBe(1)
    expect(await database.templateExercises.count()).toBe(1)
  })
  it("atualiza, ignora e cria fichas sem alterar histórico", async () => {
    const { sessionId } = await completeFixture()
    const input = sheet([
      ["Treino", "Exercício", "Séries", "Repetições"],
      ["A", "Remada", 3, "10"],
    ])
    const rows = previewImport([input])
    expect(await importRows(rows, { a: "skip" }, database)).toBe(0)
    expect(await importRows(rows, { a: "update" }, database)).toBe(1)
    expect(
      (
        await database.sessionExercises
          .where("sessionId")
          .equals(sessionId)
          .toArray()
      ).map((row) => row.nameSnapshot)
    ).toContain("Supino reto")
    expect(await importRows(rows, { a: "new" }, database)).toBe(1)
    expect(
      (await database.workoutTemplates.toArray()).map((row) => row.code)
    ).toContain("A (2)")
  })
  it("reverte fichas anteriores se houver conflito sem decisão", async () => {
    await fixture()
    const input = sheet([
      ["Treino", "Exercício", "Séries", "Repetições"],
      ["B", "Rosca", 3, "10"],
      ["A", "Supino", 3, "10"],
    ])
    await expect(
      importRows(previewImport([input]), {}, database)
    ).rejects.toThrow("Escolha")
    expect(await database.workoutTemplates.count()).toBe(1)
    expect(
      (await database.exerciseDefinitions.toArray()).some(
        (row) => row.name === "Rosca"
      )
    ).toBe(false)
  })
  it("converte minutos e rejeita duração inválida", () => {
    const input = sheet([
      ["Exercício", "Séries", "Tempo"],
      ["Prancha", 1, "1,5"],
    ])
    input.durationUnit = "minutes"
    expect(previewImport([input])[0]?.targets).toMatchObject({
      targetSeconds: 90,
    })
    expect(secondsValue("01:30")).toBe(90)
    expect(() => secondsValue("01:99")).toThrow()
    expect(() => numberValue("")).toThrow()
    expect(localDate(new Date(2026, 9, 26, 23, 59))).toBe("2026-10-26")
  })
})
