import { test, expect, type Page } from "@playwright/test"
import { readFile, writeFile, unlink } from "node:fs/promises"
import { execFileSync } from "node:child_process"
import writeExcelFile from "write-excel-file/node"

async function choose(page: Page, label: string, option: string) {
  await page.getByLabel(label, { exact: true }).click()
  await page.getByRole("option", { name: option, exact: true }).click()
}
async function ready(page: Page) {
  await page.goto("/")
  await expect(
    page.getByText("Disponível offline", { exact: true })
  ).toBeVisible({ timeout: 30000 })
}
async function saved(page: Page) {
  await expect(
    page.getByText("Dados salvos neste dispositivo", { exact: true })
  ).toBeVisible()
}
async function createExercise(page: Page, name: string, time = false) {
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
async function createWorkout(page: Page) {
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
async function start(page: Page) {
  await page.getByRole("button", { name: "Iniciar", exact: true }).click()
  await expect(page).toHaveURL(/executar\/\?id=/)
  await expect(
    page.getByLabel("Carga da série 1 (kg)", { exact: true })
  ).toBeVisible()
}
async function finish(page: Page) {
  await page
    .getByRole("button", { name: "Finalizar treino", exact: true })
    .click()
  await page.getByRole("button", { name: "Confirmar", exact: true }).click()
  await expect(page).toHaveURL(/historico\/\?id=/)
}

test("ficha, séries, recuperação, histórico e backup funcionam totalmente offline", async ({
  page,
  context,
  browser,
}, testInfo) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await ready(page)
  await context.setOffline(true)
  // None of these routes has been visited before the network is disabled.
  for (const route of [
    "/treinos/",
    "/exercicios/",
    "/executar/",
    "/historico/",
    "/importar/",
    "/configuracoes/",
  ]) {
    await page.goto(route)
    await expect(page.locator("h1,h2").first()).toBeVisible()
  }
  await createWorkout(page)
  await start(page)
  const sessionUrl = page.url()
  await page.getByLabel("Carga da série 1 (kg)", { exact: true }).fill("57,5")
  await page.getByLabel("Repetições da série 1", { exact: true }).fill("9")
  await saved(page)
  await page
    .getByRole("button", { name: "Concluir série 1", exact: true })
    .click()
  await page
    .getByLabel("Observação deste exercício nesta sessão", { exact: true })
    .fill("Aumentar na próxima")
  await page
    .getByLabel("Observação geral do treino", { exact: true })
    .fill("Bom treino")
  await saved(page)
  await page.reload()
  await expect(
    page.getByLabel("Carga da série 1 (kg)", { exact: true })
  ).toHaveValue("57,5")
  await expect(
    page.getByLabel("Observação geral do treino", { exact: true })
  ).toHaveValue("Bom treino")
  await page
    .getByRole("button", { name: "Adicionar série", exact: true })
    .click()
  await expect(
    page.getByLabel("Carga da série 3 (kg)", { exact: true })
  ).toBeVisible()
  await page.getByTitle("Remover série 3?", { exact: true }).click()
  await page.getByRole("button", { name: "Confirmar", exact: true }).click()
  await expect(
    page.getByLabel("Carga da série 3 (kg)", { exact: true })
  ).not.toBeVisible()
  await page.getByRole("button", { name: "Pausar treino", exact: true }).click()
  await expect(
    page.getByRole("button", { name: "Retomar treino", exact: true })
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole("button", { name: "Retomar treino", exact: true })
  ).toBeVisible()
  const other = await context.newPage()
  await other.goto("/treinos/")
  await expect(
    other.getByRole("button", { name: "Iniciar", exact: true })
  ).toBeDisabled()
  await other.close()
  await page
    .getByRole("button", { name: "Retomar treino", exact: true })
    .click()
  await page
    .getByRole("button", { name: "Próximo exercício", exact: true })
    .click()
  await page.getByRole("button", { name: "Cronometrar", exact: true }).click()
  await expect(page.getByRole("timer")).toBeVisible()
  await page.reload()
  await page
    .getByRole("button", { name: "Próximo exercício", exact: true })
    .click()
  await expect(
    page.getByRole("button", { name: "Parar", exact: true })
  ).toBeVisible()
  await page.getByRole("button", { name: "Parar", exact: true }).click()
  await page.getByLabel("Duração da série 1", { exact: true }).fill("00:45")
  await saved(page)
  await page
    .getByRole("button", { name: "Concluir série 1", exact: true })
    .click()
  await finish(page)
  await expect(page.getByText("57,5 kg", { exact: true })).toBeVisible()
  await expect(page.getByText("00:45", { exact: true })).toBeVisible()
  await expect(page.getByText("Ignorada", { exact: true })).toBeVisible()
  await expect(page.getByText("Bom treino", { exact: true })).toBeVisible()
  const historyUrl = page.url()
  // Editing and removing template exercises must not rewrite the session.
  await page.goto("/treinos/")
  await page.getByRole("button", { name: "Editar", exact: true }).click()
  await page.getByLabel("Nome da ficha", { exact: true }).fill("Ficha alterada")
  await page
    .getByRole("button", { name: "Remover exercício 1", exact: true })
    .click()
  await page.getByRole("button", { name: "Salvar ficha", exact: true }).click()
  await page.goto(historyUrl)
  await expect(
    page.getByRole("heading", { name: "A · Peito e abdômen", exact: true })
  ).toBeVisible()
  await expect(page.getByText("57,5 kg", { exact: true })).toBeVisible()
  await page.goto("/configuracoes/")
  await page.getByRole("button", { name: "Alternar tema", exact: true }).click()
  await expect(page.locator("html")).toHaveClass(/dark/)
  await saved(page)
  const downloadPromise = page.waitForEvent("download")
  await page
    .getByRole("button", { name: "Baixar backup completo", exact: true })
    .click()
  const download = await downloadPromise
  const backupPath = testInfo.outputPath("backup.json")
  await download.saveAs(backupPath)
  const value = JSON.parse(await readFile(backupPath, "utf8"))
  expect(value.workoutSessions).toHaveLength(1)
  expect(value.setRecords).toHaveLength(3)
  expect(value.settings).toContainEqual({ key: "theme", value: "dark" })
  const fresh = await browser.newContext({
    serviceWorkers: "allow",
    baseURL: "http://127.0.0.1:4173",
  })
  const restored = await fresh.newPage()
  await ready(restored)
  await fresh.setOffline(true)
  await restored.goto("/configuracoes/")
  await restored
    .getByLabel("Arquivo de backup (.json)", { exact: true })
    .setInputFiles(backupPath)
  await restored
    .getByRole("button", { name: "Restaurar dados", exact: true })
    .click()
  await restored.getByRole("button", { name: "Confirmar", exact: true }).click()
  await expect(
    restored.getByText(/Dados restaurados com sucesso/)
  ).toBeVisible()
  await expect(restored.locator("html")).toHaveClass(/dark/)
  await restored.goto(historyUrl)
  await expect(restored.getByText("57,5 kg", { exact: true })).toBeVisible()
  await expect(restored.getByText("Bom treino", { exact: true })).toBeVisible()
  await fresh.close()
  await page.goto(sessionUrl)
  await expect(
    page.getByRole("heading", { name: "Treino concluído", exact: true })
  ).toBeVisible()
  expect(errors).toEqual([])
})

test("Excel com múltiplas abas, exclusão de erro e exportação CSV offline", async ({
  page,
  context,
}) => {
  const file = await writeExcelFile([
    {
      sheet: "B",
      data: [
        ["Exercício", "Séries", "Repetições", "Carga"],
        ["Remada", 3, "8-12", "37,5"],
        [null, 0, "", -1],
      ],
    },
    {
      sheet: "C",
      data: [
        ["Exercício", "Séries", "Tempo"],
        ["Prancha", 2, "01:30"],
      ],
    },
    {
      sheet: "Treino revisado",
      data: [
        [
          "Treino",
          "Nome da ficha",
          "Exercício",
          "Séries",
          "Repetições",
          "Descanso (s)",
          "Observações",
        ],
        ["E", "Sábado", "Prancha", 2, "30–45 s", 45, "Core"],
      ],
    },
  ]).toBuffer()
  await ready(page)
  await context.setOffline(true)
  await page.goto("/importar/")
  await page
    .getByLabel("Planilha Excel (.xlsx)", { exact: true })
    .setInputFiles({
      name: "treinos.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: file,
    })
  await expect(
    page.getByRole("button", { name: "Confirmar importação", exact: true })
  ).toBeDisabled()
  await page
    .getByRole("checkbox", { name: "Incluir B linha 3", exact: true })
    .uncheck()
  await expect(
    page.getByText(
      "Duração “30–45 s” na coluna de repetições: usando o limite superior de 45 segundos.",
      { exact: true }
    )
  ).toBeVisible()
  await page
    .getByRole("button", { name: "Confirmar importação", exact: true })
    .click()
  await page.getByRole("button", { name: "Confirmar", exact: true }).click()
  await expect(
    page.getByText(/3 ficha\(s\) importada\(s\) com sucesso/)
  ).toBeVisible()
  await page.goto("/treinos/")
  await expect(
    page.getByRole("heading", { name: "Treino B", exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole("heading", { name: "Treino C", exact: true })
  ).toBeVisible()
  await page.goto("/configuracoes/")
  const downloadPromise = page.waitForEvent("download")
  await page
    .getByRole("button", { name: "Exportar fichas CSV", exact: true })
    .click()
  const download = await downloadPromise
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk))
  const csv = Buffer.concat(chunks).toString("utf8")
  expect(csv.startsWith("\ufeff")).toBe(true)
  expect(csv).not.toContain('"37,5"')
  expect(csv).not.toContain('"Carga kg"')
  expect(csv).toContain('"90"')
  expect(csv).toContain("Meta de duração importada: 30–45 s.")
  await page.goto("/treinos/")
  await page
    .locator(".panel")
    .filter({ has: page.getByRole("heading", { name: "Sábado", exact: true }) })
    .getByRole("button", { name: "Iniciar", exact: true })
    .click()
  await expect(
    page.getByLabel("Duração da série 1", { exact: true })
  ).toHaveValue("00:45")
  await expect(
    page.getByLabel("Carga da série 1 (kg)", { exact: true })
  ).toHaveCount(0)
  await expect(
    page.getByText(/Core\nMeta de duração importada: 30–45 s\./)
  ).toBeVisible()
})

test("valores inválidos e falha de armazenamento não são anunciados como salvos", async ({
  page,
}) => {
  await ready(page)
  await createWorkout(page)
  await start(page)
  await page.getByLabel("Carga da série 1 (kg)", { exact: true }).fill("-1")
  await expect(
    page.getByText("Existem alterações não salvas", { exact: true })
  ).toBeVisible()
  await page
    .getByRole("link", { name: "Voltar ao início", exact: true })
    .click()
  await expect(page).toHaveURL(/executar/)
  await page.getByLabel("Carga da série 1 (kg)", { exact: true }).fill("62,5")
  await saved(page)
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put
    Object.defineProperty(window, "failGymWrites", {
      value: true,
      writable: true,
      configurable: true,
    })
    IDBObjectStore.prototype.put = function (
      ...args: Parameters<IDBObjectStore["put"]>
    ) {
      if (
        (window as unknown as { failGymWrites: boolean }).failGymWrites &&
        this.name === "setRecords"
      )
        throw new DOMException(
          "Sem espaço no dispositivo",
          "QuotaExceededError"
        )
      return Reflect.apply(original, this, args)
    }
  })
  await page.getByLabel("Carga da série 1 (kg)", { exact: true }).fill("65")
  await expect(
    page.getByRole("button", { name: "Tentar salvar novamente", exact: true })
  ).toBeVisible()
  await expect(
    page.getByText("Existem alterações não salvas", { exact: true })
  ).toBeVisible()
  await page.evaluate(() => {
    ;(window as unknown as { failGymWrites: boolean }).failGymWrites = false
  })
  // A successful newer value replaces a failed older write for the same field.
  await page.getByLabel("Carga da série 1 (kg)", { exact: true }).fill("66")
  await saved(page)
  await expect(
    page.getByRole("button", { name: "Tentar salvar novamente", exact: true })
  ).not.toBeVisible()
  await page.evaluate(() => {
    ;(window as unknown as { failGymWrites: boolean }).failGymWrites = true
  })
  await page.getByLabel("Carga da série 1 (kg)", { exact: true }).fill("67")
  await expect(
    page.getByRole("button", { name: "Tentar salvar novamente", exact: true })
  ).toBeVisible()
  await page.evaluate(() => {
    ;(window as unknown as { failGymWrites: boolean }).failGymWrites = false
  })
  await page
    .getByRole("button", { name: "Tentar salvar novamente", exact: true })
    .click()
  await saved(page)
  await page.reload()
  await expect(
    page.getByLabel("Carga da série 1 (kg)", { exact: true })
  ).toHaveValue("67")
})

