import { db, type GymDatabase } from "@/db/database"
import {
  definitionSchema,
  templateSchema,
  templateExerciseSchema,
  newId,
  type ExerciseDefinition,
  type WorkoutTemplate,
  type TemplateExercise,
} from "@/lib/schema"

export async function saveDefinition(
  input: ExerciseDefinition,
  database: GymDatabase = db
) {
  await database.exerciseDefinitions.put(
    definitionSchema.parse({ ...input, updatedAt: Date.now() })
  )
}
export async function saveWorkout(
  input: WorkoutTemplate,
  exercises: TemplateExercise[],
  database: GymDatabase = db
) {
  const template = templateSchema.parse({ ...input, updatedAt: Date.now() })
  const rows = exercises.map((exercise, order) =>
    templateExerciseSchema.parse({
      ...exercise,
      templateId: template.id,
      order,
    })
  )
  await database.transaction(
    "rw",
    [
      database.workoutTemplates,
      database.templateExercises,
      database.exerciseDefinitions,
    ],
    async () => {
      const duplicate = (await database.workoutTemplates.toArray()).some(
        (row) =>
          row.id !== template.id &&
          row.code.toLocaleLowerCase() === template.code.toLocaleLowerCase()
      )
      if (duplicate)
        throw new Error(
          "Já existe uma ficha com esse código. Use outro código."
        )
      for (const row of rows)
        if (!(await database.exerciseDefinitions.get(row.exerciseId)))
          throw new Error("Exercício não encontrado no catálogo.")
      await database.workoutTemplates.put(template)
      await database.templateExercises
        .where("templateId")
        .equals(template.id)
        .delete()
      await database.templateExercises.bulkAdd(rows)
    }
  )
}
export function emptyWorkout(order: number): WorkoutTemplate {
  return {
    id: newId(),
    code: "",
    name: "",
    description: "",
    order,
    archived: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}
export async function archiveWorkout(id: string, archived: boolean) {
  await db.workoutTemplates.update(id, { archived, updatedAt: Date.now() })
}
