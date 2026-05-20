import type { Metadata, Viewport } from "next";
import Image from "next/image";
import Link from "next/link";
import { getBookingSiteUrl } from "@seat/shared/site-url";
import "./globals.css";

const bookingSiteUrl = getBookingSiteUrl() || "https://seat-reservation-bice.vercel.app";
const bookingTitle = "생태전환교육 행사 좌석 예약";
const bookingDescription = "서울특별시교육청 생태전환교육 행사 2,500석 좌석 예약";

export const metadata: Metadata = {
  title: bookingTitle,
  description: bookingDescription,
  metadataBase: new URL(bookingSiteUrl),
  openGraph: {
    title: bookingTitle,
    description: bookingDescription,
    url: bookingSiteUrl,
    siteName: bookingTitle,
    locale: "ko_KR",
    type: "website",
    images: [
      {
        url: "/og.png",
        alt: bookingTitle
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: bookingTitle,
    description: bookingDescription,
    images: ["/og.png"]
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <header className="site-header">
          <Link className="brand" href="/">
            <Image alt="서울특별시교육청" height={34} priority src="/seoul-education-logo.svg" width={168} />
            <span>생태전환교육 행사 좌석 예약</span>
          </Link>
          <nav className="top-nav" aria-label="주요 메뉴">
            <Link href="/lookup">예약 조회</Link>
            <Link href="/privacy">개인정보 처리방침</Link>
          </nav>
        </header>
        <main className="site-main">{children}</main>
        <footer className="site-footer">
          <p>© 2026 서울가동초 백인규/ 창의미래교육과 최정엽. All rights reserved.</p>
          <p>
            개인정보책임자: 서울가동초 백인규{" "}
            <a href="mailto:ingyu87@sen.go.kr">ingyu87@sen.go.kr</a>
          </p>
        </footer>
      </body>
    </html>
  );
}
