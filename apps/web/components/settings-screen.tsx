"use client"

import { useEffect, useState } from "react"
import {
  DatabaseBackup,
  Download,
  HardDrive,
  ShieldCheck,
  Smartphone,
  Upload,
} from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { useApp } from "./app-shell"
import {
  Choice,
  ConfirmAction,
  Field,
  formatDate,
  PageHeading,
} from "./ui-helpers"
import {
  downloadFile,
  exportBackup,
  historyCsv,
  restoreBackup,
  templatesCsv,
  validateBackup,
} from "@/services/backup"
import { snapshot } from "@/db/repository"
import { errorMessage, type Backup } from "@/lib/schema"

type InstallEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: string }>
}
export function SettingsScreen() {
  const { data, run, busy } = useApp()
  const [backup, setBackup] = useState<Backup | null>(null)
  const [mode, setMode] = useState<"merge" | "replace">("merge")
  const [confirmation, setConfirmation] = useState("")
  const [exported, setExported] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [storage, setStorage] = useState("Verificando armazenamento…")
  const [install, setInstall] = useState<InstallEvent | null>(null)
  useEffect(() => {
    if (navigator.storage?.persisted)
      void navigator.storage
        .persisted()
        .then((persisted) =>
          setStorage(
            persisted
              ? "Armazenamento persistente concedido."
              : "Armazenamento padrão do navegador. Mantenha backups atualizados."
          )
        )
        .catch(() => setStorage("Não foi possível verificar a persistência."))
    else
      void Promise.resolve().then(() =>
        setStorage(
          "Este navegador não informa a persistência. Mantenha seus backups."
        )
      )
    const handler = (event: Event) => {
      event.preventDefault()
      setInstall(event as InstallEvent)
    }
    window.addEventListener("beforeinstallprompt", handler)
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])
  if (!data) return null
  const pending = data.workoutSessions.some((row) => row.status !== "completed")
  const lastBackup = data.settings.find(
    (row) => row.key === "lastBackupAt"
  )?.value
  async function backupNow() {
    if (
      await run(async () => {
        await exportBackup()
        return true
      })
    ) {
      setExported(true)
      setNotice(
        "Backup gerado. Confira se o arquivo foi salvo em seus downloads."
      )
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="TUDO SOB SEU CONTROLE"
        title="Configurações e dados"
        description="Seus registros ficam neste dispositivo. Um backup permite levá-los para outro."
      />
      {notice && (
        <div className="success-banner" role="status">
          {notice}
        </div>
      )}
      {error && (
        <div role="alert" className="error-banner">
          {error}
        </div>
      )}
      <section className="panel">
        <h2 className="flex items-center gap-2">
          <DatabaseBackup size={20} />
          Backup e exportação
        </h2>
        <p className="subtle">
          {typeof lastBackup === "number"
            ? `Último backup gerado: ${formatDate(lastBackup)}.`
            : "Você ainda não gerou um backup neste dispositivo."}{" "}
          O JSON preserva fichas, séries, histórico e relacionamentos. Guarde
          uma cópia fora deste navegador.
        </p>
        <div className="restore-summary">
          <div>
            <strong>{data.workoutTemplates.length}</strong>
            <small>fichas</small>
          </div>
          <div>
            <strong>{data.exerciseDefinitions.length}</strong>
            <small>exercícios</small>
          </div>
          <div>
            <strong>{data.workoutSessions.length}</strong>
            <small>sessões</small>
          </div>
          <div>
            <strong>{data.setRecords.length}</strong>
            <small>séries</small>
          </div>
        </div>
        <div className="form-actions">
          <Button disabled={busy} onClick={backupNow}>
            <Download size={16} />
            Baixar backup completo
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              run(async () =>
                downloadFile(
                  "gymtrack-fichas.csv",
                  templatesCsv(await snapshot()),
                  "text/csv;charset=utf-8"
                )
              )
            }
          >
            Exportar fichas CSV
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              run(async () =>
                downloadFile(
                  "gymtrack-historico.csv",
                  historyCsv(await snapshot()),
                  "text/csv;charset=utf-8"
                )
              )
            }
          >
            Exportar histórico CSV
          </Button>
        </div>
      </section>
      <section className="panel">
        <h2 className="flex items-center gap-2">
          <Upload size={20} />
          Restaurar backup JSON
        </h2>
        <p className="subtle mb-5">
          Confira os dados antes de restaurar. Ao mesclar, registros locais com
          o mesmo ID são mantidos. Cronômetros importados ficam pausados no
          momento da exportação.
        </p>
        {pending && (
          <p className="success-banner">
            Encerre seu treino pendente antes de restaurar.{" "}
            <a className="underline" href="/executar/">
              Abrir treino
            </a>
          </p>
        )}
        <Field label="Arquivo de backup (.json)">
          {(id) => (
            <Input
              id={id}
              type="file"
              accept=".json,application/json"
              disabled={busy || pending}
              onChange={async (event) => {
                const file = event.target.files?.[0]
                setBackup(null)
                setError("")
                setNotice("")
                setConfirmation("")
                if (!file) return
                try {
                  if (file.size > 50 * 1024 * 1024)
                    throw new Error("Limite de 50 MB por backup.")
                  setBackup(validateBackup(JSON.parse(await file.text())))
                } catch (cause) {
                  setError(`Backup não aceito: ${errorMessage(cause)}`)
                }
              }}
            />
          )}
        </Field>
        {backup && (
          <div className="mt-6">
            <h3 className="font-semibold">
              Prévia · {formatDate(backup.exportedAt)}
            </h3>
            <div className="restore-summary">
              <div>
                <strong>{backup.workoutTemplates.length}</strong>
                <small>fichas</small>
              </div>
              <div>
                <strong>{backup.workoutSessions.length}</strong>
                <small>sessões</small>
              </div>
              <div>
                <strong>{backup.setRecords.length}</strong>
                <small>séries</small>
              </div>
            </div>
            <Field label="Como restaurar">
              {(id) => (
                <Choice
                  id={id}
                  value={mode}
                  onChange={(value) => setMode(value as "merge" | "replace")}
                  options={[
                    {
                      value: "merge",
                      label:
                        "Mesclar: manter registros locais e adicionar novos",
                    },
                    {
                      value: "replace",
                      label: "Substituir todos os dados locais pelo backup",
                    },
                  ]}
                />
              )}
            </Field>
            {mode === "replace" && !exported && (
              <div className="mt-4">
                <Field
                  label="Digite SUBSTITUIR para confirmar"
                  hint="Você também pode baixar um backup completo antes de substituir."
                >
                  {(id) => (
                    <Input
                      id={id}
                      value={confirmation}
                      onChange={(event) => setConfirmation(event.target.value)}
                      autoComplete="off"
                    />
                  )}
                </Field>
              </div>
            )}
            <div className="form-actions">
              <ConfirmAction
                label="Restaurar dados"
                destructive={mode === "replace"}
                title={
                  mode === "replace"
                    ? "Substituir todos os dados deste dispositivo?"
                    : "Mesclar os registros do backup?"
                }
                description={
                  mode === "replace"
                    ? "As fichas e os registros locais serão substituídos pelo conteúdo validado do arquivo. Esta ação só pode ser revertida com outro backup."
                    : "Registros locais com IDs existentes serão preservados. Códigos duplicados e conflitos de sessões pendentes impedirão a operação inteira."
                }
                disabled={
                  busy ||
                  pending ||
                  (mode === "replace" &&
                    !exported &&
                    confirmation !== "SUBSTITUIR")
                }
                onConfirm={async () => {
                  if (
                    await run(async () => {
                      await restoreBackup(backup, mode)
                      return true
                    })
                  ) {
                    setBackup(null)
                    setNotice(
                      "Dados restaurados com sucesso. Suas fichas e histórico já estão disponíveis."
                    )
                  }
                }}
              />
            </div>
          </div>
        )}
      </section>
      <section className="panel">
        <h2 className="flex items-center gap-2">
          <HardDrive size={20} />
          Proteção do armazenamento
        </h2>
        <p className="subtle">{storage}</p>
        <p className="subtle mt-2">
          Limpar os dados do navegador, remover o aplicativo ou mudar de domínio
          pode impedir o acesso aos registros. O armazenamento persistente
          depende da aprovação do navegador e não substitui um backup.
        </p>
        <div className="form-actions">
          <Button
            variant="outline"
            onClick={async () => {
              try {
                const result = await navigator.storage?.persist?.()
                setStorage(
                  result
                    ? "Armazenamento persistente concedido."
                    : "O navegador não concedeu persistência. Seus dados continuam locais; mantenha backups."
                )
              } catch {
                setStorage(
                  "Não foi possível solicitar persistência neste navegador."
                )
              }
            }}
          >
            <ShieldCheck size={16} />
            Solicitar armazenamento persistente
          </Button>
        </div>
      </section>
      <section className="panel">
        <h2 className="flex items-center gap-2">
          <Smartphone size={20} />
          Instalar no celular
        </h2>
        <ol className="help-list">
          <li>
            Abra o aplicativo online pelo domínio que você usará diariamente.
          </li>
          <li>
            No Android, escolha “Instalar aplicativo” no menu do Chrome. No
            iPhone, use “Compartilhar” e “Adicionar à Tela de Início” no Safari.
          </li>
          <li>
            Aguarde a indicação “Disponível offline” e teste abrir novamente em
            modo avião.
          </li>
        </ol>
        {install && (
          <div className="form-actions">
            <Button
              onClick={async () => {
                await install.prompt()
                await install.userChoice
                setInstall(null)
              }}
            >
              Instalar GymTrack
            </Button>
          </div>
        )}
        <p className="subtle mt-4">
          Atualizações aparecem no topo quando houver internet e só podem ser
          aplicadas com o treino encerrado. O app funciona sem conta e sem
          enviar seus registros a um servidor.
        </p>
      </section>
    </>
  )
}
