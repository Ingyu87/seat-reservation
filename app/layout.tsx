import type { Metadata, Viewport } from "next";
import Image from "next/image";
import Link from "next/link";
import { getBookingSiteUrl } from "@seat/shared/site-url";
import "./globals.css";

const bookingSiteUrl = getBookingSiteUrl() || "https://seat-reservation-bice.vercel.app";
const bookingTitle = "생태전환교육 행사 좌석 예약";
const bookingDescription = "생태전환교육 행사 2,828석 좌석 예약";
const bookingOgImage = "/og.png?v=20260522-booking";

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
        url: bookingOgImage,
        width: 1672,
        height: 941,
        alt: bookingTitle
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: bookingTitle,
    description: bookingDescription,
    images: [bookingOgImage]
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
          <p>서울특별시교육청(서울특별시교육청 1호 교사개발자 서울가동초 백인규)</p>
          <p>개인정보 보호책임자: 서울특별시교육청 박옥선 / 문의: poseon@sen.go.kr</p>
        </footer>
      </body>
    </html>
  );
}
