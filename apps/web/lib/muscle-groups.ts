import type { Backup } from "./schema"

export function muscleGroups(values: (string | undefined)[]) {
  const unique = new Map<string, string>()
  for (const value of values)
    for (const part of (value ?? "").split(/[,;/|]/)) {
      const group = part.trim()
      const key = group
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("pt-BR")
      if (group && !unique.has(key)) unique.set(key, group)
    }
  return [...unique.values()]
}

export function templateMuscleGroups(data: Backup, templateId: string) {
  return muscleGroups(
    data.templateExercises
      .filter((row) => row.templateId === templateId)
      .sort((a, b) => a.order - b.order)
      .map(
        (row) =>
          data.exerciseDefinitions.find(
            (definition) => definition.id === row.exerciseId
          )?.muscleGroup
      )
  )
}
