import type { Metadata, Viewport } from "next";
import {
  Bodoni_Moda,
  Archivo_Black,
  Black_Han_Sans,
  Gothic_A1,
} from "next/font/google";
import "./globals.css";

/* ============================================================
   서체 — NEWSSTAND

   가판대에 놓인 잡지의 조판을 그대로 가져온다. 네 벌이 각자 다른
   일을 한다.

     Bodoni Moda   디도. 숫자와 제호. 이 지면의 뼈대다.
     Archivo Black 라틴 러버릭. 작고 넓게 벌려 쓰는 라벨 전용.
     Black Han Sans 한글 디스플레이. 크게 칠 때만.
     Gothic A1     한글 본문·UI. 굵기 폭이 넓어 900 까지 쓴다.

   next/font 가 빌드 때 받아서 같이 배포한다. 런타임에 CDN 을 때리지
   않으므로 폰트가 늦게 떠서 글자가 튀지 않고, 회사망처럼 외부가 막힌
   곳에서도 지면이 그대로 선다.
   ============================================================ */
const didone = Bodoni_Moda({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
  variable: "--f-didone",
  display: "swap",
});

const kicker = Archivo_Black({
  subsets: ["latin"],
  weight: "400",
  variable: "--f-kick",
  display: "swap",
});

const krDisplay = Black_Han_Sans({
  subsets: ["latin"],
  weight: "400",
  variable: "--f-krd",
  display: "swap",
});

const kr = Gothic_A1({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800", "900"],
  variable: "--f-kr",
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
    { media: "(prefers-color-scheme: light)", color: "#FFFCF7" },
    { media: "(prefers-color-scheme: dark)", color: "#140E11" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="ko"
      className={`${didone.variable} ${kicker.variable} ${krDisplay.variable} ${kr.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