test("atualização de cache espera o fim do treino e preserva os registros", async ({
  page,
}) => {
  // Exercise two production revisions at the same origin without touching sources.
  const originalWorker = await readFile("out/sw.js")
  const originalAssets = await readFile("out/offline-assets.json")
  try {
    await ready(page)
    await createWorkout(page)
    await start(page)
    await page.getByLabel("Carga da série 1 (kg)", { exact: true }).fill("67,5")
    await saved(page)
    await page
      .getByRole("button", { name: "Concluir série 1", exact: true })
      .click()
    await writeFile(
      "out/pwa-test-release.json",
      JSON.stringify({ release: Date.now() })
    )
    execFileSync(process.execPath, ["scripts/build-sw.mjs"])
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration()
      await registration?.update()
    })
    await expect(
      page.getByRole("button", { name: /Atualização disponível/ })
    ).toBeDisabled({ timeout: 30000 })
    await finish(page)
    const url = page.url()
    await expect(
      page.getByRole("button", { name: /Atualização disponível/ })
    ).toBeEnabled()
    await Promise.all([
      page.waitForEvent("load"),
      page.getByRole("button", { name: /Atualização disponível/ }).click(),
    ])
    await expect(page.getByText("67,5 kg", { exact: true })).toBeVisible()
    await page.reload()
    await expect(page).toHaveURL(url)
    await expect(page.getByText("67,5 kg", { exact: true })).toBeVisible()
  } finally {
    await writeFile("out/sw.js", originalWorker)
    await writeFile("out/offline-assets.json", originalAssets)
    await unlink("out/pwa-test-release.json").catch(() => {})
  }
})
