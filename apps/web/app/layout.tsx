import "@workspace/ui/globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AppShell } from "@/components/app-shell"
import type { Metadata, Viewport } from "next"

export const metadata: Metadata = {
  title: "GymTrack · Seu próximo nível",
  description: "Seu treino, seu ritmo. Fichas e registros disponíveis offline.",
  appleWebApp: { capable: true, title: "GymTrack", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
}
export const viewport: Viewport = {
  themeColor: "#0b1714",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className="antialiased">
      <body>
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  )
}
