"use client"

import { useState, type ComponentProps } from "react"
import { NumberField } from "@base-ui/react/number-field"
import { cn } from "@workspace/ui/lib/utils"
import {
  isNumericDraft,
  numericText,
  numericValue,
} from "@workspace/ui/lib/numeric"

type NumberInputProps = Omit<
  ComponentProps<"input">,
  "value" | "defaultValue" | "type" | "onChange" | "min" | "max" | "step"
> & {
  value: string
  onValueChange: (value: string) => void
  integer?: boolean
  min?: number
  max?: number
}

/** A localized number field with strict text entry and no silent clamping. */
export function NumberInput({
  value,
  onValueChange,
  integer = false,
  min = 0,
  max,
  id,
  name,
  required,
  disabled,
  readOnly,
  className,
  onKeyDown,
  ...props
}: NumberInputProps) {
  const [rejected, setRejected] = useState(false)
  const number = numericValue(value, integer)
  function accept(next: string) {
    if (!isNumericDraft(next, integer)) {
      setRejected(true)
      return
    }
    setRejected(false)
    onValueChange(numericText(next))
  }
  function inserted(input: HTMLInputElement, text: string) {
    return (
      value.slice(0, input.selectionStart ?? value.length) +
      text.trim() +
      value.slice(input.selectionEnd ?? value.length)
    )
  }
  return (
    <NumberField.Root
      id={id}
      name={name}
      value={number}
      locale="pt-BR"
      min={min}
      max={max}
      step={integer ? 1 : "any"}
      smallStep={integer ? 1 : 0.1}
      allowOutOfRange
      allowWheelScrub={false}
      required={required}
      disabled={disabled}
      readOnly={readOnly}
      format={{ useGrouping: false }}
      onValueChange={(next, details) => {
        if (
          details.reason === "keyboard" ||
          details.reason === "increment-press" ||
          details.reason === "decrement-press"
        ) {
          setRejected(false)
          onValueChange(next === null ? "" : numericText(String(next)))
        } else details.cancel()
      }}
    >
      <NumberField.Input
        {...props}
        value={value}
        role="spinbutton"
        aria-roledescription="Campo numérico"
        aria-valuenow={number ?? undefined}
        aria-valuemin={min}
        aria-valuemax={max}
        inputMode={integer ? "numeric" : "decimal"}
        data-slot="input"
        className={cn(
          "h-11 w-full min-w-0 rounded-md border border-input bg-card px-3 py-2 text-base text-foreground shadow-xs transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive",
          className
        )}
        onChange={(event) => {
          accept(event.currentTarget.value)
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event)
          if (
            event.defaultPrevented ||
            event.ctrlKey ||
            event.metaKey ||
            event.altKey
          )
            return
          if (
            event.key.length === 1 &&
            !/^\d$/.test(event.key) &&
            (integer || ![",", "."].includes(event.key))
          ) {
            event.preventDefault()
            setRejected(true)
          }
        }}
        onPaste={(event) => {
          event.preventDefault()
          if (!disabled && !readOnly)
            accept(
              inserted(
                event.currentTarget,
                event.clipboardData.getData("text/plain")
              )
            )
        }}
        onDrop={(event) => {
          event.preventDefault()
          if (!disabled && !readOnly)
            accept(
              inserted(
                event.currentTarget,
                event.dataTransfer.getData("text/plain")
              )
            )
        }}
      />
      {rejected && (
        <span className="mt-1 block text-xs text-destructive" role="status">
          {integer
            ? "Digite somente números inteiros."
            : "Digite somente números; use vírgula ou ponto para decimais."}
        </span>
      )}
    </NumberField.Root>
  )
}
