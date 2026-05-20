import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "서울특별시교육청 행사 좌석 예약",
  description: "서울특별시교육청 행사 좌석 예약"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <header className="site-header">
          <Link className="brand" href="/">
            <Image alt="서울특별시교육청" height={34} priority src="/seoul-education-logo.svg" width={168} />
            <span>행사 좌석 예약</span>
          </Link>
          <nav className="top-nav" aria-label="주요 메뉴">
            <Link href="/lookup">예약 조회</Link>
            <Link href="/privacy">개인정보 처리방침</Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
