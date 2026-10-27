"use client"

import { useEffect } from "react"

/** Free the bottom edge while the visual viewport is reduced by an on-screen keyboard. */
export function useMobileKeyboard() {
  useEffect(() => {
    const viewport = window.visualViewport
    const root = document.documentElement
    let baseline = window.innerHeight
    let frame = 0
    function update() {
      const active = document.activeElement
      const editing =
        (active instanceof HTMLInputElement &&
          !active.readOnly &&
          !["checkbox", "radio", "file", "button", "submit"].includes(
            active.type
          )) ||
        active instanceof HTMLTextAreaElement
      baseline = editing
        ? Math.max(baseline, window.innerHeight)
        : window.innerHeight
      root.toggleAttribute(
        "data-keyboard-open",
        editing &&
          window.innerWidth <= 1023 &&
          baseline - (viewport?.height ?? window.innerHeight) > 120
      )
    }
    function schedule() {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    }
    viewport?.addEventListener("resize", schedule)
    window.addEventListener("resize", schedule)
    document.addEventListener("focusin", schedule)
    document.addEventListener("focusout", schedule)
    return () => {
      cancelAnimationFrame(frame)
      viewport?.removeEventListener("resize", schedule)
      window.removeEventListener("resize", schedule)
      document.removeEventListener("focusin", schedule)
      document.removeEventListener("focusout", schedule)
      root.removeAttribute("data-keyboard-open")
    }
  }, [])
}
