"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react"
import { usePathname } from "next/navigation"
import { useLiveQuery } from "dexie-react-hooks"
import { useTheme } from "next-themes"
import {
  Activity,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleAlert,
  CloudOff,
  Download,
  Dumbbell,
  History,
  House,
  ListChecks,
  Moon,
  Settings,
  Sun,
  WifiOff,
} from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { snapshot } from "@/db/repository"
import { db } from "@/db/database"
import { errorMessage, type Backup } from "@/lib/schema"

type AppState = {
  data?: Backup
  busy: boolean
  unsaved: boolean
  run: <T>(job: () => Promise<T>, saveKey?: string) => Promise<T | undefined>
  invalid: (key: string, value: boolean) => void
  settle: () => Promise<boolean>
}
const AppContext = createContext<AppState | null>(null)
export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error("Aplicação não inicializada.")
  return context
}
const navigation = [
  { href: "/", label: "Visão geral", icon: House },
  { href: "/treinos/", label: "Minhas fichas", icon: ListChecks },
  { href: "/exercicios/", label: "Exercícios", icon: Dumbbell },
  { href: "/historico/", label: "Histórico", icon: History },
  { href: "/importar/", label: "Importar Excel", icon: Download },
  { href: "/configuracoes/", label: "Configurações", icon: Settings },
]

