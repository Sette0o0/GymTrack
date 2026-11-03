import { test, expect, type Page } from "@playwright/test"
import { ready, createWorkout, choose, finish, saved } from "./helpers"

async function sessionCount(page: Page) {
  return page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const request = indexedDB.open("gymtrack")
        request.onsuccess = () => {
          const database = request.result
          const transaction = database.transaction(
            "workoutSessions",
            "readonly"
          )
          const count = transaction.objectStore("workoutSessions").count()
          count.onsuccess = () => resolve(count.result)
          transaction.oncomplete = () => database.close()
          transaction.onerror = () => reject(transaction.error)
        }
        request.onerror = () => reject(request.error)
      })
  )
}

test("próxima ficha por código, detalhes sem iniciar e retomada funcionam offline", async ({
  page,
  context,
}) => {
  await ready(page)
  await context.setOffline(true)
  await createWorkout(page)
  for (const code of ["10", "2", "1"]) {
    await page.goto("/treinos/?novo=1")
    await page.getByLabel("Código do treino", { exact: true }).fill(code)
    await page
      .getByLabel("Nome da ficha", { exact: true })
      .fill(`Rotina ${code}`)
    await choose(page, "Escolher do catálogo", "Supino reto")
    await page.getByRole("button", { name: "Adicionar", exact: true }).click()
    await page
      .getByRole("button", { name: "Salvar ficha", exact: true })
      .click()
    await expect(
      page.getByRole("heading", { name: "Minhas fichas", exact: true })
    ).toBeVisible()
  }
  await expect(page.locator(".workout-list-card .workout-letter")).toHaveText([
    "1",
    "2",
    "10",
    "A",
  ])
  await page.goto("/")
  await expect(page.locator(".next-workout")).toContainText("1 · Rotina 1")
  await page
    .getByRole("link", { name: "Começar meu treino", exact: true })
    .click()
  await expect(
    page.getByRole("heading", { name: "1 · Rotina 1", exact: true })
  ).toBeVisible()
  await expect(
    page.getByText("3 séries · 8-12 reps", { exact: true })
  ).toBeVisible()
  expect(await sessionCount(page)).toBe(0)
  await page.reload()
  expect(await sessionCount(page)).toBe(0)
  await page
    .getByRole("button", { name: "Começar treino", exact: true })
    .click()
  await expect(page).toHaveURL(/executar\/\?id=/)
  await saved(page)
  expect(await sessionCount(page)).toBe(1)
  await page.goto("/")
  await expect(
    page.getByRole("link", { name: "Retomar treino", exact: true })
  ).toBeVisible()
  await page.getByRole("link", { name: "Retomar treino", exact: true }).click()
  await finish(page)
  await page.goto("/")
  await expect(page.locator(".next-workout")).toContainText("2 · Rotina 2")
  await page
    .getByRole("link", { name: "Começar meu treino", exact: true })
    .click()
  expect(await sessionCount(page)).toBe(1)
  await page
    .getByRole("button", { name: "Começar treino", exact: true })
    .click()
  await finish(page)
  await page.goto("/")
  await expect(page.locator(".next-workout")).toContainText("10 · Rotina 10")
})
