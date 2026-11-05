import { test, expect } from "@playwright/test"
import writeExcelFile from "write-excel-file/node"
import { ready, start, finish, createWorkout, saved } from "./helpers"

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

test("exporta e importa CSVs de histórico e fichas em outro navegador offline", async ({
  page,
  context,
  browser,
}, testInfo) => {
  await ready(page)
  await context.setOffline(true)
  await createWorkout(page)
  await page.goto("/exercicios/")
  await page
    .getByRole("button", { name: "Editar Supino reto", exact: true })
    .click()
  await page
    .getByLabel("Agrupamento muscular (opcional)", { exact: true })
    .fill("Peito, tríceps")
  await page
    .getByRole("button", { name: "Salvar exercício", exact: true })
    .click()
  await saved(page)
  await page.goto("/treinos/")
  await start(page)
  await page.getByLabel("Carga da série 1 (kg)", { exact: true }).fill("57,5")
  await saved(page)
  await page
    .getByRole("button", { name: "Concluir série 1", exact: true })
    .click()
  await finish(page)
  const historyUrl = page.url()
  await page.goto("/configuracoes/")
  const paths: Record<string, string> = {}
  for (const kind of ["fichas", "histórico"]) {
    const pending = page.waitForEvent("download")
    await page
      .getByRole("button", { name: `Exportar ${kind} CSV`, exact: true })
      .click()
    const download = await pending
    const path = testInfo.outputPath(`${kind}.csv`)
    await download.saveAs(path)
    paths[kind] = path
  }
  const fresh = await browser.newContext({
    baseURL: "http://127.0.0.1:4173",
    serviceWorkers: "allow",
    viewport: { width: 390, height: 844 },
  })
  try {
    const restored = await fresh.newPage()
    await ready(restored)
    await fresh.setOffline(true)
    await restored.goto("/configuracoes/")
    // History may arrive first; the template reference is later filled by its CSV.
    for (const kind of ["histórico", "fichas"]) {
      await restored
        .getByLabel(`Arquivo de ${kind} (.csv)`, { exact: true })
        .setInputFiles(paths[kind]!)
      await expect(
        restored.getByRole("heading", {
          name: `Prévia do CSV de ${kind}`,
          exact: true,
        })
      ).toBeVisible()
      const overflow = await restored.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1
      )
      expect(overflow).toBe(false)
      await restored
        .getByRole("button", { name: `Importar ${kind} CSV`, exact: true })
        .click()
      await restored
        .getByRole("button", { name: "Confirmar", exact: true })
        .click()
      await expect(
        restored.getByText(new RegExp(`CSV de ${kind} importado com sucesso`))
      ).toBeVisible()
    }
    await restored
      .getByLabel("Arquivo de histórico (.csv)", { exact: true })
      .setInputFiles(paths["histórico"]!)
    await expect(
      restored.getByText("Nenhum registro novo para importar.", { exact: true })
    ).toBeVisible()
    await expect(
      restored.getByRole("button", {
        name: "Importar histórico CSV",
        exact: true,
      })
    ).toBeDisabled()
    await restored.goto(historyUrl)
    await expect(restored.getByText("57,5 kg", { exact: true })).toBeVisible()
    await expect(
      restored.getByText("Ignorada", { exact: true }).first()
    ).toBeVisible()
    await expect(
      restored.locator(".page-container > .muscle-groups")
    ).toContainText("Peito")
    await restored.goto("/treinos/")
    await expect(restored.locator(".workout-summary")).toHaveCount(1)
    await restored.locator(".workout-summary").click()
    await expect(
      restored.getByRole("button", { name: "Começar treino", exact: true })
    ).toBeEnabled()
  } finally {
    await fresh.close()
  }
})

test("CSV inválido apresenta erro e não libera importação", async ({
  page,
  context,
}) => {
  await ready(page)
  await context.setOffline(true)
  await page.goto("/configuracoes/")
  await page
    .getByLabel("Arquivo de fichas (.csv)", { exact: true })
    .setInputFiles({
      name: "inválido.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        "Treino;Nome da ficha;Exercício;Tipo;Séries;Repetições;Segundos;Observações\nA;Peito;Supino;Peso e repetições;letras;8-12;;"
      ),
    })
  await expect(page.locator(".csv-import").getByRole("alert")).toContainText(
    "Linha 2"
  )
  await expect(page.locator(".csv-import").getByRole("alert")).toContainText(
    "Séries"
  )
  await expect(
    page.getByRole("button", { name: "Importar fichas CSV", exact: true })
  ).toHaveCount(0)
  await page.goto("/treinos/")
  await expect(page.locator(".workout-summary")).toHaveCount(0)
})