export function AppShell({ children }: { children: ReactNode }) {
  const result = useLiveQuery(async () => {
    try {
      return { data: await snapshot(), error: "" }
    } catch (error) {
      return { data: undefined, error: errorMessage(error) }
    }
  })
  const [pending, setPending] = useState(0)
  const [error, setError] = useState("")
  const path = usePathname()
  const [failedCount, setFailedCount] = useState(0)
  const [invalidCount, setInvalidCount] = useState(0)
  const tail = useRef<Promise<unknown>>(Promise.resolve())
  const invalidFields = useRef(new Set<string>())
  const failures = useRef<Array<{ job: () => Promise<unknown>; key: string }>>(
    []
  )
  const pendingRef = useRef(0)
  const { resolvedTheme, setTheme } = useTheme()
  const run = useCallback(
    async <T,>(job: () => Promise<T>, saveKey = ""): Promise<T | undefined> => {
      pendingRef.current++
      setPending(pendingRef.current)
      const next = tail.current
        .then(job)
        .then((value) => {
          if (saveKey) {
            failures.current = failures.current.filter(
              (failure) => failure.key !== saveKey
            )
            setFailedCount(failures.current.length)
            if (!failures.current.length && !invalidFields.current.size)
              setError("")
          }
          return value
        })
        .catch((cause) => {
          if (saveKey) {
            failures.current = failures.current.filter(
              (failure) => failure.key !== saveKey
            )
            failures.current.push({ job, key: saveKey })
            setFailedCount(failures.current.length)
          }
          setError(errorMessage(cause))
          return undefined
        })
        .finally(() => {
          pendingRef.current--
          setPending(pendingRef.current)
        })
      tail.current = next
      return next
    },
    []
  )
  const invalid = useCallback((key: string, value: boolean) => {
    if (value) invalidFields.current.add(key)
    else invalidFields.current.delete(key)
    setInvalidCount(invalidFields.current.size)
  }, [])
  const settle = useCallback(async () => {
    await tail.current
    if (failures.current.length || invalidFields.current.size) {
      setError(
        "Corrija os campos e salve as alterações pendentes antes de continuar."
      )
      return false
    }
    return true
  }, [])

  const storedTheme = result?.data?.settings.find(
    (row) => row.key === "theme"
  )?.value
  useEffect(() => {
    if (
      storedTheme === "light" ||
      storedTheme === "dark" ||
      storedTheme === "system"
    )
      setTheme(storedTheme)
  }, [storedTheme, setTheme])
  const changeTheme = useCallback(() => {
    void run(async () => {
      await db.settings.put({
        key: "theme",
        value: resolvedTheme === "dark" ? "light" : "dark",
      })
    })
  }, [resolvedTheme, run])
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.key.toLowerCase() !== "d"
      )
        return
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.closest("input, textarea, select, [role=combobox]"))
      )
        return
      changeTheme()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [changeTheme])

  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (
        pendingRef.current ||
        failures.current.length ||
        invalidFields.current.size
      )
        event.preventDefault()
    }
    function navigate(event: MouseEvent) {
      const link = (event.target as HTMLElement).closest<HTMLAnchorElement>(
        "a[href]"
      )
      if (
        !link ||
        link.download ||
        link.target ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.button !== 0
      )
        return
      if (invalidFields.current.size || failures.current.length) {
        event.preventDefault()
        setError(
          "Há alterações não salvas. Corrija os campos ou tente salvar novamente antes de sair."
        )
      } else if (pendingRef.current) {
        event.preventDefault()
        void tail.current.then(() => {
          if (!failures.current.length) window.location.assign(link.href)
        })
      }
    }
    window.addEventListener("beforeunload", beforeUnload)
    document.addEventListener("click", navigate)
    return () => {
      window.removeEventListener("beforeunload", beforeUnload)
      document.removeEventListener("click", navigate)
    }
  }, [])

  return (
    <AppContext.Provider
      value={{
        data: result?.data,
        busy: pending > 0,
        unsaved: failedCount > 0 || invalidCount > 0,
        run,
        invalid,
        settle,
      }}
    >
      <div className="app-frame">
        <aside className="sidebar">
          <a href="/" className="brand">
            <span className="brand-icon">
              <Dumbbell size={23} />
            </span>
            <span>
              gymtrack<span className="brand-dot">.</span>
            </span>
          </a>
          <p className="eyebrow sidebar-label">SEU ESPAÇO DE TREINO</p>
          <nav aria-label="Navegação principal">
            {navigation.map(({ href, label, icon: Icon }) => (
              <a
                key={href}
                href={href}
                aria-current={path === href ? "page" : undefined}
                className={`nav-item ${path === href ? "selected" : ""}`}
              >
                <Icon size={19} />
                {label}
                {path === href && (
                  <ChevronRight size={15} className="ml-auto" />
                )}
              </a>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="offline-note">
              <CloudOff size={20} />
              <strong>Seu treino vai com você.</strong>
              <p>
                Todos os seus dados ficam neste dispositivo, mesmo sem internet.
              </p>
            </div>
            <div className="sidebar-footer">
              <span className="avatar">GT</span>
              <div>
                <strong>Seu espaço pessoal</strong>
                <small>Sem contas. Sem distrações.</small>
              </div>
            </div>
          </div>
        </aside>
        <div className="main-frame">
          <header className="topbar">
            <a className="mobile-brand" href="/">
              <Dumbbell size={22} /> gymtrack
              <span className="brand-dot">.</span>
            </a>
            <span className="desktop-caption">
              <Activity size={16} /> Um pouco melhor a cada treino.
            </span>
            <div className="topbar-actions">
              <PwaStatus
                blocked={
                  !!result?.data?.workoutSessions.some(
                    (row) => row.status !== "completed"
                  ) ||
                  pending > 0 ||
                  failedCount > 0 ||
                  invalidCount > 0
                }
                settle={settle}
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label="Alternar tema"
                onClick={changeTheme}
              >
                <Sun className="hidden dark:block" />
                <Moon className="dark:hidden" />
              </Button>
            </div>
          </header>
          <main className="page-container">
            {(error || result?.error) && (
              <div role="alert" className="error-banner">
                <CircleAlert size={20} />
                <div>
                  <strong>Precisamos da sua atenção</strong>
                  <p>
                    {error || `Armazenamento indisponível: ${result?.error}`}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {failedCount > 0 && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          const jobs = failures.current.splice(0)
                          setFailedCount(0)
                          setError("")
                          for (const { job, key } of jobs) void run(job, key)
                        }}
                      >
                        Tentar salvar novamente
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setError("")
                        if (result?.error) window.location.reload()
                      }}
                    >
                      {result?.error
                        ? "Tentar abrir novamente"
                        : "Fechar aviso"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
            {result?.data
              ? children
              : !result?.error && (
                  <div role="status" className="empty-state">
                    Abrindo seu espaço de treino…
                  </div>
                )}
            {result?.data && <BackupReminder data={result.data} />}
            <footer className="page-footer">
              <span>
                <span className="status-dot" />{" "}
                {pending
                  ? "Salvando alterações…"
                  : failedCount || invalidCount
                    ? "Existem alterações não salvas"
                    : "Dados salvos neste dispositivo"}
              </span>
              <span>GymTrack · Feito para o seu ritmo</span>
            </footer>
          </main>
        </div>
        <nav className="mobile-nav" aria-label="Navegação móvel">
          {navigation
            .filter((item) =>
              ["/", "/treinos/", "/historico/", "/configuracoes/"].includes(
                item.href
              )
            )
            .map(({ href, label, icon: Icon }) => (
              <a
                key={href}
                href={href}
                aria-current={path === href ? "page" : undefined}
              >
                <Icon size={21} />
                <span>
                  {label === "Visão geral"
                    ? "Início"
                    : label === "Minhas fichas"
                      ? "Fichas"
                      : label === "Configurações"
                        ? "Ajustes"
                        : label}
                </span>
              </a>
            ))}
        </nav>
      </div>
    </AppContext.Provider>
  )
}

function BackupReminder({ data }: { data: Backup }) {
  const [now] = useState(() => Date.now())
  const last = data.settings.find((row) => row.key === "lastBackupAt")?.value
  const oldest = Math.min(
    now,
    ...data.workoutTemplates.map((row) => row.createdAt),
    ...data.workoutSessions.map((row) => row.startedAt)
  )
  if (now - (typeof last === "number" ? last : oldest) < 7 * 86400000)
    return null
  return (
    <div className="success-banner mt-6">
      <strong>Hora de cuidar dos seus registros.</strong> Já faz sete dias desde
      o último backup.{" "}
      <a href="/configuracoes/" className="underline">
        Gerar um backup completo
      </a>
    </div>
  )
}

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback)
  window.addEventListener("offline", callback)
  return () => {
    window.removeEventListener("online", callback)
    window.removeEventListener("offline", callback)
  }
}
function PwaStatus({
  blocked,
  settle,
}: {
  blocked: boolean
  settle: () => Promise<boolean>
}) {
  const [ready, setReady] = useState(false)
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true
  )
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null)
  const [problem, setProblem] = useState("")
  useEffect(() => {
    let disposed = false
    let registration: ServiceWorkerRegistration | undefined
    async function verify() {
      if (!navigator.serviceWorker.controller) return
      const response = await caches.match("/offline-assets.json", {
        ignoreSearch: true,
      })
      if (!response) return
      const assets: string[] = await response.json()
      const matches = await Promise.all(
        assets.map((asset) =>
          caches.match(new URL(asset, window.location.origin + "/").href, {
            ignoreSearch: true,
          })
        )
      )
      if (!disposed) setReady(matches.every(Boolean))
    }
    const controllerChange = () => {
      setWaiting(null)
      void verify()
    }
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        controllerChange
      )
      void navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then(async (reg) => {
          registration = reg
          if (disposed) return
          if (reg.waiting) setWaiting(reg.waiting)
          reg.addEventListener("updatefound", () => {
            const worker = reg.installing
            worker?.addEventListener("statechange", () => {
              if (!disposed)
                setWaiting(
                  reg.waiting?.state === "installed" &&
                    navigator.serviceWorker.controller
                    ? reg.waiting
                    : null
                )
            })
          })
          await navigator.serviceWorker.ready
          if (!disposed)
            setWaiting(reg.waiting?.state === "installed" ? reg.waiting : null)
          await verify()
        })
        .catch(() => {
          if (!disposed) setProblem("Cache offline indisponível")
        })
    }
    const check = () => {
      void registration?.update().catch(() => {})
      void verify()
    }
    window.addEventListener("focus", check)
    return () => {
      disposed = true
      window.removeEventListener("focus", check)
      navigator.serviceWorker?.removeEventListener(
        "controllerchange",
        controllerChange
      )
    }
  }, [])
  return (
    <div className="pwa-status">
      {waiting?.state === "installed" ? (
        <Button
          size="sm"
          variant="outline"
          disabled={blocked}
          title={
            blocked
              ? "Encerre o treino e salve as alterações para atualizar."
              : "Instalar nova versão"
          }
          onClick={async () => {
            // Recheck persisted state across tabs before activating an update.
            if (
              blocked ||
              !(await settle()) ||
              (await db.workoutSessions
                .filter((row) => row.status !== "completed")
                .count())
            )
              return
            navigator.serviceWorker.addEventListener(
              "controllerchange",
              () => window.location.reload(),
              { once: true }
            )
            waiting.postMessage({ type: "SKIP_WAITING" })
          }}
        >
          Atualização disponível <ArrowUpRight size={14} />
        </Button>
      ) : (
        <span
          title={
            problem ||
            (ready
              ? "Todos os recursos essenciais estão armazenados neste dispositivo."
              : "Abra online para preparar o cache inicial.")
          }
          className={`connection-pill ${ready ? "is-ready" : ""}`}
        >
          {ready ? <Check size={13} /> : <WifiOff size={13} />}
          {ready
            ? "Disponível offline"
            : problem || (online ? "Preparando offline" : "Sem conexão")}
        </span>
      )}
    </div>
  )
}
