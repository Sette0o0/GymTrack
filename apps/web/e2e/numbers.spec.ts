import { test, expect } from "@playwright/test"
import { openExercise } from "./helpers"

test("campos numéricos recusam letras, validam intervalos e preservam decimais e campos vazios", async ({
  page,
  context,
}) => {
  await page.goto("/")
  await expect(
    page.getByText("Disponível offline", { exact: true })
  ).toBeVisible({ timeout: 30000 })
  await context.setOffline(true)
  await page.goto("/exercicios/")
  await page
    .getByRole("button", { name: "Novo exercício", exact: true })
    .click()
  await page
    .getByLabel("Nome do exercício", { exact: true })
    .fill("Agachamento com halteres")
  await page
    .getByRole("button", { name: "Salvar exercício", exact: true })
    .click()
  await page.goto("/treinos/?novo=1")
  await page.getByLabel("Código do treino", { exact: true }).fill("N")
  await page.getByLabel("Nome da ficha", { exact: true }).fill("Números")
  await page.getByLabel("Escolher do catálogo", { exact: true }).click()
  await page
    .getByRole("option", { name: "Agachamento com halteres", exact: true })
    .click()
  await page.getByRole("button", { name: "Adicionar", exact: true }).click()
  const min = page.getByLabel("Repetições mínimas", { exact: true })
  const max = page.getByLabel("Repetições máximas", { exact: true })
  await min.fill("15")
  await max.fill("12")
  await page.getByRole("button", { name: "Salvar ficha", exact: true }).click()
  await expect(
    page.getByText("As repetições mínimas não podem superar as máximas.", {
      exact: true,
    })
  ).toBeVisible()
  await max.fill("15")
  await page.getByRole("button", { name: "Salvar ficha", exact: true }).click()
  await page.getByRole("button", { name: "Iniciar", exact: true }).click()
  await openExercise(page, "Agachamento com halteres")
  const weight = page.getByLabel("Carga da série 1 (kg)", { exact: true })
  const reps = page.getByLabel("Repetições da série 1", { exact: true })
  await expect(weight).toHaveAttribute("role", "spinbutton")
  await expect(weight).toHaveAttribute("inputmode", "decimal")
  await expect(reps).toHaveAttribute("inputmode", "numeric")
  await expect(weight).toHaveValue("0")
  await weight.pressSequentially("abcEe+-")
  await expect(weight).toHaveValue("0")
  await weight.fill("57.1234567")
  await reps.focus()
  await expect(weight).toHaveValue("57,1234567")
  await weight.fill("1e3")
  await expect(weight).toHaveValue("57,1234567")
  for (const [type, text, expected] of [
    ["paste", "12kg", "57,1234567"],
    ["paste", "1.25", "1,25"],
    ["paste", "1,5", "1,5"],
    ["drop", "abc123", "1,5"],
    ["drop", "1.000,5", "1,5"],
  ]) {
    await weight.evaluate(
      (element, args) => {
        const input = element as HTMLInputElement
        input.setSelectionRange(0, input.value.length)
        const transfer = new DataTransfer()
        transfer.setData("text/plain", args.text!)
        input.dispatchEvent(
          args.type === "paste"
            ? new ClipboardEvent("paste", {
                bubbles: true,
                cancelable: true,
                clipboardData: transfer,
              })
            : new DragEvent("drop", {
                bubbles: true,
                cancelable: true,
                dataTransfer: transfer,
              })
        )
      },
      { type, text }
    )
    await expect(weight).toHaveValue(expected!)
  }
  await reps.fill("2.5")
  await expect(reps).toHaveValue("15")
  await reps.fill("0")
  await weight.focus()
  await expect(reps).toHaveValue("0")
  await expect(reps).toHaveAttribute("aria-invalid", "true")
  await reps.fill("9")
  await weight.fill("")
  await expect(weight).toHaveValue("")
  await expect(weight).toHaveAttribute("aria-invalid", "true")
  await page
    .getByRole("link", { name: "Voltar ao início", exact: true })
    .click()
  await expect(page).toHaveURL(/executar/)
  await weight.fill("0")
  await expect(
    page.getByText("Dados salvos neste dispositivo", { exact: true })
  ).toBeVisible()
  await page
    .getByRole("button", { name: "Concluir série 1", exact: true })
    .click()
  await expect(
    page.getByRole("button", { name: "Desfazer série 1", exact: true })
  ).toBeVisible()
})
