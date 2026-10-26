"use client"

import { useId, useState, type ReactNode } from "react"
import { Button } from "@workspace/ui/components/button"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { ArrowUpRight, Dumbbell } from "lucide-react"

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      {action}
    </div>
  )
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: (id: string) => ReactNode
  hint?: string
}) {
  const id = useId()
  return (
    <div className="field">
      <Label htmlFor={id}>{label}</Label>
      {children(id)}
      {hint && <small className="text-muted-foreground">{hint}</small>}
    </div>
  )
}
export function Choice({
  id,
  value,
  onChange,
  options,
  disabled,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  disabled?: boolean
}) {
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (next !== null) onChange(String(next))
      }}
      disabled={disabled}
      items={options}
    >
      <SelectTrigger id={id} className="min-h-11 w-full">
        <SelectValue>
          {options.find((option) => option.value === value)?.label ??
            "Selecione"}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Dumbbell />
      </span>
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  )
}
export function TextLink({
  href,
  children,
}: {
  href: string
  children: ReactNode
}) {
  return (
    <a className="text-link" href={href}>
      {children}
      <ArrowUpRight size={16} />
    </a>
  )
}
export function ConfirmAction({
  label,
  title,
  description,
  onConfirm,
  disabled,
  destructive = false,
}: {
  label: ReactNode
  title: string
  description: ReactNode
  onConfirm: () => Promise<unknown>
  disabled?: boolean
  destructive?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [working, setWorking] = useState(false)
  return (
    <>
      <Button
        title={title}
        disabled={disabled}
        variant={destructive ? "destructive" : "outline"}
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!working) setOpen(next)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription render={<div />}>
              {description}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              disabled={working}
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              disabled={working}
              variant={destructive ? "destructive" : "default"}
              onClick={async () => {
                setWorking(true)
                try {
                  await onConfirm()
                  setOpen(false)
                } finally {
                  setWorking(false)
                }
              }}
            >
              {working ? "Aguarde…" : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
export function formatDate(value: number | string) {
  return new Date(
    typeof value === "string" ? `${value}T12:00:00` : value
  ).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}
