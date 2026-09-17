import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, Song_Myung, IBM_Plex_Sans_KR } from "next/font/google";
import "./globals.css";

/* ============================================================
   서체
   next/font 는 빌드 때 받아서 같이 배포한다. 런타임에 CDN 을 때리지
   않으므로 폰트가 늦게 떠서 글자가 튀는 일이 없고, 사내망이나 비행기
   모드처럼 외부가 막힌 곳에서도 지면이 그대로 선다.

   라틴은 디도(Bodoni), 한글은 명조(송명)로 갈라 쓴다. 한 제목 안에서
   "MY IDENTITY" 와 "오늘, 대전" 이 같은 굵기·같은 대비로 읽히게 하려면
   이 짝이 필요하다. 본문은 한글·라틴이 한 몸인 산세리프로 둔다.
   ============================================================ */
const display = Bodoni_Moda({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--f-display",
  display: "swap",
});

// 한글 폰트는 subsets 옵션이 없다 (용량 때문에 preload 대상이 아니다).
const displayKo = Song_Myung({
  weight: "400",
  variable: "--f-display-ko",
  display: "swap",
});

const sans = IBM_Plex_Sans_KR({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--f-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "My Identity",
  description: "일상 · 비즈니스 · 취미를 한 화면으로",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "My Identity", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F4F3F7" },
    { media: "(prefers-color-scheme: dark)", color: "#121118" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="ko"
      className={`${display.variable} ${displayKo.variable} ${sans.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
