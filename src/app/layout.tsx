import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Eleitores 2026 - Plataforma de Gestão Política",
  description: "Sistema de gerenciamento de eleitores e colaboradores",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={`${inter.className} bg-[#0a0a0f] text-white antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
