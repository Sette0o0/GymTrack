import { afterEach, expect, it } from "vitest"
import { GymDatabase } from "@/db/database"
import { newId } from "@/lib/schema"
import { muscleGroups, templateMuscleGroups } from "@/lib/muscle-groups"
import {
  guessMapping,
  previewImport,
  importRows,
  type SheetInput,
} from "@/services/import"
import { startSession, changeSession } from "@/services/sessions"
import { snapshot } from "@/db/repository"
import { validateBackup, restoreBackup } from "@/services/backup"

const databases: GymDatabase[] = []
function database() {
  const db = new GymDatabase(`groups-${newId()}`)
  databases.push(db)
  return db
}
afterEach(async () => {
  for (const db of databases.splice(0)) await db.delete()
})
const sheet = (): SheetInput => {
  const data = [
    ["Treino", "Exercício", "Séries", "Repetições", "Grupo muscular"],
    ["A", "Supino", 2, "8-12", "Peito, tríceps"],
    ["A", "Prancha", 1, "45 s", "Core"],
  ]
  return {
    sheet: "Treinos",
    data,
    selected: true,
    headerRow: 1,
    mapping: guessMapping(data[0]!),
    durationUnit: "seconds",
    excluded: [],
  }
}
it("mapeia e importa agrupamentos opcionais, exibindo a união dos grupos", async () => {
  const db = database()
  const rows = previewImport([sheet()])
  expect(rows[0]?.muscleGroup).toBe("Peito, tríceps")
  expect(rows.every((row) => !row.errors.length)).toBe(true)
  await importRows(rows, {}, db)
  const data = await snapshot(db)
  expect(templateMuscleGroups(data, data.workoutTemplates[0]!.id)).toEqual([
    "Peito",
    "tríceps",
    "Core",
  ])
  expect(
    muscleGroups(["Peito; TRÍCEPS", "peito, triceps", "", undefined])
  ).toEqual(["Peito", "TRÍCEPS"])
})
it("atualiza classificação do catálogo sem reescrever snapshots históricos", async () => {
  const db = database()
  await importRows(previewImport([sheet()]), {}, db)
  const template = (await db.workoutTemplates.toArray())[0]!
  const id = await startSession(template.id, db)
  await changeSession(id, "completed", db)
  const before = await db.sessionExercises.toArray()
  const next = sheet()
  next.data[1]![4] = "Membros superiores"
  await importRows(previewImport([next]), { a: "update" }, db)
  expect(
    (await db.exerciseDefinitions.toArray()).find(
      (row) => row.name === "Supino"
    )?.muscleGroup
  ).toBe("Membros superiores")
  expect(await db.sessionExercises.toArray()).toEqual(before)
  expect(
    before.some((row) => row.muscleGroupSnapshot === "Peito, tríceps")
  ).toBe(true)
})
it("mantém compatibilidade de backup v2 e preserva classificações v3 na restauração", async () => {
  const db = database(),
    restored = database()
  await importRows(previewImport([sheet()]), {}, db)
  const exported = await snapshot(db)
  expect(exported.schemaVersion).toBe(3)
  await restoreBackup(exported, "merge", restored)
  expect((await snapshot(restored)).exerciseDefinitions).toEqual(
    exported.exerciseDefinitions
  )
  const legacy = {
    ...exported,
    schemaVersion: 2,
    exerciseDefinitions: exported.exerciseDefinitions.map((row) => {
      const legacyRow = { ...row }
      delete legacyRow.muscleGroup
      return legacyRow
    }),
  }
  expect(validateBackup(legacy).schemaVersion).toBe(3)
})
it("recusa classificação longa antes de gravar", async () => {
  const db = database(),
    invalid = sheet()
  invalid.data[1]![4] = "a".repeat(201)
  const rows = previewImport([invalid])
  expect(rows[0]?.errors.join()).toContain("Agrupamento muscular")
  await expect(importRows(rows, {}, db)).rejects.toThrow()
  expect(await db.exerciseDefinitions.count()).toBe(0)
})
