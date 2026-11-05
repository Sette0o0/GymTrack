"use client"

import { useRef, useState } from "react"
import { Input } from "@workspace/ui/components/input"
import { useApp } from "./app-shell"
import { ConfirmAction, Field } from "./ui-helpers"
import {
  previewCsvImport,
  importCsv,
  type CsvKind,
  type CsvPreview,
} from "@/services/csv-import"
import { errorMessage } from "@/lib/schema"

export function CsvImport({ kind }: { kind: CsvKind }) {
  const { data, run, busy } = useApp()
  const [text, setText] = useState("")
  const [preview, setPreview] = useState<CsvPreview | null>(null)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [filename, setFilename] = useState("")
  const [loading, setLoading] = useState(false)
  const request = useRef(0)
  if (!data) return null
  const pending = data.workoutSessions.some((row) => row.status !== "completed")
  const label = kind === "templates" ? "fichas" : "histórico"
  return (
    <section className="panel csv-import">
      <h2>Importar {label} CSV</h2>
      <p className="subtle mb-4">
        Escolha o arquivo exportado nas configurações. A leitura acontece neste
        dispositivo. Registros existentes serão preservados; fichas vazias podem
        ser preenchidas pelo CSV de fichas.
      </p>
      {pending && (
        <p className="success-banner">
          Finalize ou cancele o treino pendente antes de importar.{" "}
          <a className="underline" href="/executar/">
            Abrir treino
          </a>
        </p>
      )}
      <Field label={`Arquivo de ${label} (.csv)`}>
        {(id) => (
          <Input
            id={id}
            type="file"
            accept=".csv,text/csv"
            disabled={busy || pending || loading}
            onChange={async (event) => {
              const input = event.currentTarget
              const file = event.target.files?.[0]
              const token = ++request.current
              setPreview(null)
              setText("")
              setError("")
              setNotice("")
              setFilename(file?.name ?? "")
              if (!file) return
              setLoading(true)
              try {
                if (!file.name.toLocaleLowerCase().endsWith(".csv"))
                  throw new Error("Escolha um arquivo .csv.")
                if (file.size > 50 * 1024 * 1024)
                  throw new Error("Limite de 50 MB por CSV.")
                const content = await file.text()
                const next = previewCsvImport(content, kind, data)
                if (token === request.current) {
                  setText(content)
                  setPreview(next)
                }
              } catch (cause) {
                if (token === request.current) setError(errorMessage(cause))
              } finally {
                input.value = ""
                if (token === request.current) setLoading(false)
              }
            }}
          />
        )}
      </Field>
      {filename && (
        <p className="subtle mt-3">Arquivo selecionado: {filename}</p>
      )}
      {loading && (
        <p role="status" className="subtle mt-4">
          Lendo e validando CSV…
        </p>
      )}
      {error && (
        <p role="alert" className="error-banner mt-4">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="success-banner mt-4">
          {notice}
        </p>
      )}
      {preview && (
        <div className="mt-5">
          <h3 className="font-semibold">Prévia do CSV de {label}</h3>
          <p className="subtle">
            {preview.addedTemplates} fichas novas · {preview.filledTemplates}{" "}
            fichas vazias a preencher · {preview.addedSessions} sessões novas ·{" "}
            {preview.addedSets} séries novas · {preview.skipped} registros
            existentes ignorados.
          </p>
          {preview.warnings.map((warning) => (
            <p className="subtle mt-2" key={warning}>
              {warning}
            </p>
          ))}
          <ul className="csv-preview-list">
            {preview.items.slice(0, 20).map((item, index) => (
              <li key={index}>
                <strong>{item.name}</strong>
                <span>{item.detail}</span>
              </li>
            ))}
          </ul>
          {preview.items.length > 20 && (
            <p className="subtle">
              Exibindo 20 de {preview.items.length} registros. Todos serão
              importados.
            </p>
          )}
          {!preview.items.length && (
            <p className="subtle mt-3">Nenhum registro novo para importar.</p>
          )}
          <div className="form-actions">
            <ConfirmAction
              label={`Importar ${label} CSV`}
              title={`Importar ${label} do CSV?`}
              description="Os registros novos serão acrescentados em uma única operação. Fichas existentes com exercícios e sessões com o mesmo ID serão preservadas. Fichas vazias podem ser preenchidas. Se houver um erro ou conflito, nenhuma alteração será salva."
              disabled={busy || pending || loading || !preview.items.length}
              onConfirm={async () => {
                const result = await run(() => importCsv(text, kind))
                if (!result) return false
                setNotice(
                  `CSV de ${label} importado com sucesso: ${result.items.length} registros processados; ${result.skipped} existentes preservados.`
                )
                setPreview(null)
                setText("")
                return true
              }}
            />
          </div>
        </div>
      )}
    </section>
  )
}
