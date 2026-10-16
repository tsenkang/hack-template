import type { Metadata, Viewport } from "next";
import { ptBR } from "@/i18n/pt-BR";
import { THEME_BOOT_SCRIPT } from "@/store/ui-store";
import "./globals.css";

export const metadata: Metadata = {
  title: `${ptBR.app.name} — ${ptBR.app.tagline}`,
  description: ptBR.app.tagline,
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: ptBR.app.name, statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#161a22" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Aplica o tema antes de pintar a tela, para não "piscar" claro → escuro. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
