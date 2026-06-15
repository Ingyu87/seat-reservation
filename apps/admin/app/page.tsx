"use client";

import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, getFirestore, onSnapshot, orderBy, query as firestoreQuery } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  adminDeleteReservation,
  adminResetAllReservations,
  adminSearchReservations,
  adminUpdateReservationGate,
  adminUpdateReservation,
  auth,
  downloadReservationsExcel,
  firebaseApp,
  generateDemoSeats,
  getReservationGateSettings,
  getCallableErrorMessage,
  isSeatDisabled
} from "@seat/shared";
import { AdminSeatStatusMap } from "@/app/components/AdminSeatStatusMap";
import type { AdminReservation, AdminUpdateReservationInput, ReservationGateSettings, Seat, SeatMapResponse } from "@seat/shared";

function formatKoreanDateTime(value?: string | null) {
  if (!value) return "즉시 오픈";
  return new Date(value).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "long",
    timeStyle: "short"
  });
}

function toDatetimeLocalValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export default function AdminPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<AdminReservation[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [editing, setEditing] = useState<AdminReservation | null>(null);
  const [editForm, setEditForm] = useState<Omit<AdminUpdateReservationInput, "reservationId"> & { seatText: string }>({
    name: "",
    schoolName: "",
    phoneLast4: "",
    seatDisplayNames: [],
    seatText: ""
  });
  const [saving, setSaving] = useState(false);
  const [pageSize, setPageSize] = useState<20 | 50>(20);
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<"reservations" | "seats" | "schedule">("reservations");
  const [seatMap, setSeatMap] = useState<SeatMapResponse | null>(null);
  const [seatMapError, setSeatMapError] = useState("");
  const [gate, setGate] = useState<ReservationGateSettings | null>(null);
  const [gateForm, setGateForm] = useState("");
  const [gateClosesAtForm, setGateClosesAtForm] = useState("");
  const [gateSaving, setGateSaving] = useState(false);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);
  const rangeStart = items.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, items.length);
  const disabledSeatCount = useMemo(
    () =>
      (seatMap?.seats ?? []).filter((seat) => seat.status === "AVAILABLE" && isSeatDisabled(seat.id)).length,
    [seatMap?.seats]
  );
  const availableSeatCount = Math.max(0, (seatMap?.total ?? 0) - (seatMap?.reserved ?? 0) - disabledSeatCount);

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
      setPage(1);
    } catch {
      setError("예약 정보를 불러오지 못했습니다. 관리자 권한을 확인해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  async function loadReservationGate() {
    try {
      const result = await getReservationGateSettings();
      setGate(result);
      setGateForm(toDatetimeLocalValue(result.opensAt));
      setGateClosesAtForm(toDatetimeLocalValue(result.closesAt));
    } catch {
      setError("예약 오픈 설정을 불러오지 못했습니다.");
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
      loadReservationGate().catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => {
    if (!ready || !auth?.currentUser) return;

    if (!firebaseApp) {
      const seats = generateDemoSeats();
      setSeatMap({ total: seats.length, reserved: 0, seats });
      return;
    }

    const firestore = getFirestore(firebaseApp);
    const seatsQuery = firestoreQuery(collection(firestore, "seats"), orderBy("sortOrder", "asc"));
    const unsubscribe = onSnapshot(
      seatsQuery,
      (snapshot) => {
        const seats = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<Seat, "id">),
          disabled: isSeatDisabled(doc.id)
        })) as Seat[];
        const reserved = seats.filter((seat) => seat.status === "RESERVED").length;
        setSeatMap({ total: seats.length, reserved, seats });
        setSeatMapError("");
      },
      () => setSeatMapError("좌석 현황을 실시간으로 불러오지 못했습니다.")
    );

    return unsubscribe;
  }, [ready]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  async function runResetAll() {
    if (!window.confirm("모든 예약 기록을 삭제하고 좌석을 비울까요? 이 작업은 되돌릴 수 없습니다.")) return;

    setError("");
    setMessage("");
    setResetting(true);

    try {
      if (auth?.currentUser) {
        await auth.currentUser.getIdToken(true);
      }
      const result = await adminResetAllReservations();
      setMessage(`예약 ${result.deleted.toLocaleString()}건 삭제, 좌석 ${result.released.toLocaleString()}석 초기화했습니다.`);
      await loadReservations();
    } catch {
      setError("예약 전체 초기화에 실패했습니다.");
    } finally {
      setResetting(false);
    }
  }

  async function saveReservationGate(opensAtValue = gateForm, closesAtValue = gateClosesAtForm) {
    setError("");
    setMessage("");
    setGateSaving(true);

    try {
      if (auth?.currentUser) {
        await auth.currentUser.getIdToken(true);
      }

      const opensAt = opensAtValue ? new Date(opensAtValue).toISOString() : null;
      const closesAt = closesAtValue ? new Date(closesAtValue).toISOString() : null;
      if (opensAt && closesAt && new Date(closesAt).getTime() <= new Date(opensAt).getTime()) {
        setError("예약 종료 시간은 시작 시간보다 늦어야 합니다.");
        return;
      }

      const result = await adminUpdateReservationGate({ opensAt, closesAt });
      setGate(result);
      setGateForm(toDatetimeLocalValue(result.opensAt));
      setGateClosesAtForm(toDatetimeLocalValue(result.closesAt));
      setMessage(
        result.isOpen
          ? "예약 가능 시간이 저장되었고 현재 오픈 상태입니다."
          : "예약 가능 시간이 저장되었습니다."
      );
    } catch (err) {
      setError(getCallableErrorMessage(err, "예약 오픈 설정 저장에 실패했습니다."));
    } finally {
      setGateSaving(false);
    }
  }

  function openReservationNow() {
    saveReservationGate("", "").catch(() => undefined);
  }

  async function removeReservation(item: AdminReservation) {
    if (!window.confirm(`${item.name} (${item.seatDisplayNames.join(", ")}) 예약을 완전히 삭제할까요?`)) return;

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
      schoolName: item.schoolName,
      phoneLast4: item.phoneLast4,
      seatDisplayNames: item.seatDisplayNames,
      seatText: item.seatDisplayNames.join(", ")
    });
    setError("");
  }

  async function submitEdit() {
    if (!editing) return;

    setError("");
    setMessage("");
    setSaving(true);

    const seatDisplayNames = editForm.seatText
      .split(",")
      .map((seat) => seat.trim())
      .filter(Boolean);

    try {
      if (auth?.currentUser) {
        await auth.currentUser.getIdToken(true);
      }
      await adminUpdateReservation({
        reservationId: editing.id,
        name: editForm.name,
        schoolName: editForm.schoolName,
        phoneLast4: editForm.phoneLast4,
        seatDisplayNames
      });
      setMessage(`${editForm.name} 예약 정보를 수정했습니다.`);
      setEditing(null);
      await loadReservations();
    } catch {
      setError("예약 수정에 실패했습니다. 입력값과 좌석 개수를 확인해 주세요.");
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
    setMessage(`예약 ${items.length.toLocaleString()}건을 CSV 파일로 다운로드했습니다.`);
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

      <div className="admin-tabs" role="tablist" aria-label="관리자 메뉴">
        <button
          aria-selected={activeTab === "reservations"}
          className={activeTab === "reservations" ? "active" : ""}
          role="tab"
          type="button"
          onClick={() => setActiveTab("reservations")}
        >
          예약 관리
        </button>
        <button
          aria-selected={activeTab === "seats"}
          className={activeTab === "seats" ? "active" : ""}
          role="tab"
          type="button"
          onClick={() => setActiveTab("seats")}
        >
          좌석 현황
        </button>
        <button
          aria-selected={activeTab === "schedule"}
          className={activeTab === "schedule" ? "active" : ""}
          role="tab"
          type="button"
          onClick={() => setActiveTab("schedule")}
        >
          예약 오픈
        </button>
      </div>

      {activeTab === "reservations" && (
        <>
      <section className="panel" style={{ marginBottom: 16 }}>
        <h1>예약 관리</h1>
        <div className="field">
          <label htmlFor="admin-query">학생 이름, 학생 소속교, 보호자 전화번호 뒤 4자리, 좌석</label>
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

      <section className="panel pagination-panel">
        <div className="pagination-bar">
          <div className="pagination-meta">
            <span>
              {items.length === 0
                ? "표시할 예약이 없습니다."
                : `${rangeStart.toLocaleString()}~${rangeEnd.toLocaleString()} / 전체 ${items.length.toLocaleString()}건`}
            </span>
            <span className="hint">
              페이지 {page.toLocaleString()} / {totalPages.toLocaleString()}
            </span>
          </div>
          <div className="pagination-controls">
            <label className="page-size-label" htmlFor="page-size">
              페이지당
            </label>
            <select
              id="page-size"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value) as 20 | 50);
                setPage(1);
              }}
            >
              <option value={20}>20명</option>
              <option value={50}>50명</option>
            </select>
            <button className="btn btn-secondary btn-small" disabled={page <= 1 || items.length === 0} type="button" onClick={() => setPage((p) => Math.max(1, p - 1))}>
              이전
            </button>
            <button className="btn btn-secondary btn-small" disabled={page >= totalPages || items.length === 0} type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              다음
            </button>
          </div>
        </div>
      </section>

      <div className="admin-cards-mobile" aria-label="예약 목록">
        {pageItems.length === 0 ? (
          <div className="reservation-card">검색 결과가 없습니다.</div>
        ) : (
          pageItems.map((item) => (
            <article className="reservation-card" key={item.id}>
              <div className="reservation-card-head">
                <strong>{item.name}</strong>
                <span className="reservation-card-seat">{item.seatCount}석</span>
              </div>
              <dl>
                <dt>좌석</dt>
                <dd>{item.seatDisplayNames.join(", ")}</dd>
                <dt>학생 소속교</dt>
                <dd>{item.schoolName || "-"}</dd>
                <dt>보호자 전화번호 뒤 4자리</dt>
                <dd>{item.phoneLast4}</dd>
                <dt>상태</dt>
                <dd>{item.status === "CONFIRMED" ? "예약 완료" : "취소"}</dd>
                <dt>예약 일시</dt>
                <dd>{item.createdAt ? new Date(item.createdAt).toLocaleString("ko-KR") : "-"}</dd>
              </dl>
              <div className="table-actions">
                <button className="btn btn-secondary btn-small" type="button" onClick={() => openEdit(item)}>
                  수정
                </button>
                <button className="btn btn-danger btn-small" type="button" onClick={() => removeReservation(item)}>
                  삭제
                </button>
              </div>
            </article>
          ))
        )}
      </div>

      <div className="table-wrap">
        <table className="admin-table-desktop">
          <thead>
            <tr>
              <th>학생 이름</th>
              <th>학생 소속교</th>
              <th>좌석 수</th>
              <th>좌석 위치</th>
              <th>보호자 전화번호 뒤 4자리</th>
              <th>상태</th>
              <th>예약 일시</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.schoolName || "-"}</td>
                <td>{item.seatCount}</td>
                <td>{item.seatDisplayNames.join(", ")}</td>
                <td>{item.phoneLast4}</td>
                <td>{item.status === "CONFIRMED" ? "예약 완료" : "취소"}</td>
                <td>{item.createdAt ? new Date(item.createdAt).toLocaleString("ko-KR") : "-"}</td>
                <td>
                  <div className="table-actions">
                    <button className="btn btn-secondary btn-small" type="button" onClick={() => openEdit(item)}>
                      수정
                    </button>
                    <button className="btn btn-danger btn-small" type="button" onClick={() => removeReservation(item)}>
                      삭제
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={8}>검색 결과가 없습니다.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
        </>
      )}

      {activeTab === "seats" && (
        <section className="panel admin-seat-status-panel">
          <div className="admin-seat-status-head">
            <div>
              <h1>좌석 현황</h1>
              <p className="hint">예약 가능, 예약 완료, 비활성 좌석을 실시간으로 확인합니다.</p>
            </div>
            <div className="legend admin-seat-legend">
              <span className="legend-item">
                <span className="swatch available-swatch" />
                예약 가능
              </span>
              <span className="legend-item">
                <span className="swatch reserved-swatch" />
                예약 완료
              </span>
              <span className="legend-item">
                <span className="swatch locked-swatch" />
                비활성
              </span>
            </div>
          </div>
          {seatMapError && <div className="error">{seatMapError}</div>}
          <div className="summary seat-status-summary">
            <div className="summary-card">
              <span>전체 좌석</span>
              <strong>{(seatMap?.total ?? 0).toLocaleString()}</strong>
            </div>
            <div className="summary-card">
              <span>예약 완료</span>
              <strong>{(seatMap?.reserved ?? 0).toLocaleString()}</strong>
            </div>
            <div className="summary-card">
              <span>비활성</span>
              <strong>{disabledSeatCount.toLocaleString()}</strong>
            </div>
            <div className="summary-card">
              <span>잔여 좌석</span>
              <strong>{availableSeatCount.toLocaleString()}</strong>
            </div>
          </div>
          <AdminSeatStatusMap seats={seatMap?.seats ?? []} />
        </section>
      )}

      {activeTab === "schedule" && (
        <section className="panel">
          <h1>예약 오픈 설정</h1>
          <p className="hint">지정한 시작 시간부터 종료 시간 전까지만 사용자 예약 화면과 예약 함수가 열립니다.</p>

          <div className="summary seat-status-summary">
            <div className="summary-card">
              <span>현재 상태</span>
              <strong>{gate ? (gate.phase === "OPEN" ? "오픈" : gate.phase === "ENDED" ? "종료" : "대기") : "-"}</strong>
            </div>
            <div className="summary-card">
              <span>오픈 시간</span>
              <strong>{gate ? formatKoreanDateTime(gate.opensAt) : "-"}</strong>
            </div>
            <div className="summary-card">
              <span>종료 시간</span>
              <strong>{gate ? formatKoreanDateTime(gate.closesAt) : "-"}</strong>
            </div>
            <div className="summary-card">
              <span>저장 일시</span>
              <strong>{gate?.updatedAt ? formatKoreanDateTime(gate.updatedAt) : "-"}</strong>
            </div>
          </div>

          <div className="field" style={{ marginTop: 16 }}>
            <label htmlFor="reservation-opens-at">예약 시작 날짜/시간</label>
            <input
              id="reservation-opens-at"
              type="datetime-local"
              value={gateForm}
              onChange={(e) => setGateForm(e.target.value)}
            />
            <span className="hint">비워두면 저장 즉시 시작된 것으로 처리합니다.</span>
          </div>

          <div className="field">
            <label htmlFor="reservation-closes-at">예약 종료 날짜/시간</label>
            <input
              id="reservation-closes-at"
              type="datetime-local"
              value={gateClosesAtForm}
              onChange={(e) => setGateClosesAtForm(e.target.value)}
            />
            <span className="hint">비워두면 종료 시간 없이 계속 오픈됩니다.</span>
          </div>

          {error && <div className="error">{error}</div>}
          {message && <div className="notice">{message}</div>}

          <div className="button-row">
            <button className="btn btn-primary" disabled={gateSaving} type="button" onClick={() => saveReservationGate()}>
              {gateSaving ? "저장 중" : "예약 가능 시간 저장"}
            </button>
            <button className="btn btn-secondary" disabled={gateSaving} type="button" onClick={openReservationNow}>
              즉시 오픈
            </button>
          </div>
        </section>
      )}

      {editing && (
        <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && setEditing(null)}>
          <div className="modal-card">
            <h2>예약 수정</h2>
            <div className="notice">현재 좌석: {editing.seatDisplayNames.join(", ")}</div>

            <div className="field">
              <label htmlFor="edit-name">학생 이름</label>
              <input id="edit-name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>

            <div className="field">
              <label htmlFor="edit-school">학생 소속교</label>
              <input id="edit-school" value={editForm.schoolName} onChange={(e) => setEditForm({ ...editForm, schoolName: e.target.value })} />
            </div>

            <div className="field">
              <label htmlFor="edit-phone">보호자 전화번호 뒤 4자리</label>
              <input
                id="edit-phone"
                inputMode="numeric"
                maxLength={4}
                value={editForm.phoneLast4}
                onChange={(e) => setEditForm({ ...editForm, phoneLast4: e.target.value.replace(/\D/g, "").slice(0, 4) })}
              />
            </div>

            <div className="field">
              <label htmlFor="edit-seat">좌석 위치</label>
              <input id="edit-seat" value={editForm.seatText} onChange={(e) => setEditForm({ ...editForm, seatText: e.target.value })} />
              <span className="hint">예: 1층 가0208, 2층 바0625. 기존 예약과 같은 좌석 수만 저장됩니다.</span>
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
