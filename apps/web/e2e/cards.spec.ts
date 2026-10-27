import { test, expect } from "@playwright/test"
import {
  ready,
  createWorkout,
  start,
  openExercise,
  exerciseCard,
  saved,
} from "./helpers"

test("cards recolhidos preservam valores offline e conclusão em lote exige confirmação", async ({
  page,
  context,
}) => {
  await ready(page)
  await context.setOffline(true)
  await createWorkout(page)
  await start(page, false)
  await expect(page.locator('[data-slot="accordion-trigger"]')).toHaveCount(2)
  await expect(page.getByRole("spinbutton")).toHaveCount(0)
  await openExercise(page, "Supino reto")
  await page.getByLabel("Carga da série 1 (kg)", { exact: true }).fill("42,5")
  // Collapsing immediately must wait for the write, without discarding the input.
  await exerciseCard(page, "Supino reto").click()
  await expect(exerciseCard(page, "Supino reto")).toHaveAttribute(
    "aria-expanded",
    "false"
  )
  await openExercise(page, "Supino reto")
  await expect(
    page.getByLabel("Carga da série 1 (kg)", { exact: true })
  ).toHaveValue("42,5")
  await page
    .getByRole("button", { name: "Ignorar série 2", exact: true })
    .click()
  await page
    .getByRole("button", { name: "Adicionar série", exact: true })
    .click()
  await page.getByLabel("Carga da série 3 (kg)", { exact: true }).fill("60")
  await saved(page)
  await page
    .getByRole("button", { name: "Concluir série 3", exact: true })
    .click()
  await page
    .getByRole("button", { name: "Concluir todas", exact: true })
    .click()
  await expect(page.getByRole("dialog")).toContainText(
    "Somente 1 série pendente"
  )
  await page.getByRole("button", { name: "Cancelar", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Concluir série 1", exact: true })
  ).toBeVisible()
  await page
    .getByRole("button", { name: "Concluir todas", exact: true })
    .click()
  await page.getByRole("button", { name: "Confirmar", exact: true }).click()
  await expect(
    page.getByText("1 série concluída nesta ação.", { exact: true })
  ).toBeVisible()
  await expect(exerciseCard(page, "Supino reto")).toContainText("2 concluídas")
  await expect(exerciseCard(page, "Supino reto")).toContainText("1 ignorada")
  await expect(exerciseCard(page, "Supino reto")).toContainText("0 pendentes")
  await expect(
    page.getByRole("button", { name: "Concluir todas", exact: true })
  ).toBeDisabled()
  await expect(
    page.getByLabel("Carga da série 3 (kg)", { exact: true })
  ).toHaveValue("60")
  await page
    .getByRole("button", { name: "Desfazer série 1", exact: true })
    .click()
  await expect(
    page.getByRole("button", { name: "Concluir todas", exact: true })
  ).toBeEnabled()
  const other = await context.newPage()
  await other.goto(page.url())
  await openExercise(other, "Supino reto")
  await page
    .getByRole("button", { name: "Concluir todas", exact: true })
    .click()
  await other
    .getByRole("button", { name: "Concluir todas", exact: true })
    .click()
  await Promise.all([
    page.getByRole("button", { name: "Confirmar", exact: true }).click(),
    other.getByRole("button", { name: "Confirmar", exact: true }).click(),
  ])
  await saved(page)
  await saved(other)
  for (const tab of [page, other]) {
    await expect(exerciseCard(tab, "Supino reto")).toContainText("2 concluídas")
    await expect(exerciseCard(tab, "Supino reto")).toContainText("1 ignorada")
    await expect(
      tab.getByRole("button", { name: "Concluir todas", exact: true })
    ).toBeDisabled()
  }
  await expect(
    other.getByText(
      /^(1 série concluída nesta ação\.|Nenhuma série pendente para concluir\.)$/
    )
  ).toBeVisible()
  await other.close()
  await openExercise(page, "Prancha")
  await expect(exerciseCard(page, "Supino reto")).toHaveAttribute(
    "aria-expanded",
    "false"
  )
  await page.reload()
  await expect(
    page.locator('[data-slot="accordion-trigger"][aria-expanded="true"]')
  ).toHaveCount(0)
  await openExercise(page, "Supino reto")
  await expect(
    page.getByLabel("Carga da série 1 (kg)", { exact: true })
  ).toHaveValue("42,5")
  await expect(
    page.getByRole("button", { name: "Finalizar treino", exact: true })
  ).toBeVisible()
})

test("cronômetro e treino pausado bloqueiam concluir todas, com retomada offline", async ({
  page,
  context,
}) => {
  await ready(page)
  await context.setOffline(true)
  await createWorkout(page)
  await start(page)
  await openExercise(page, "Prancha")
  await page.getByRole("button", { name: "Cronometrar", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Concluir todas", exact: true })
  ).toBeDisabled()
  await page.reload()
  await openExercise(page, "Prancha")
  await expect(
    page.getByRole("button", { name: "Parar", exact: true })
  ).toBeVisible()
  await page.getByRole("button", { name: "Pausar treino", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Retomar treino", exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Concluir todas", exact: true })
  ).toBeDisabled()
  await page.reload()
  await page
    .getByRole("button", { name: "Retomar treino", exact: true })
    .click()
  await openExercise(page, "Prancha")
  await page
    .getByLabel("Duração da série 1 (segundos)", { exact: true })
    .fill("75")
  await saved(page)
  await page
    .getByRole("button", { name: "Concluir todas", exact: true })
    .click()
  await page.getByRole("button", { name: "Confirmar", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Desfazer série 1", exact: true })
  ).toBeVisible()
  await expect(page.getByText("01:15 (mm:ss)", { exact: true })).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Pausar treino", exact: true })
  ).toBeVisible()
})
