import { describe, expect, it } from "vitest"
import { nextWorkout, sortWorkouts } from "@/lib/workout-navigation"
import type { WorkoutSession, WorkoutTemplate } from "@/lib/schema"

const template = (code: string, archived = false): WorkoutTemplate => ({
  id: code,
  code,
  name: code,
  archived,
  order: 0,
  description: "",
  createdAt: 0,
  updatedAt: 0,
})
const session = (
  code: string,
  finishedAt: number,
  startedAt = 0
): WorkoutSession => ({
  id: code,
  templateId: code,
  workoutCode: code,
  workoutName: code,
  status: "completed",
  startedAt,
  finishedAt,
  localDate: "2026-11-03",
  notes: "",
})
describe("próxima ficha", () => {
  it("ordena códigos naturalmente sem alterar a lista original", () => {
    const rows = [template("10"), template("2"), template("1")]
    expect(sortWorkouts(rows).map((row) => row.code)).toEqual(["1", "2", "10"])
    expect(rows[0]?.code).toBe("10")
  })
  it("usa a primeira ficha ativa sem histórico e retorna vazio sem fichas", () => {
    expect(nextWorkout([template("B"), template("A", true)], [])?.code).toBe(
      "B"
    )
    expect(nextWorkout([], [])).toBeUndefined()
  })
  it("segue a última finalização e retorna ao começo no fim do ciclo", () => {
    const rows = [template("C"), template("B"), template("A")]
    expect(
      nextWorkout(rows, [session("A", 30, 1), session("B", 20, 10)])?.code
    ).toBe("B")
    expect(nextWorkout(rows, [session("C", 40)])?.code).toBe("A")
  })
  it("usa o código histórico de uma ficha arquivada ou removida", () => {
    const rows = [template("A"), template("B", true), template("C")]
    expect(nextWorkout(rows, [session("B", 10)])?.code).toBe("C")
    expect(nextWorkout(rows, [session("Z", 10)])?.code).toBe("A")
    expect(nextWorkout(rows, [session("0", 10)])?.code).toBe("A")
  })
  it("ignora sessões pendentes e usa o código atual de fichas renomeadas", () => {
    const rows = [template("A"), { ...template("D"), id: "B" }, template("C")]
    expect(
      nextWorkout(rows, [{ ...session("A", 100), status: "paused" }])?.code
    ).toBe("A")
    expect(nextWorkout(rows, [session("B", 10)])?.code).toBe("A")
  })
})
