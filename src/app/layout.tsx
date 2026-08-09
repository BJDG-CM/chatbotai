import type { Metadata } from "next";
import { Inter, Source_Serif_4, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import ThemeSync from "@/components/ThemeSync";
import HistorySync from "@/components/HistorySync";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Local Chat",
  description: "OpenRouter 기반 로컬 AI 채팅 플랫폼",
};

const THEME_INIT_SCRIPT = `
(function () {
  try {
    var raw = localStorage.getItem('chatbotai-settings');
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && parsed.state) {
        if (parsed.state.darkMode) {
          document.documentElement.classList.add('dark');
        }
        if (parsed.state.fontSize) {
          document.documentElement.setAttribute('data-font-size', parsed.state.fontSize);
        }
      }
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${inter.variable} ${sourceSerif.variable} ${plexMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex h-full min-h-screen overflow-hidden bg-app text-primary">
        <ThemeSync />
        <HistorySync />
        <Sidebar />
        <main className="min-w-0 flex-1">{children}</main>
      </body>
    </html>
  );
}
