import { db, type GymDatabase } from "@/db/database"
import {
  localDate,
  newId,
  setSchema,
  type SetRecord,
  type SessionExercise,
  type WorkoutSession,
} from "@/lib/schema"

export async function startSession(
  templateId: string,
  database: GymDatabase = db
) {
  return database.transaction("rw", database.tables, async () => {
    const pending = await database.workoutSessions
      .filter((session) => session.status !== "completed")
      .first()
    if (pending)
      throw new Error(
        "Você já tem um treino pendente. Retome ou encerre antes de começar outro."
      )
    const template = await database.workoutTemplates.get(templateId)
    if (!template || template.archived) throw new Error("Ficha indisponível.")
    const exercises = (
      await database.templateExercises
        .where("templateId")
        .equals(templateId)
        .toArray()
    ).sort((a, b) => a.order - b.order)
    if (!exercises.length)
      throw new Error("Adicione exercícios à ficha antes de iniciar.")
    const session: WorkoutSession = {
      id: newId(),
      templateId,
      workoutName: template.name,
      workoutCode: template.code,
      startedAt: Date.now(),
      localDate: localDate(),
      finishedAt: null,
      status: "active",
      notes: "",
    }
    await database.workoutSessions.add(session)
    const completed = (
      await database.workoutSessions
        .filter((row) => row.status === "completed")
        .toArray()
    ).sort((a, b) => b.startedAt - a.startedAt)
    for (const exercise of exercises) {
      const definition = await database.exerciseDefinitions.get(
        exercise.exerciseId
      )
      if (!definition) throw new Error("Um exercício da ficha não existe mais.")
      const snapshot: SessionExercise = {
        ...exercise,
        id: newId(),
        sessionId: session.id,
        nameSnapshot: definition.name,
        notesSnapshot: [definition.notes, exercise.notes]
          .filter(Boolean)
          .join("\n"),
        sessionNotes: "",
      }
      await database.sessionExercises.add(snapshot)
      const candidates = await database.sessionExercises
        .where("exerciseId")
        .equals(exercise.exerciseId)
        .toArray()
      let previous: SetRecord[] = []
      for (const prior of completed) {
        const found = candidates.find(
          (row) => row.sessionId === prior.id && row.type === exercise.type
        )
        if (!found) continue
        previous = (
          await database.setRecords
            .where("sessionExerciseId")
            .equals(found.id)
            .toArray()
        )
          .filter((row) => row.status === "completed")
          .sort((a, b) => a.setNumber - b.setNumber)
        if (previous.length) break
      }
      for (let index = 0; index < exercise.targetSets; index++) {
        const suggestion = previous.find((row) => row.setNumber === index + 1)
        const base = {
          id: newId(),
          sessionExerciseId: snapshot.id,
          setNumber: index + 1,
          status: "pending" as const,
          completedAt: null,
        }
        const record: SetRecord =
          exercise.type === "time"
            ? {
                ...base,
                type: "time",
                durationSeconds:
                  suggestion?.type === "time"
                    ? suggestion.durationSeconds
                    : exercise.targetSeconds,
                timerStartedAt: null,
              }
            : {
                ...base,
                type: "weight_reps",
                weightKg:
                  suggestion?.type === "weight_reps" ? suggestion.weightKg : 0,
                repetitions:
                  suggestion?.type === "weight_reps"
                    ? suggestion.repetitions
                    : Number(exercise.targetReps.split(/[-–]/)[0]),
              }
        await database.setRecords.add(setSchema.parse(record))
      }
    }
    return session.id
  })
}
async function editableSession(exerciseId: string, database: GymDatabase) {
  const exercise = await database.sessionExercises.get(exerciseId)
  const session =
    exercise && (await database.workoutSessions.get(exercise.sessionId))
  if (!exercise || !session || session.status === "completed")
    throw new Error("Este treino já foi encerrado ou não existe.")
  return { exercise, session }
}
export async function updateSet(
  id: string,
  patch: Partial<SetRecord>,
  database: GymDatabase = db
) {
  await database.transaction(
    "rw",
    [database.setRecords, database.sessionExercises, database.workoutSessions],
    async () => {
      const existing = await database.setRecords.get(id)
      if (!existing) throw new Error("Série não encontrada.")
      await editableSession(existing.sessionExerciseId, database)
      const updated = setSchema.parse({
        ...existing,
        ...patch,
        id: existing.id,
        sessionExerciseId: existing.sessionExerciseId,
        type: existing.type,
      })
      if (
        updated.type === "time" &&
        updated.timerStartedAt !== null &&
        updated.status !== "pending"
      )
        throw new Error(
          "Pare o cronômetro antes de concluir ou ignorar a série."
        )
      await database.setRecords.put({
        ...updated,
        completedAt:
          updated.status === "completed"
            ? (existing.completedAt ?? Date.now())
            : null,
      })
    }
  )
}
export async function completePendingSets(
  sessionExerciseId: string,
  database: GymDatabase = db
): Promise<number> {
  return database.transaction(
    "rw",
    [database.setRecords, database.sessionExercises, database.workoutSessions],
    async () => {
      const { session } = await editableSession(sessionExerciseId, database)
      if (session.status !== "active")
        throw new Error("Retome o treino antes de concluir as séries.")
      const sets = await database.setRecords
        .where("sessionExerciseId")
        .equals(sessionExerciseId)
        .toArray()
      if (
        sets.some((set) => set.type === "time" && set.timerStartedAt !== null)
      )
        throw new Error(
          "Pare o cronômetro deste exercício antes de concluir todas as séries."
        )
      const completedAt = Date.now()
      const pending = sets
        .filter((set) => set.status === "pending")
        .map((set) =>
          setSchema.parse({ ...set, status: "completed", completedAt })
        )
      // Validate every pending set before writing; the transaction also rolls back storage failures.
      if (pending.length) await database.setRecords.bulkPut(pending)
      return pending.length
    }
  )
}
export async function toggleTimer(id: string, database: GymDatabase = db) {
  await database.transaction(
    "rw",
    [database.setRecords, database.sessionExercises, database.workoutSessions],
    async () => {
      const set = await database.setRecords.get(id)
      if (!set || set.type !== "time")
        throw new Error("Série por tempo não encontrada.")
      const { session } = await editableSession(set.sessionExerciseId, database)
      if (session.status !== "active" || set.status !== "pending")
        throw new Error(
          "Retome o treino e desfaça a conclusão antes de usar o cronômetro."
        )
      await database.setRecords.put(
        set.timerStartedAt === null
          ? { ...set, durationSeconds: 1, timerStartedAt: Date.now() }
          : {
              ...set,
              durationSeconds: Math.min(
                86400,
                Math.max(
                  1,
                  Math.floor((Date.now() - set.timerStartedAt) / 1000)
                )
              ),
              timerStartedAt: null,
            }
      )
    }
  )
}
export async function addSet(exerciseId: string, database: GymDatabase = db) {
  await database.transaction(
    "rw",
    [database.setRecords, database.sessionExercises, database.workoutSessions],
    async () => {
      const { exercise } = await editableSession(exerciseId, database)
      const sets = (
        await database.setRecords
          .where("sessionExerciseId")
          .equals(exerciseId)
          .toArray()
      ).sort((a, b) => a.setNumber - b.setNumber)
      if (sets.length >= 100)
        throw new Error("Limite de 100 séries por exercício.")
      const last = sets.at(-1)
      const common = {
        id: newId(),
        sessionExerciseId: exerciseId,
        setNumber: (last?.setNumber ?? 0) + 1,
        status: "pending" as const,
        completedAt: null,
      }
      await database.setRecords.add(
        last
          ? setSchema.parse({
              ...last,
              ...common,
              ...(last.type === "time" ? { timerStartedAt: null } : {}),
            })
          : exercise.type === "time"
            ? {
                ...common,
                type: "time",
                durationSeconds: exercise.targetSeconds,
                timerStartedAt: null,
              }
            : {
                ...common,
                type: "weight_reps",
                weightKg: 0,
                repetitions: Number(exercise.targetReps.split(/[-–]/)[0]),
              }
      )
    }
  )
}
export async function removeSet(id: string, database: GymDatabase = db) {
  await database.transaction(
    "rw",
    [database.setRecords, database.sessionExercises, database.workoutSessions],
    async () => {
      const set = await database.setRecords.get(id)
      if (!set) return
      await editableSession(set.sessionExerciseId, database)
      await database.setRecords.delete(id)
    }
  )
}
export async function sessionNote(
  id: string,
  notes: string,
  exercise = false,
  database: GymDatabase = db
) {
  await database.transaction(
    "rw",
    [database.sessionExercises, database.workoutSessions],
    async () => {
      if (notes.length > 10000) throw new Error("Observação muito longa.")
      if (exercise) {
        await editableSession(id, database)
        await database.sessionExercises.update(id, { sessionNotes: notes })
      } else {
        const session = await database.workoutSessions.get(id)
        if (!session || session.status === "completed")
          throw new Error("Sessão indisponível para edição.")
        await database.workoutSessions.update(id, { notes })
      }
    }
  )
}
export async function changeSession(
  id: string,
  status: WorkoutSession["status"],
  database: GymDatabase = db
) {
  await database.transaction(
    "rw",
    [database.workoutSessions, database.sessionExercises, database.setRecords],
    async () => {
      const session = await database.workoutSessions.get(id)
      if (!session) throw new Error("Sessão não encontrada.")
      if (session.status === "completed") return
      if (status !== "active") {
        const exercises = await database.sessionExercises
          .where("sessionId")
          .equals(id)
          .toArray()
        for (const exercise of exercises) {
          const sets = await database.setRecords
            .where("sessionExerciseId")
            .equals(exercise.id)
            .toArray()
          for (const set of sets) {
            const timer =
              set.type === "time" && set.timerStartedAt !== null
                ? {
                    durationSeconds: Math.min(
                      86400,
                      Math.max(
                        1,
                        Math.floor((Date.now() - set.timerStartedAt) / 1000)
                      )
                    ),
                    timerStartedAt: null,
                  }
                : {}
            await database.setRecords.put({
              ...set,
              ...timer,
              ...(status === "completed" && set.status === "pending"
                ? { status: "skipped" as const }
                : {}),
            })
          }
        }
      }
      await database.workoutSessions.update(id, {
        status,
        finishedAt: status === "completed" ? Date.now() : null,
      })
    }
  )
}
export async function deleteSession(id: string, database: GymDatabase = db) {
  await database.transaction(
    "rw",
    [database.workoutSessions, database.sessionExercises, database.setRecords],
    async () => {
      const exercises = await database.sessionExercises
        .where("sessionId")
        .equals(id)
        .toArray()
      for (const exercise of exercises)
        await database.setRecords
          .where("sessionExerciseId")
          .equals(exercise.id)
          .delete()
      await database.sessionExercises.where("sessionId").equals(id).delete()
      await database.workoutSessions.delete(id)
    }
  )
}
