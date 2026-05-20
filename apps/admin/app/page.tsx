"use client";

import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  adminDeleteReservation,
  adminResetAllReservations,
  adminSearchReservations,
  adminUpdateReservation,
  auth,
  getCallableErrorMessage,
  seedSeats
} from "@seat/shared";
import { downloadReservationsExcel } from "@seat/shared";
import type { AdminReservation, AdminUpdateReservationInput } from "@seat/shared";

export default function AdminPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<AdminReservation[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [seeding, setSeeding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [editing, setEditing] = useState<AdminReservation | null>(null);
  const [editForm, setEditForm] = useState<Omit<AdminUpdateReservationInput, "reservationId">>({
    name: "",
    phoneLast4: "",
    email: "",
    seatDisplayName: ""
  });
  const [saving, setSaving] = useState(false);

  async function loadReservations(searchQuery = query) {
    setError("");
    setMessage("");
    setLoading(true);

    try {
      if (auth?.currentUser) {
        await auth.currentUser.getIdToken(true);
      }
      const result = await adminSearchReservations(searchQuery);
      setItems(result.items);
    } catch {
      setError("예약 정보를 불러오지 못했습니다. 관리자 권한을 확인해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!auth) {
      setError("Firebase 설정이 없습니다.");
      setReady(true);
      return;
    }

    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
      } else {
        await user.getIdToken(true);
        setReady(true);
      }
    });
  }, [router]);

  useEffect(() => {
    if (ready && auth?.currentUser) {
      loadReservations("").catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  async function runSeedSeats() {
    if (
      !window.confirm(
        "50행 x 50열(2,500석) 기준으로 없는 좌석만 추가합니다.\n기존 예약은 유지됩니다.\n\n계속할까요?"
      )
    ) {
      return;
    }

    setError("");
    setMessage("");
    setSeeding(true);

    try {
      if (auth?.currentUser) {
        await auth.currentUser.getIdToken(true);
      }
      const result = await seedSeats();
      setMessage(
        `좌석 ${result.total.toLocaleString()}개 확인 · 신규 ${result.created.toLocaleString()}개 · 기존 예약 유지 ${result.updated.toLocaleString()}개`
      );
    } catch {
      setError("좌석 데이터 생성에 실패했습니다. 관리자 권한을 확인해 주세요.");
    } finally {
      setSeeding(false);
    }
  }

  async function runResetAll() {
    if (!window.confirm("모든 예약을 취소하고 좌석을 전부 비울까요? 이 작업은 되돌릴 수 없습니다.")) return;

    setError("");
    setMessage("");
    setResetting(true);

    try {
      if (auth?.currentUser) {
        await auth.currentUser.getIdToken(true);
      }
      const result = await adminResetAllReservations();
      setMessage(`예약 ${result.canceled.toLocaleString()}건 취소, 좌석 ${result.released.toLocaleString()}석 초기화했습니다.`);
      await loadReservations();
    } catch {
      setError("예약 전체 초기화에 실패했습니다.");
    } finally {
      setResetting(false);
    }
  }

  async function removeReservation(item: AdminReservation) {
    if (!window.confirm(`${item.name} (${item.seatDisplayName}) 예약을 삭제할까요?`)) return;

    setError("");
    setMessage("");

    try {
      if (auth?.currentUser) {
        await auth.currentUser.getIdToken(true);
      }
      await adminDeleteReservation(item.id);
      setMessage(`${item.name} 예약을 삭제했습니다.`);
      await loadReservations();
    } catch (err) {
      setError(getCallableErrorMessage(err, "예약 삭제에 실패했습니다."));
    }
  }

  function openEdit(item: AdminReservation) {
    setEditing(item);
    setEditForm({
      name: item.name,
      phoneLast4: item.phoneLast4,
      email: item.email,
      seatDisplayName: item.seatDisplayName
    });
    setError("");
  }

  async function submitEdit() {
    if (!editing) return;

    setError("");
    setMessage("");
    setSaving(true);

    try {
      if (auth?.currentUser) {
        await auth.currentUser.getIdToken(true);
      }
      await adminUpdateReservation({
        reservationId: editing.id,
        ...editForm
      });
      setMessage(`${editForm.name} 예약 정보를 수정했습니다.`);
      setEditing(null);
      await loadReservations();
    } catch {
      setError("예약 수정에 실패했습니다. 입력값과 좌석 번호를 확인해 주세요.");
    } finally {
      setSaving(false);
    }
  }

  function exportExcel() {
    if (items.length === 0) {
      setError("다운로드할 예약 데이터가 없습니다.");
      return;
    }
    downloadReservationsExcel(items);
    setMessage(`예약 ${items.length.toLocaleString()}건을 엑셀(CSV) 파일로 다운로드했습니다.`);
  }

  async function logout() {
    if (auth) await signOut(auth);
    router.push("/login");
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
          <strong>{items.length.toLocaleString()}</strong>
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
          <p className="hint">
            50행 x 50열(2,500석) 기준으로 없는 좌석만 추가합니다. 이미 예약된 좌석은 초기화되지 않습니다.
          </p>
        </div>
        <button className="btn btn-primary" disabled={seeding} type="button" onClick={runSeedSeats}>
          {seeding ? "생성 중" : "좌석 데이터 생성"}
        </button>
      </section>

      <section className="panel" style={{ marginBottom: 16 }}>
        <h1>예약 관리</h1>
        <div className="field">
          <label htmlFor="admin-query">이름, 전화번호 뒤 4자리, 이메일, 좌석</label>
          <input
            id="admin-query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadReservations()}
          />
        </div>
        <div className="button-row">
          <button className="btn btn-primary" disabled={loading} type="button" onClick={() => loadReservations()}>
            {loading ? "불러오는 중" : "검색"}
          </button>
          <button className="btn btn-secondary" disabled={items.length === 0} type="button" onClick={exportExcel}>
            엑셀 다운로드
          </button>
          <button className="btn btn-danger" disabled={resetting} type="button" onClick={runResetAll}>
            {resetting ? "초기화 중" : "예약 전체 초기화"}
          </button>
        </div>
        {error && <div className="error">{error}</div>}
        {message && <div className="notice">{message}</div>}
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
              <th>관리</th>
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
                <td>{item.createdAt ? new Date(item.createdAt).toLocaleString("ko-KR") : "-"}</td>
                <td>
                  <div className="table-actions">
                    <button className="btn btn-secondary btn-small" type="button" onClick={() => openEdit(item)}>
                      수정
                    </button>
                    <button
                      className="btn btn-danger btn-small"
                      disabled={item.status !== "CONFIRMED"}
                      type="button"
                      onClick={() => removeReservation(item)}
                    >
                      삭제
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={7}>검색 결과가 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && setEditing(null)}>
          <div className="modal-card">
            <h2>예약 수정</h2>
            <div className="notice">현재 좌석: {editing.seatDisplayName}</div>

            <div className="field">
              <label htmlFor="edit-name">이름</label>
              <input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>

            <div className="field">
              <label htmlFor="edit-phone">전화번호 뒤 4자리</label>
              <input
                id="edit-phone"
                inputMode="numeric"
                maxLength={4}
                value={editForm.phoneLast4}
                onChange={(e) =>
                  setEditForm({ ...editForm, phoneLast4: e.target.value.replace(/\D/g, "").slice(0, 4) })
                }
              />
            </div>

            <div className="field">
              <label htmlFor="edit-email">이메일</label>
              <input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </div>

            <div className="field">
              <label htmlFor="edit-seat">좌석 (예: A-1)</label>
              <input
                id="edit-seat"
                value={editForm.seatDisplayName ?? ""}
                onChange={(e) => setEditForm({ ...editForm, seatDisplayName: e.target.value })}
              />
              <span className="hint">좌석을 바꿀 때만 다른 좌석 번호를 입력하세요.</span>
            </div>

            {error && <div className="error">{error}</div>}

            <div className="button-row">
              <button className="btn btn-secondary" type="button" onClick={() => setEditing(null)}>
                닫기
              </button>
              <button className="btn btn-primary" disabled={saving} type="button" onClick={submitEdit}>
                {saving ? "저장 중" : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
