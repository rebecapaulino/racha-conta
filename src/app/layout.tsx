// Molde de todas as páginas: idioma, título, cores do navegador e fontes.
// As fontes ficam dentro do projeto (sem Google Fonts), para funcionar offline.

import type { Metadata, Viewport } from "next";
import "@fontsource/plus-jakarta-sans/latin-400.css";
import "@fontsource/plus-jakarta-sans/latin-500.css";
import "@fontsource/plus-jakarta-sans/latin-600.css";
import "@fontsource/plus-jakarta-sans/latin-700.css";
import "@fontsource/plus-jakarta-sans/latin-800.css";
import "./globals.css";
import "./visual-fluent.css";
import "./viagem.css";
import { THEME_COLOR, VISUAL, VISUAL_OVERRIDE_SCRIPT } from "@/ui/visual";

export const metadata: Metadata = {
  title: "Racha Conta",
  description:
    "Divida a conta do bar ou restaurante por pessoa, já com o serviço, e mande o resumo no WhatsApp.",
  applicationName: "Racha Conta",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    // iPhone ("Adicionar à Tela de Início"): o Safari procura o ícone também na raiz do site,
    // e guarda tentativas antigas; o "?v=" força buscar de novo.
    apple: [{ url: "/apple-touch-icon.png?v=2", sizes: "180x180", type: "image/png" }],
  },
  // App instalado no iPhone: abre em tela cheia, com o nome curto embaixo do ícone.
  appleWebApp: { capable: true, title: "Racha Conta", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLOR[VISUAL].light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLOR[VISUAL].dark },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: o script abaixo pode trocar data-visual antes do React assumir.
    <html lang="pt-BR" data-visual={VISUAL} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: VISUAL_OVERRIDE_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
