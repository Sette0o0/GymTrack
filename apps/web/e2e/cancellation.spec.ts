import { test, expect } from "@playwright/test"
import { ready, createWorkout, start, saved } from "./helpers"

test("cancelamento confirmado descarta séries concluídas e campos inválidos offline", async ({
  page,
  context,
}) => {
  await ready(page)
  await context.setOffline(true)
  await createWorkout(page)
  await start(page)
  const url = page.url()
  await page
    .getByRole("button", { name: "Concluir série 1", exact: true })
    .click()
  await saved(page)
  await page.getByLabel("Carga da série 2 (kg)", { exact: true }).fill("")
  await page.getByTitle("Cancelar este treino?", { exact: true }).click()
  await expect(page.getByRole("dialog")).toContainText(
    "1 série concluída será descartada"
  )
  await page
    .getByRole("button", { name: "Continuar treinando", exact: true })
    .click()
  await expect(page).toHaveURL(url)
  await expect(
    page.getByRole("button", { name: "Desfazer série 1", exact: true })
  ).toBeVisible()
  await page.getByTitle("Cancelar este treino?", { exact: true }).click()
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancelar treino", exact: true })
    .click()
  await expect(page).toHaveURL(/\?cancelado=1/)
  await expect(
    page.getByRole("status").filter({ hasText: "Treino cancelado." })
  ).toBeVisible()
  await saved(page)
  await expect(page.locator(".next-workout")).toContainText(
    "A · Peito e abdômen"
  )
  await expect(
    page.getByRole("link", { name: "Retomar treino", exact: true })
  ).toHaveCount(0)
  await page.goto(url)
  await expect(
    page.getByRole("heading", {
      name: "Nenhum treino em andamento",
      exact: true,
    })
  ).toBeVisible()
  await page.goto("/treinos/")
  await start(page)
  await page.getByRole("button", { name: "Pausar treino", exact: true }).click()
  await saved(page)
  await page.getByTitle("Cancelar este treino?", { exact: true }).click()
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancelar treino", exact: true })
    .click()
  await expect(page).toHaveURL(/\?cancelado=1/)
})

test("falha ao cancelar preserva sessão e permite tentar novamente com gravação não resolvida", async ({
  page,
  context,
}) => {
  await ready(page)
  await context.setOffline(true)
  await createWorkout(page)
  await start(page)
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (
      ...args: Parameters<IDBObjectStore["put"]>
    ) {
      if (this.name === "setRecords")
        throw new DOMException("Falha de gravação", "QuotaExceededError")
      return Reflect.apply(put, this, args)
    }
    const remove = IDBObjectStore.prototype.delete
    Object.defineProperty(window, "allowGymDelete", {
      value: false,
      writable: true,
    })
    IDBObjectStore.prototype.delete = function (
      ...args: Parameters<IDBObjectStore["delete"]>
    ) {
      if (
        this.name === "workoutSessions" &&
        !(window as unknown as { allowGymDelete: boolean }).allowGymDelete
      )
        throw new DOMException("Falha de exclusão", "QuotaExceededError")
      return Reflect.apply(remove, this, args)
    }
  })
  await page.getByLabel("Carga da série 1 (kg)", { exact: true }).fill("67")
  await expect(
    page.getByRole("button", { name: "Tentar salvar novamente", exact: true })
  ).toBeVisible()
  const url = page.url()
  await page.getByTitle("Cancelar este treino?", { exact: true }).click()
  const confirm = page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancelar treino", exact: true })
  await confirm.click()
  await expect(page.getByRole("alert")).toContainText(
    "Seus dados foram preservados"
  )
  await expect(page).toHaveURL(url)
  await expect(confirm).toBeEnabled()
  await page.evaluate(() => {
    ;(window as unknown as { allowGymDelete: boolean }).allowGymDelete = true
  })
  await confirm.click()
  await expect(page).toHaveURL(/\?cancelado=1/)
  await saved(page)
  await expect(
    page.getByRole("button", { name: "Tentar salvar novamente", exact: true })
  ).toHaveCount(0)
})
