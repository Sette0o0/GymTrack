import { db, type GymDatabase } from "./database"
import type { Backup } from "@/lib/schema"

export async function snapshot(database: GymDatabase = db): Promise<Backup> {
  return database.transaction("r", database.tables, async () => ({
    format: "gymtrack-backup",
    schemaVersion: 1,
    exportedAt: Date.now(),
    exerciseDefinitions: await database.exerciseDefinitions.toArray(),
    workoutTemplates: await database.workoutTemplates
      .orderBy("order")
      .toArray(),
    templateExercises: await database.templateExercises.toArray(),
    workoutSessions: await database.workoutSessions
      .orderBy("startedAt")
      .reverse()
      .toArray(),
    sessionExercises: await database.sessionExercises.toArray(),
    setRecords: await database.setRecords.toArray(),
    settings: await database.settings.toArray(),
  }))
}
