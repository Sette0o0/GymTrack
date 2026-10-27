import { test, expect, type Page } from "@playwright/test"
import writeExcelFile from "write-excel-file/node"
import {
  ready,
  createWorkout,
  start,
  finish,
  openExercise,
  exerciseCard,
  saved,
} from "./helpers"

async function layout(page: Page, context: string) {
  const issues = await page.evaluate(() => {
    const problems: string[] = []
    if (document.documentElement.scrollWidth > innerWidth + 1)
      problems.push(
        `Página com ${document.documentElement.scrollWidth}px para viewport ${innerWidth}px`
      )
    for (const panel of document.querySelectorAll<HTMLElement>(
      '[data-slot="accordion-content"]'
    )) {
      if (
        panel.getBoundingClientRect().height &&
        panel.scrollHeight > panel.clientHeight + 1
      )
        problems.push("Conteúdo do exercício cortado pelo card")
    }
    for (const element of document.querySelectorAll<HTMLElement>(
      'button, a[href], input:not([type="hidden"]), textarea, [role="option"]'
    )) {
      if (element.closest('[aria-hidden="true"]')) continue
      const style = getComputedStyle(element)
      const box = element.getBoundingClientRect()
      if (
        !box.width ||
        !box.height ||
        style.visibility === "hidden" ||
        style.display === "none"
      )
        continue
      const target = element.matches('input[type="checkbox"]')
        ? (element.closest("label") ?? element)
        : element
      const area = target.getBoundingClientRect()
      const name =
        element.getAttribute("aria-label") ??
        element.textContent?.trim().slice(0, 60) ??
        element.tagName
      if (area.width < 43.5 || area.height < 43.5)
        problems.push(
          `Alvo pequeno: ${name} (${Math.round(area.width)}×${Math.round(area.height)})`
        )
      if (
        element.matches('input:not([type="checkbox"]),textarea') &&
        parseFloat(style.fontSize) < 16
      )
        problems.push(`Input menor que 16px: ${name}`)
    }
    return problems
  })
  expect(issues, context).toEqual([])
}

test.use({ actionTimeout: 15000 })
test("telas sem overflow com alvos de toque, nomes completos, foco e temas nas larguras mobile", async ({
  page,
  context,
}, testInfo) => {
  test.setTimeout(180000)
  await ready(page)
  await context.setOffline(true)
  await createWorkout(page)
  await page.goto("/exercicios/")
  await page
    .locator(".catalog-row")
    .filter({
      has: page.getByRole("heading", { name: "Supino reto", exact: true }),
    })
    .getByRole("button", { name: "Editar Supino reto", exact: true })
    .click()
  const longName =
    "Supino reto inclinado com halteres e pegada neutra para execução controlada"
  await page.getByLabel("Nome do exercício", { exact: true }).fill(longName)
  await page
    .getByRole("button", { name: "Salvar exercício", exact: true })
    .click()
  await page.goto("/treinos/")
  await start(page)
  await page
    .getByRole("button", { name: "Concluir série 1", exact: true })
    .click()
  await finish(page)
  const historyUrl = page.url()
  await page.goto("/treinos/")
  await start(page, false)
  const sessionUrl = page.url()
  const file = await writeExcelFile([
    {
      sheet: "Treino de exemplo",
      data: [
        ["Exercício", "Séries", "Repetições", "Observações"],
        [
          longName,
          3,
          "8–12",
          "Respeitar a amplitude e manter o movimento controlado",
        ],
      ],
    },
  ]).toBuffer()
  const screens = [
    "/",
    "/treinos/",
    "editor",
    "/exercicios/",
    sessionUrl,
    "/historico/",
    historyUrl,
    "/importar/",
    "/configuracoes/",
  ]
  for (const [width, height] of [
    [320, 760],
    [360, 800],
    [390, 844],
    [430, 932],
    [844, 390],
    [1280, 900],
  ]) {
    await page.setViewportSize({ width: width!, height: height! })
    for (const route of screens) {
      await page.goto(route === "editor" ? "/treinos/" : route)
      await expect(
        page.getByText("Dados salvos neste dispositivo", { exact: true })
      ).toBeVisible()
      if (route === "editor")
        await page.getByRole("button", { name: "Editar", exact: true }).click()
      if (route === "/importar/") {
        await page
          .getByLabel("Planilha Excel (.xlsx)", { exact: true })
          .setInputFiles({
            name: "mobile.xlsx",
            mimeType:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            buffer: file,
          })
        await expect(
          page.getByRole("heading", { name: "2. Abas e colunas", exact: true })
        ).toBeVisible()
      }
      if (route === sessionUrl) {
        await openExercise(page, "Supino reto")
        await expect(
          page.locator(".exercise-card-name").filter({ hasText: longName })
        ).toHaveText(longName)
        await layout(page, `${width}px execução por peso`)
        await page.screenshot({
          path: testInfo.outputPath(`execucao-${width}.png`),
          fullPage: true,
        })
        await openExercise(page, "Prancha")
      }
      await layout(page, `${width}px ${route}`)
    }
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(sessionUrl)
  const trigger = exerciseCard(page, "Supino reto")
  await trigger.focus()
  await page.keyboard.press("Enter")
  await expect(trigger).toHaveAttribute("aria-expanded", "true")
  await page.keyboard.press("Tab")
  const input = page.getByLabel("Carga da série 1 (kg)", { exact: true })
  await expect(input).toBeFocused()
  const inputBox = await input.boundingBox()
  const navBox = await page
    .getByRole("navigation", { name: "Navegação móvel", exact: true })
    .boundingBox()
  expect(inputBox!.y + inputBox!.height).toBeLessThanOrEqual(navBox!.y)
  // Resizing with an input focused exercises the keyboard viewport fallback.
  await page.setViewportSize({ width: 390, height: 400 })
  await expect(page.locator("html")).toHaveAttribute("data-keyboard-open", "")
  await expect(
    page.getByRole("navigation", { name: "Navegação móvel", exact: true })
  ).not.toBeVisible()
  await input.blur()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(
    page.getByRole("navigation", { name: "Navegação móvel", exact: true })
  ).toBeVisible()
  await page.getByRole("button", { name: "Alternar tema", exact: true }).click()
  await saved(page)
  await expect(page.locator("html")).toHaveClass(/dark/)
  for (const route of screens) {
    await page.goto(route === "editor" ? "/treinos/" : route)
    if (route === "editor")
      await page.getByRole("button", { name: "Editar", exact: true }).click()
    if (route === sessionUrl) await openExercise(page, "Supino reto")
    if (route === "/importar/") {
      await page
        .getByLabel("Planilha Excel (.xlsx)", { exact: true })
        .setInputFiles({
          name: "mobile.xlsx",
          mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          buffer: file,
        })
      await expect(
        page.getByRole("heading", { name: "2. Abas e colunas", exact: true })
      ).toBeVisible()
    }
    await layout(page, `390px escuro ${route}`)
    await page.screenshot({
      path: testInfo.outputPath(`escuro-${screens.indexOf(route)}.png`),
      fullPage: true,
    })
  }
})
