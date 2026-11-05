import { Badge } from "@workspace/ui/components/badge"
import { muscleGroups } from "@/lib/muscle-groups"

export function MuscleGroups({ values }: { values: (string | undefined)[] }) {
  const groups = muscleGroups(values)
  if (!groups.length) return null
  return (
    <div className="muscle-groups" aria-label="Agrupamentos musculares">
      {groups.map((group) => (
        <Badge variant="secondary" key={group}>
          {group}
        </Badge>
      ))}
    </div>
  )
}
