import type { WorkoutSession, WorkoutTemplate } from "./schema"

const codes = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" })

export function sortWorkouts(templates: WorkoutTemplate[]) {
  return [...templates].sort(
    (a, b) =>
      codes.compare(a.code, b.code) ||
      a.order - b.order ||
      a.id.localeCompare(b.id)
  )
}

export function nextWorkout(
  templates: WorkoutTemplate[],
  sessions: WorkoutSession[]
) {
  const available = sortWorkouts(templates.filter((row) => !row.archived))
  const last = sessions
    .filter((row) => row.status === "completed")
    .sort(
      (a, b) => (b.finishedAt ?? b.startedAt) - (a.finishedAt ?? a.startedAt)
    )[0]
  if (!last) return available[0]
  const index = available.findIndex((row) => row.id === last.templateId)
  if (index >= 0) return available[(index + 1) % available.length]
  return (
    available.find((row) => codes.compare(row.code, last.workoutCode) > 0) ??
    available[0]
  )
}
