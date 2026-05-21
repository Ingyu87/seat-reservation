"use client";

import { useMemo, useState } from "react";
import {
  cancelReservation,
  changeReservationSeat,
  downloadReservationInfoPng,
  fetchSeatMap,
  lookupReservation,
  validatePhoneLast4
} from "@seat/shared";
import { SeatMap } from "@/app/components/SeatMap";
import type { LookupInput, ReservationSummary, Seat } from "@seat/shared";

const emptyLookup = { name: "", phoneLast4: "" };

export default function LookupPage() {
  const [form, setForm] = useState<LookupInput>(emptyLookup);
  const [found, setFound] = useState<ReservationSummary | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [changing, setChanging] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const selectedSeats = useMemo(
    () => selectedIds.map((id) => seats.find((seat) => seat.id === id)).filter((seat): seat is Seat => Boolean(seat)),
    [seats, selectedIds]
  );

  async function submitLookup() {
    setError("");
    setMessage("");
    setFound(null);

    if (!form.name.trim() || !validatePhoneLast4(form.phoneLast4)) {
      setError("이름과 전화번호 뒷자리 4자리를 다시 확인해 주세요.");
      return;
    }

    try {
      const result = await lookupReservation(form);
      setFound(result);
    } catch {
      setError("예약 정보를 찾을 수 없습니다. 입력 정보를 다시 확인해 주세요.");
    }
  }

  async function downloadPng() {
    if (!found) return;
    setError("");
    setDownloading(true);
    try {
      await downloadReservationInfoPng(found);
      setMessage("예약 정보 PNG 파일을 다운로드했습니다.");
    } catch {
      setError("PNG 다운로드에 실패했습니다.");
    } finally {
      setDownloading(false);
    }
  }

  async function openChangeSeat() {
    if (!found) return;
    setError("");
    setMessage("");
    const data = await fetchSeatMap();
    setSeats(data.seats);
    setSelectedIds([]);
    setChanging(true);
  }

  function toggleSeat(seat: Seat) {
    if (!found) return;
    setError("");
    setSelectedIds((current) => {
      if (current.includes(seat.id)) return current.filter((id) => id !== seat.id);
      if (current.length >= found.seatCount) {
        setError(`${found.seatCount}석까지만 선택할 수 있습니다.`);
        return current;
      }
      return [...current, seat.id];
    });
  }

  async function submitChangeSeat() {
    if (!found) return;
    if (selectedIds.length !== found.seatCount) {
      setError(`${found.seatCount}석을 모두 선택해 주세요.`);
      return;
    }

    setError("");
    setMessage("");

    try {
      const result = await changeReservationSeat({ ...form, newSeatIds: selectedIds });
      setMessage(`${result.seatDisplayNames.join(", ")}(으)로 좌석이 변경되었습니다.`);
      setChanging(false);
      setSelectedIds([]);
      await submitLookup();
    } catch {
      setError("좌석 변경 중 문제가 발생했습니다. 다른 좌석을 선택해 주세요.");
    }
  }

  async function submitCancel() {
    if (!window.confirm("예약을 취소하시겠습니까?")) return;

    setError("");
    setMessage("");

    try {
      await cancelReservation(form);
      setFound(null);
      setForm(emptyLookup);
      setMessage("예약이 취소되었습니다.");
    } catch {
      setError("예약 취소 중 문제가 발생했습니다.");
    }
  }

  return (
    <main className="page">
      <div className="lookup-wrap">
        <section className="panel">
          <h1>예약 조회</h1>
          <p className="hint">이름과 전화번호 뒷자리 4자리로 예약을 조회합니다.</p>

          <div className="field">
            <label htmlFor="lookup-name">이름</label>
            <input id="lookup-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>

          <div className="field">
            <label htmlFor="lookup-phone">전화번호 뒷자리 4자리</label>
            <input
              id="lookup-phone"
              inputMode="numeric"
              maxLength={4}
              value={form.phoneLast4}
              onChange={(e) => setForm({ ...form, phoneLast4: e.target.value.replace(/\D/g, "").slice(0, 4) })}
            />
          </div>

          {error && <div className="error">{error}</div>}
          {message && <div className="notice">{message}</div>}

          <button className="btn btn-primary" type="button" onClick={submitLookup}>
            조회하기
          </button>
        </section>

        {found && (
          <section className="panel lookup-ticket" style={{ marginTop: 16 }}>
            <h2>예약 정보</h2>
            <dl className="lookup-details">
              <div>
                <dt>예약자</dt>
                <dd>{found.name}</dd>
              </div>
              <div>
                <dt>좌석 수</dt>
                <dd>{found.seatCount}</dd>
              </div>
              <div>
                <dt>좌석</dt>
                <dd>{found.seats.map((seat) => seat.displayName).join(", ")}</dd>
              </div>
              <div>
                <dt>전화번호</dt>
                <dd>{found.phoneLast4}</dd>
              </div>
              <div>
                <dt>이메일</dt>
                <dd>{found.emailMasked}</dd>
              </div>
              {found.createdAt && (
                <div>
                  <dt>예약 일시</dt>
                  <dd>{new Date(found.createdAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</dd>
                </div>
              )}
            </dl>
            <div className="button-row">
              <button className="btn btn-secondary" disabled={downloading} type="button" onClick={downloadPng}>
                {downloading ? "저장 중" : "PNG 저장"}
              </button>
              <button className="btn btn-primary" type="button" onClick={openChangeSeat}>
                좌석 변경
              </button>
              <button className="btn btn-danger" type="button" onClick={submitCancel}>
                예약 취소
              </button>
            </div>
          </section>
        )}
      </div>

      {changing && found && (
        <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && setChanging(false)}>
          <div className="modal-card modal-wide">
            <h2>새 좌석 선택</h2>
            <p className="hint">
              기존 예약과 같은 {found.seatCount}석을 선택해 주세요. 현재 선택: {selectedIds.length}석
            </p>
            <p className="seat-map-scroll-hint" role="note">
              좌석도는 가로와 세로로 스크롤할 수 있습니다.
            </p>
            <div className="seat-panel change-seat-panel">
              <SeatMap seats={seats} selectedIds={selectedIds} onSelect={toggleSeat} />
            </div>
            <div className="selection-toolbar">
              <span>{selectedSeats.map((seat) => seat.displayName).join(", ") || "좌석을 선택해 주세요."}</span>
            </div>
            <div className="button-row" style={{ marginTop: 14 }}>
              <button className="btn btn-secondary" type="button" onClick={() => setChanging(false)}>
                닫기
              </button>
              <button className="btn btn-primary" disabled={selectedIds.length !== found.seatCount} type="button" onClick={submitChangeSeat}>
                변경 확정
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
