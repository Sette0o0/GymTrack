import Dexie, { type Table } from "dexie"
import type {
  ExerciseDefinition,
  WorkoutTemplate,
  TemplateExercise,
  WorkoutSession,
  SessionExercise,
  SetRecord,
  Setting,
} from "@/lib/schema"

export class GymDatabase extends Dexie {
  exerciseDefinitions!: Table<ExerciseDefinition, string>
  workoutTemplates!: Table<WorkoutTemplate, string>
  templateExercises!: Table<TemplateExercise, string>
  workoutSessions!: Table<WorkoutSession, string>
  sessionExercises!: Table<SessionExercise, string>
  setRecords!: Table<SetRecord, string>
  settings!: Table<Setting, string>

  constructor(name = "gymtrack") {
    super(name)
    // Never change an existing version: add a version(n).stores(...).upgrade(...) migration.
    this.version(1).stores({
      exerciseDefinitions: "id, name, archived",
      workoutTemplates: "id, code, order, archived",
      templateExercises: "id, templateId, exerciseId, [templateId+order]",
      workoutSessions: "id, templateId, status, startedAt, localDate",
      sessionExercises: "id, sessionId, exerciseId, [sessionId+order]",
      setRecords: "id, sessionExerciseId, &[sessionExerciseId+setNumber]",
      settings: "key",
    })
  }
}
export const db = new GymDatabase()
