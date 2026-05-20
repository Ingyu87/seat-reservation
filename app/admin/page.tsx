"use client";

import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { adminSearchReservations, auth, seedSeats } from "@/lib/firebase";
import type { AdminReservation } from "@/lib/types";

export default function AdminPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<AdminReservation[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    if (!auth) {
      setError("Firebase 설정이 없습니다.");
      setReady(true);
      return;
    }

    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/admin/login");
      } else {
        await user.getIdToken(true);
        setReady(true);
      }
    });
  }, [router]);

  async function search() {
    setError("");
    setMessage("");

    try {
      const result = await adminSearchReservations(query);
      setItems(result.items);
    } catch {
      setError("예약 정보를 불러오지 못했습니다. 관리자 권한을 확인해 주세요.");
    }
  }

  async function runSeedSeats() {
    if (!window.confirm("좌석 데이터 2,500개를 생성하거나 갱신할까요?")) return;

    setError("");
    setMessage("");
    setSeeding(true);

    try {
      if (auth?.currentUser) {
        await auth.currentUser.getIdToken(true);
      }
      const result = await seedSeats();
      setMessage(`좌석 데이터 ${result.total.toLocaleString()}개가 준비되었습니다.`);
    } catch {
      setError("좌석 데이터 생성에 실패했습니다. 관리자 권한을 확인해 주세요.");
    } finally {
      setSeeding(false);
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
          <strong>예약 관리</strong>
        </div>
        <div className="summary-card">
          <span>검색 결과</span>
          <strong>{items.length}</strong>
        </div>
        <div className="summary-card">
          <span>계정</span>
          <button className="btn btn-secondary" type="button" onClick={logout}>
            로그아웃
          </button>
        </div>
      </section>

      <section className="panel admin-actions">
        <div>
          <h1>좌석 데이터</h1>
          <p className="hint">처음 배포한 뒤 한 번 실행하면 50행 x 50열, 총 2,500개 좌석이 생성됩니다.</p>
        </div>
        <button className="btn btn-primary" disabled={seeding} type="button" onClick={runSeedSeats}>
          {seeding ? "생성 중" : "좌석 데이터 생성"}
        </button>
      </section>

      <section className="panel" style={{ marginBottom: 16 }}>
        <h1>예약 검색</h1>
        <div className="field">
          <label htmlFor="admin-query">이름, 전화번호 뒤 4자리, 이메일, 좌석</label>
          <input
            id="admin-query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
          />
        </div>
        {error && <div className="error">{error}</div>}
        {message && <div className="notice">{message}</div>}
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
              <th>예약 일시</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.phoneLast4}</td>
                <td>{item.email}</td>
                <td>{item.seatDisplayName}</td>
                <td>{item.status === "CONFIRMED" ? "예약 완료" : "취소"}</td>
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
