import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { getAdminSiteUrl, getBookingSiteUrl } from "@seat/shared/site-url";
import "./globals.css";

const adminSiteUrl = getAdminSiteUrl() || "https://seat-reservation-admin.vercel.app";
const adminTitle = "생태전환교육 행사 관리자";
const adminDescription = "생태전환교육 행사 좌석 예약 관리자";
const adminOgImage = "/og.png?v=20260522-admin";

export const metadata: Metadata = {
  title: adminTitle,
  description: adminDescription,
  metadataBase: new URL(adminSiteUrl),
  openGraph: {
    title: adminTitle,
    description: adminDescription,
    url: adminSiteUrl,
    siteName: adminTitle,
    locale: "ko_KR",
    type: "website",
    images: [
      {
        url: adminOgImage,
        width: 1672,
        height: 941,
        alt: adminTitle
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: adminTitle,
    description: adminDescription,
    images: [adminOgImage]
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const bookingSiteUrl = getBookingSiteUrl();

  return (
    <html lang="ko">
      <body>
        <header className="site-header admin-header">
          <Link className="brand" href="/">
            <span>생태전환교육 행사 관리자</span>
          </Link>
          {bookingSiteUrl ? (
            <nav className="top-nav" aria-label="관리자 메뉴">
              <a href={bookingSiteUrl} rel="noopener noreferrer" target="_blank">
                예약 사이트 열기
              </a>
            </nav>
          ) : null}
        </header>
        <main className="site-main">{children}</main>
        <footer className="site-footer">
          <p>© 2026 서울시교육청 / 서울가동초등학교 백인규. All rights reserved.</p>
          <p>개인정보책임자 서울가동초등학교 백인규 iingyu87@sen.go.kr</p>
        </footer>
      </body>
    </html>
  );
}
