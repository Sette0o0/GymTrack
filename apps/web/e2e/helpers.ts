import { expect, type Page } from "@playwright/test"

export async function choose(page: Page, label: string, option: string) {
  await page.getByLabel(label, { exact: true }).click()
  await page.getByRole("option", { name: option, exact: true }).click()
}
export async function ready(page: Page) {
  await page.goto("/")
  await expect(
    page.getByText("Disponível offline", { exact: true })
  ).toBeVisible({ timeout: 30000 })
}
export async function saved(page: Page) {
  await expect(
    page.getByText("Dados salvos neste dispositivo", { exact: true })
  ).toBeVisible()
}
export async function createExercise(page: Page, name: string, time = false) {
  await page.goto("/exercicios/")
  await page
    .getByRole("button", { name: "Novo exercício", exact: true })
    .click()
  await page.getByLabel("Nome do exercício", { exact: true }).fill(name)
  if (time) await choose(page, "Tipo padrão", "Tempo")
  await page
    .getByRole("button", { name: "Salvar exercício", exact: true })
    .click()
  await expect(
    page.getByRole("heading", { name: "Novo exercício", exact: true })
  ).not.toBeVisible()
}
export async function createWorkout(page: Page) {
  await createExercise(page, "Supino reto")
  await createExercise(page, "Prancha", true)
  await page.goto("/treinos/?novo=1")
  await page.getByLabel("Código do treino", { exact: true }).fill("A")
  await page
    .getByLabel("Nome da ficha", { exact: true })
    .fill("Peito e abdômen")
  await choose(page, "Escolher do catálogo", "Supino reto")
  await page.getByRole("button", { name: "Adicionar", exact: true }).click()
  await page.getByLabel("Quantidade de séries", { exact: true }).fill("2")
  await choose(page, "Escolher do catálogo", "Prancha")
  await page.getByRole("button", { name: "Adicionar", exact: true }).click()
  await page
    .getByLabel("Quantidade de séries", { exact: true })
    .nth(1)
    .fill("1")
  await page
    .getByLabel("Observação fixa nesta ficha", { exact: true })
    .nth(0)
    .fill("Banco na posição 3")
  await page.getByRole("button", { name: "Salvar ficha", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "Minhas fichas", exact: true })
  ).toBeVisible()
}
export function exerciseCard(page: Page, name: string) {
  return page
    .locator('[data-slot="accordion-trigger"]')
    .filter({ hasText: name })
}
export async function openExercise(page: Page, name: string) {
  const card = exerciseCard(page, name)
  await expect(card).toBeVisible()
  if ((await card.getAttribute("aria-expanded")) !== "true") await card.click()
  await expect(card).toHaveAttribute("aria-expanded", "true")
}
export async function start(page: Page, openFirst = true) {
  await page.getByRole("button", { name: "Iniciar", exact: true }).click()
  await expect(page).toHaveURL(/executar\/\?id=/)
  await expect(
    page.locator('[data-slot="accordion-trigger"][aria-expanded="true"]')
  ).toHaveCount(0)
  if (!openFirst) return
  await openExercise(page, "Supino reto")
  await expect(
    page.getByLabel("Carga da série 1 (kg)", { exact: true })
  ).toBeVisible()
}
export async function finish(page: Page) {
  await page
    .getByRole("button", { name: "Finalizar treino", exact: true })
    .click()
  await page.getByRole("button", { name: "Confirmar", exact: true }).click()
  await expect(page).toHaveURL(/historico\/\?id=/)
}
