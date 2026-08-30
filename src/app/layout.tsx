import type { Metadata } from "next";
import { Inter, Source_Serif_4, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import ThemeSync from "@/components/ThemeSync";

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
  title: "Yejun's Private Chat",
  description: "개인용 OpenRouter AI 채팅 플랫폼",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
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
        {children}
      </body>
    </html>
  );
}
