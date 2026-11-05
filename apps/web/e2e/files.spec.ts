import { test, expect } from "@playwright/test"
import writeExcelFile from "write-excel-file/node"
import { ready, start, finish } from "./helpers"

test("importa agrupamentos e mostra todos os grupos da ficha e da sessão offline", async ({
  page,
  context,
}) => {
  await ready(page)
  await context.setOffline(true)
  const file = await writeExcelFile([
    {
      sheet: "A",
      data: [
        ["Exercício", "Séries", "Repetições", "Agrupamento muscular"],
        ["Supino reto", 2, "8-12", "Peito, tríceps"],
        ["Prancha", 1, "30–45 s", "Core"],
      ],
    },
  ]).toBuffer()
  await page.goto("/importar/")
  await page
    .getByLabel("Planilha Excel (.xlsx)", { exact: true })
    .setInputFiles({
      name: "grupos.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: file,
    })
  await expect(
    page.getByLabel("Agrupamento muscular · A", { exact: true })
  ).toContainText("Agrupamento muscular")
  await page
    .getByRole("button", { name: "Confirmar importação", exact: true })
    .click()
  await page.getByRole("button", { name: "Confirmar", exact: true }).click()
  await expect(
    page.getByText(/1 ficha\(s\) importada\(s\) com sucesso\./)
  ).toBeVisible()
  await page.goto("/treinos/")
  const groups = page.locator(".workout-list-card .muscle-groups")
  await expect(groups).toContainText("Peito")
  await expect(groups).toContainText("tríceps")
  await expect(groups).toContainText("Core")
  await start(page)
  await expect(page.locator(".page-container > .muscle-groups")).toContainText(
    "Core"
  )
  await finish(page)
  await expect(page.locator(".page-container > .muscle-groups")).toContainText(
    "Peito"
  )
})
