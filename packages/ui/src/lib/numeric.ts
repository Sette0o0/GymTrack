/** Numeric drafts may be empty or end in a decimal separator while editing. */
export function isNumericDraft(value: string, integer = false) {
  return integer ? /^\d*$/.test(value) : /^\d*(?:[.,]\d*)?$/.test(value)
}

export function numericValue(value: string, integer = false): number | null {
  if (!(integer ? /^\d+$/ : /^\d+(?:[.,]\d+)?$/).test(value)) return null
  const parsed = Number(value.replace(",", "."))
  return Number.isFinite(parsed) ? parsed : null
}

export function numericText(value: string) {
  return value.replace(".", ",")
}
