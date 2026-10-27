"use client"

import { useMemo, useState } from "react"
import readExcelFile from "read-excel-file/browser"
import { FileSpreadsheet, Upload } from "lucide-react"
import { Input } from "@workspace/ui/components/input"
import { NumberInput } from "@workspace/ui/components/number-input"
import { numericValue } from "@workspace/ui/lib/numeric"
import { useApp } from "./app-shell"
import {
  Choice,
  ConfirmAction,
  Field,
  PageHeading,
  TextLink,
} from "./ui-helpers"
import {
  guessMapping,
  importFields,
  importRows,
  previewImport,
  type ImportField,
  type ImportPolicy,
  type SheetInput,
} from "@/services/import"
import { errorMessage } from "@/lib/schema"
import { targetLabel } from "./workouts-screen"

export function ImportScreen() {
  const { data, run, busy } = useApp()
  const [sheets, setSheets] = useState<SheetInput[]>([])
  const [policies, setPolicies] = useState<Record<string, ImportPolicy>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [filename, setFilename] = useState("")
  const [headerDrafts, setHeaderDrafts] = useState<Record<string, string>>({})
  function validHeader(sheet: SheetInput) {
    const value = numericValue(
      headerDrafts[sheet.sheet] ?? String(sheet.headerRow),
      true
    )
    return (
      value !== null && value >= 1 && value <= Math.max(1, sheet.data.length)
    )
  }
  const rows = useMemo(() => previewImport(sheets), [sheets])
  if (!data) return null
  const included = rows.filter((row) => !row.excluded)
  const invalid =
    sheets.some((sheet) => sheet.selected && !validHeader(sheet)) ||
    included.some((row) => row.errors.length)
  const codes = [
    ...new Set(included.map((row) => row.code.toLocaleLowerCase())),
  ]
  const duplicates = data.workoutTemplates.filter((row) =>
    codes.includes(row.code.toLocaleLowerCase())
  )
  function update(name: string, patch: Partial<SheetInput>) {
    setSheets((previous) =>
      previous.map((sheet) =>
        sheet.sheet === name ? { ...sheet, ...patch } : sheet
      )
    )
    setSuccess("")
  }
  return (
    <>
      <PageHeading
        eyebrow="DA PLANILHA PARA O TREINO"
        title="Importar do Excel"
        description="Escolha as abas, combine as colunas e confira tudo antes de salvar."
        action={<TextLink href="/treinos/">Minhas fichas</TextLink>}
      />
      <section className="panel">
        <h2 className="flex items-center gap-2">
          <FileSpreadsheet size={21} />
          1. Escolha sua planilha
        </h2>
        <p className="subtle mb-4">
          Arquivos .xlsx com uma linha por exercício e metas gerais para suas
          séries. A leitura acontece somente neste dispositivo.
        </p>
        <div className="upload-area">
          <Field label="Planilha Excel (.xlsx)">
            {(id) => (
              <Input
                id={id}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                disabled={loading || busy}
                onChange={async (event) => {
                  const file = event.target.files?.[0]
                  if (!file) return
                  setLoading(true)
                  setError("")
                  setSuccess("")
                  setSheets([])
                  setPolicies({})
                  setHeaderDrafts({})
                  setFilename(file.name)
                  try {
                    if (!file.name.toLocaleLowerCase().endsWith(".xlsx"))
                      throw new Error("Escolha uma planilha no formato .xlsx.")
                    if (file.size > 20 * 1024 * 1024)
                      throw new Error("Limite de 20 MB por arquivo.")
                    const workbook = await readExcelFile(file)
                    setSheets(
                      workbook.map((sheet) => ({
                        ...sheet,
                        selected: true,
                        headerRow: 1,
                        mapping: guessMapping(sheet.data[0] ?? []),
                        durationUnit: "seconds",
                        excluded: [],
                      }))
                    )
                  } catch (cause) {
                    setError(
                      `Não foi possível ler a planilha. ${errorMessage(cause)}`
                    )
                  } finally {
                    setLoading(false)
                  }
                }}
              />
            )}
          </Field>
        </div>
        {loading && (
          <p className="subtle mt-3" role="status">
            Lendo abas e colunas…
          </p>
        )}
      </section>
      {error && (
        <p className="error-banner" role="alert">
          {error}
        </p>
      )}
      {success && (
        <div className="success-banner" role="status">
          {success}{" "}
          <a className="underline" href="/treinos/">
            Ver fichas
          </a>
        </div>
      )}
      {sheets.length > 0 && (
        <>
          <section className="panel">
            <h2>2. Abas e colunas</h2>
            <p className="subtle">
              {filename} · Campos não mapeados serão ignorados. Sem a coluna de
              treino, o nome da aba será o código. Sem tipo, uma duração ou
              valores como “30–45 s” em repetições indicam exercício por tempo.
              Intervalos de duração usam o limite superior e ficam preservados
              nas observações. Colunas de carga são ignoradas.
            </p>
            {sheets.map((sheet) => (
              <section className="sheet-panel" key={sheet.sheet}>
                <label className="sheet-toggle">
                  <input
                    type="checkbox"
                    checked={sheet.selected}
                    onChange={(event) =>
                      update(sheet.sheet, { selected: event.target.checked })
                    }
                  />
                  {sheet.sheet}
                </label>
                {sheet.selected && (
                  <>
                    <div className="form-grid">
                      <Field label={`Linha do cabeçalho · ${sheet.sheet}`}>
                        {(id) => (
                          <NumberInput
                            id={id}
                            integer
                            required
                            min={1}
                            max={Math.max(1, sheet.data.length)}
                            value={
                              headerDrafts[sheet.sheet] ??
                              String(sheet.headerRow)
                            }
                            aria-invalid={!validHeader(sheet)}
                            onValueChange={(value) => {
                              setHeaderDrafts((previous) => ({
                                ...previous,
                                [sheet.sheet]: value,
                              }))
                              const headerRow = Number(value)
                              if (
                                !value ||
                                !Number.isInteger(headerRow) ||
                                headerRow < 1 ||
                                headerRow > sheet.data.length
                              )
                                return
                              update(sheet.sheet, {
                                headerRow,
                                mapping: guessMapping(
                                  sheet.data[headerRow - 1] ?? []
                                ),
                                excluded: [],
                              })
                            }}
                          />
                        )}
                      </Field>
                      {!validHeader(sheet) && (
                        <p className="invalid-hint" role="alert">
                          Informe uma linha de cabeçalho entre 1 e{" "}
                          {Math.max(1, sheet.data.length)}.
                        </p>
                      )}
                      <Field label={`Unidade da duração · ${sheet.sheet}`}>
                        {(id) => (
                          <Choice
                            id={id}
                            value={sheet.durationUnit}
                            options={[
                              {
                                value: "seconds",
                                label: "Segundos (ou texto mm:ss)",
                              },
                              {
                                value: "minutes",
                                label: "Minutos (ou texto mm:ss)",
                              },
                            ]}
                            onChange={(value) =>
                              update(sheet.sheet, {
                                durationUnit:
                                  value as SheetInput["durationUnit"],
                              })
                            }
                          />
                        )}
                      </Field>
                    </div>
                    <div className="mapping-grid">
                      {Object.entries(importFields).map(([key, label]) => (
                        <Field key={key} label={`${label} · ${sheet.sheet}`}>
                          {(id) => (
                            <Choice
                              id={id}
                              value={
                                sheet.mapping[key as ImportField] === undefined
                                  ? "none"
                                  : String(sheet.mapping[key as ImportField])
                              }
                              options={[
                                {
                                  value: "none",
                                  label:
                                    key === "code"
                                      ? "Usar nome da aba"
                                      : "Não mapear",
                                },
                                ...(sheet.data[sheet.headerRow - 1] ?? []).map(
                                  (cell, index) => ({
                                    value: String(index),
                                    label: `${index + 1}. ${String(cell ?? "Sem título")}`,
                                  })
                                ),
                              ]}
                              onChange={(value) =>
                                update(sheet.sheet, {
                                  mapping: {
                                    ...sheet.mapping,
                                    [key]:
                                      value === "none"
                                        ? undefined
                                        : Number(value),
                                  },
                                })
                              }
                            />
                          )}
                        </Field>
                      ))}
                    </div>
                  </>
                )}
              </section>
            ))}
          </section>
          <section className="panel">
            <h2>3. Confira a prévia</h2>
            <p className="subtle mb-4">
              {included.length} exercícios em {codes.length} fichas. Linhas
              inválidas devem ser corrigidas no mapeamento ou excluídas
              explicitamente abaixo.
            </p>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Incluir</th>
                    <th>Aba / linha</th>
                    <th>Ficha</th>
                    <th>Exercício</th>
                    <th>Metas / validação</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.key}
                      style={{ opacity: row.excluded ? 0.5 : 1 }}
                    >
                      <td>
                        <label className="checkbox-target">
                          <input
                            type="checkbox"
                            aria-label={`Incluir ${row.sheet} linha ${row.row}`}
                            checked={!row.excluded}
                            onChange={(event) => {
                              const sheet = sheets.find(
                                (item) => item.sheet === row.sheet
                              )!
                              update(row.sheet, {
                                excluded: event.target.checked
                                  ? sheet.excluded.filter(
                                      (line) => line !== row.row
                                    )
                                  : [...sheet.excluded, row.row],
                              })
                            }}
                          />
                        </label>
                      </td>
                      <td>
                        {row.sheet} / {row.row}
                      </td>
                      <td>{row.code}</td>
                      <td>{row.exercise || "—"}</td>
                      <td>
                        {row.errors.length ? (
                          <span className="sheet-errors">
                            {row.errors.join("; ")}
                          </span>
                        ) : (
                          <>
                            {row.targets && targetLabel(row.targets)}
                            {row.durationHint && (
                              <p className="subtle mt-1">{row.durationHint}</p>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!rows.length && (
              <p className="subtle mt-4">
                Nenhuma linha encontrada nas abas selecionadas.
              </p>
            )}
            {duplicates.map((template) => (
              <div className="mt-5" key={template.id}>
                <Field label={`Ficha ${template.code} já existe`}>
                  {(id) => (
                    <Choice
                      id={id}
                      value={
                        policies[template.code.toLocaleLowerCase()] ?? "none"
                      }
                      options={[
                        { value: "none", label: "Escolha uma ação" },
                        { value: "skip", label: "Ignorar esta ficha" },
                        {
                          value: "update",
                          label:
                            "Atualizar exercícios da ficha (preservar histórico)",
                        },
                        {
                          value: "new",
                          label: "Criar outra ficha com novo código",
                        },
                      ]}
                      onChange={(value) =>
                        setPolicies((previous) => ({
                          ...previous,
                          [template.code.toLocaleLowerCase()]:
                            value as ImportPolicy,
                        }))
                      }
                    />
                  )}
                </Field>
              </div>
            ))}
            <div className="form-actions">
              <ConfirmAction
                label={
                  <>
                    <Upload size={16} />
                    Confirmar importação
                  </>
                }
                title="Importar as fichas conferidas?"
                description={`${included.length} exercícios serão processados em ${codes.length} fichas, usando as opções escolhidas para duplicações. O histórico permanece preservado.`}
                disabled={
                  busy ||
                  !included.length ||
                  invalid ||
                  duplicates.some(
                    (row) =>
                      !["skip", "update", "new"].includes(
                        policies[row.code.toLocaleLowerCase()] ?? ""
                      )
                  )
                }
                onConfirm={async () => {
                  const count = await run(() => importRows(rows, policies))
                  if (count !== undefined) {
                    setSuccess(`${count} ficha(s) importada(s) com sucesso.`)
                    setSheets([])
                  }
                }}
              />
              {invalid && (
                <span className="invalid-hint">
                  Confira os cabeçalhos e as linhas inválidas selecionadas.
                </span>
              )}
            </div>
          </section>
        </>
      )}
    </>
  )
}
