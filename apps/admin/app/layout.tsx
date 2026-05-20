import type { Metadata } from "next";
import Link from "next/link";
import { getBookingSiteUrl } from "@seat/shared/site-url";
import "./globals.css";

export const metadata: Metadata = {
  title: "생태전환교육 행사 좌석 관리자",
  description: "서울특별시교육청 생태전환교육 행사 좌석 예약 관리자"
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
        {children}
        <footer className="site-footer">
          <p>© 2026 서울가동초 백인규. All rights reserved.</p>
        </footer>
      </body>
    </html>
  );
}
