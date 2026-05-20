"use client";

import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { adminSearchReservations, auth } from "@/lib/firebase";
import type { AdminReservation } from "@/lib/types";

export default function AdminPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<AdminReservation[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!auth) {
      setError("Firebase 환경 변수가 설정되지 않았습니다.");
      setReady(true);
      return;
    }
    return onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/admin/login");
      } else {
        setReady(true);
      }
    });
  }, [router]);

  async function search() {
    setError("");
    try {
      const result = await adminSearchReservations(query);
      setItems(result.items);
    } catch {
      setError("검색 중 문제가 발생했습니다. 관리자 권한을 확인해주세요.");
    }
  }

  async function logout() {
    if (auth) await signOut(auth);
    router.push("/admin/login");
  }

  if (!ready) {
    return <main className="page">관리자 정보를 확인하는 중입니다.</main>;
  }

  return (
    <main className="page">
      <section className="summary">
        <div className="summary-card">
          <span>관리자</span>
          <strong>검색</strong>
        </div>
        <div className="summary-card">
          <span>결과</span>
          <strong>{items.length}</strong>
        </div>
        <div className="summary-card">
          <span>작업</span>
          <button className="btn btn-secondary" type="button" onClick={logout}>
            로그아웃
          </button>
        </div>
      </section>

      <section className="panel" style={{ marginBottom: 16 }}>
        <h1>예약자 검색</h1>
        <div className="field">
          <label htmlFor="admin-query">이름, 전화번호 뒤 4자리, 이메일, 좌석</label>
          <input id="admin-query" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} />
        </div>
        {error && <div className="error">{error}</div>}
        <button className="btn btn-primary" type="button" onClick={search}>
          검색
        </button>
      </section>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>이름</th>
              <th>전화번호 뒤 4자리</th>
              <th>이메일</th>
              <th>좌석</th>
              <th>상태</th>
              <th>예약일시</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.phoneLast4}</td>
                <td>{item.email}</td>
                <td>{item.seatDisplayName}</td>
                <td>{item.status === "CONFIRMED" ? "예약 완료" : "취소됨"}</td>
                <td>{item.createdAt ?? "-"}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6}>검색 결과가 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
