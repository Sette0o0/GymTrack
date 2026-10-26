"use client"

import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  Clock3,
  Dumbbell,
  Flame,
  Plus,
  ShieldCheck,
  Timer,
} from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Badge } from "@workspace/ui/components/badge"
import { useApp } from "./app-shell"
import { EmptyState, formatDate, PageHeading, TextLink } from "./ui-helpers"
import { startSession } from "@/services/sessions"
import { localDate } from "@/lib/schema"

export function HomeScreen() {
  const { data, run, busy } = useApp()
  if (!data) return null
  const templates = data.workoutTemplates.filter((row) => !row.archived)
  const completed = data.workoutSessions.filter(
    (row) => row.status === "completed"
  )
  const pending = data.workoutSessions.find((row) => row.status !== "completed")
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7))
  const thisWeek = completed.filter(
    (row) => row.localDate >= localDate(weekStart)
  ).length
  const totalSets = data.setRecords.filter(
    (row) => row.status === "completed"
  ).length
  const now = new Date()
  const date = now.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
  async function start(id: string) {
    const sessionId = await run(() => startSession(id))
    if (sessionId) window.location.assign(`/executar/?id=${sessionId}`)
  }
  return (
    <>
      <PageHeading
        eyebrow={date.toUpperCase()}
        title="Seu próximo nível começa aqui."
        description="Um treino de cada vez. Vamos fazer valer o de hoje?"
        action={
          <a href="/treinos/?novo=1" className="button-link">
            <Plus size={17} />
            Nova ficha
          </a>
        }
      />
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="hero-tag">
            <span className="status-dot" />{" "}
            {pending
              ? "TREINO EM ANDAMENTO"
              : "CONSISTÊNCIA É O QUE TRANSFORMA"}
          </span>
          <h2>
            {pending
              ? "Vamos continuar\nde onde parou?"
              : "O seu único limite\né o próximo passo."}
          </h2>
          <p>
            {pending
              ? `${pending.workoutCode} · ${pending.workoutName}. Tudo o que você registrou está salvo.`
              : "Suas fichas, suas cargas e a sua evolução. Tudo organizado para você focar no que importa: treinar."}
          </p>
          {pending ? (
            <a className="hero-button" href={`/executar/?id=${pending.id}`}>
              Retomar treino <ArrowRight size={18} />
            </a>
          ) : templates.length ? (
            <Button
              className="hero-button"
              disabled={busy}
              onClick={() => start(templates[0]!.id)}
            >
              Começar meu treino <ArrowRight size={18} />
            </Button>
          ) : (
            <a className="hero-button" href="/treinos/?novo=1">
              Criar minha primeira ficha <ArrowRight size={18} />
            </a>
          )}
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="hero-orbit orbit-one" />
          <div className="hero-orbit orbit-two" />
          <Dumbbell className="hero-dumbbell" strokeWidth={1.3} />
          <span className="art-caption">MOVE. GROW. REPEAT.</span>
          <span className="art-spark">✳</span>
        </div>
      </section>
      <section className="stats-grid" aria-label="Resumo dos treinos">
        {[
          {
            icon: Flame,
            label: "Treinos nesta semana",
            value: thisWeek.toString().padStart(2, "0"),
            detail: "Cada sessão faz a diferença",
            color: "orange",
          },
          {
            icon: Dumbbell,
            label: "Fichas disponíveis",
            value: templates.length.toString().padStart(2, "0"),
            detail: "Do seu jeito, no seu ritmo",
            color: "green",
          },
          {
            icon: Check,
            label: "Séries concluídas",
            value: totalSets.toString().padStart(2, "0"),
            detail: "Seu esforço fica registrado",
            color: "purple",
          },
        ].map(({ icon: Icon, label, value, detail, color }) => (
          <Card className="stat-card" key={label}>
            <CardContent>
              <div className="stat-top">
                <span>{label}</span>
                <span className={`stat-icon ${color}`}>
                  <Icon size={19} />
                </span>
              </div>
              <strong>{value}</strong>
              <small>{detail}</small>
            </CardContent>
          </Card>
        ))}
      </section>
      <div className="home-columns">
        <section>
          <div className="section-heading">
            <div>
              <h2>Escolha seu treino</h2>
              <p>A sua próxima conquista começa com uma ficha.</p>
            </div>
            <TextLink href="/treinos/">Gerenciar fichas</TextLink>
          </div>
          {!templates.length ? (
            <EmptyState
              title="Seu primeiro treino começa aqui"
              action={
                <a className="button-link" href="/treinos/?novo=1">
                  <Plus size={16} />
                  Criar ficha
                </a>
              }
            >
              Monte sua ficha ou importe os exercícios da sua planilha.
            </EmptyState>
          ) : (
            <div className="workout-grid">
              {templates.map((template, index) => {
                const exercises = data.templateExercises
                  .filter((row) => row.templateId === template.id)
                  .sort((a, b) => a.order - b.order)
                const last = completed.find(
                  (row) => row.templateId === template.id
                )
                return (
                  <Card className="workout-card" key={template.id}>
                    <CardContent>
                      <div className="flex items-start justify-between">
                        <span className={`workout-letter tone-${index % 3}`}>
                          {template.code}
                        </span>
                        <Badge variant="secondary">
                          {exercises.length} exercícios
                        </Badge>
                      </div>
                      <h3>{template.name}</h3>
                      <p className="exercise-preview">
                        {exercises
                          .slice(0, 3)
                          .map(
                            (exercise) =>
                              data.exerciseDefinitions.find(
                                (row) => row.id === exercise.exerciseId
                              )?.name
                          )
                          .join(" · ") || "Adicione seus exercícios"}
                      </p>
                      <div className="workout-last">
                        <Clock3 size={14} />
                        {last
                          ? `Último treino: ${formatDate(last.startedAt)}`
                          : "Pronto para a primeira sessão"}
                      </div>
                      <Button
                        variant="outline"
                        className="w-full justify-between"
                        disabled={busy || !!pending}
                        onClick={() => start(template.id)}
                      >
                        Iniciar treino <ArrowRight size={17} />
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </section>
        <aside className="home-aside">
          <Card className="tip-card">
            <CardContent>
              <span className="tip-icon">
                <ShieldCheck size={23} />
              </span>
              <h3>Sua evolução merece cuidado.</h3>
              <p>
                Um backup guarda suas fichas e todos os registros. Leva só
                alguns segundos.
              </p>
              <TextLink href="/configuracoes/">Cuidar dos meus dados</TextLink>
            </CardContent>
          </Card>
          <a className="import-shortcut" href="/importar/">
            <span>
              <ArrowDownToLine size={21} />
            </span>
            <div>
              <strong>Já tem uma planilha?</strong>
              <p>Traga seus treinos do Excel.</p>
            </div>
            <ArrowUpRight size={18} />
          </a>
        </aside>
      </div>
      <section className="recent-section">
        <div className="section-heading">
          <div>
            <h2>Últimos treinos</h2>
            <p>Pequenas vitórias que constroem a sua evolução.</p>
          </div>
          <TextLink href="/historico/">Ver histórico</TextLink>
        </div>
        {completed.length ? (
          <div className="recent-list">
            {completed.slice(0, 3).map((session) => (
              <a
                key={session.id}
                href={`/historico/?id=${session.id}`}
                className="recent-row"
              >
                <span className="recent-check">
                  <Check size={19} />
                </span>
                <div>
                  <strong>
                    {session.workoutCode} · {session.workoutName}
                  </strong>
                  <small>
                    <CalendarDays size={13} /> {formatDate(session.startedAt)}
                  </small>
                </div>
                <span className="recent-duration">
                  <Timer size={14} />{" "}
                  {Math.max(
                    1,
                    Math.round(
                      ((session.finishedAt ?? session.startedAt) -
                        session.startedAt) /
                        60000
                    )
                  )}{" "}
                  min
                </span>
                <ArrowUpRight size={17} />
              </a>
            ))}
          </div>
        ) : (
          <div className="recent-empty">
            <CalendarDays size={21} />
            <span>
              Seu histórico está pronto para receber a primeira conquista.
            </span>
          </div>
        )}
      </section>
    </>
  )
}
