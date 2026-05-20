import type { Metadata } from "next";
import Link from "next/link";
import { getBookingSiteUrl } from "@seat/shared/site-url";
import "./globals.css";

export const metadata: Metadata = {
  title: "행사 좌석 예약 관리자",
  description: "서울특별시교육청 행사 좌석 예약 관리자"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const bookingSiteUrl = getBookingSiteUrl();

  return (
    <html lang="ko">
      <body>
        <header className="site-header admin-header">
          <Link className="brand" href="/">
            <span>행사 좌석 예약 관리자</span>
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
      </body>
    </html>
  );
}
