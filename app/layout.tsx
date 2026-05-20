import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "행사 좌석 예약",
  description: "행사 좌석을 직접 선택해 예약하는 시스템"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <header className="site-header">
          <Link className="brand" href="/">
            행사 좌석 예약
          </Link>
          <nav className="top-nav">
            <Link href="/lookup">예약 조회</Link>
            <Link href="/privacy">개인정보 처리방침</Link>
            <Link href="/admin">관리자</Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
