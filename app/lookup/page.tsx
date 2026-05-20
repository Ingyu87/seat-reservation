"use client";

import { useState } from "react";
import {
  cancelReservation,
  changeReservationSeat,
  downloadReservationInfoPng,
  fetchSeatMap,
  lookupReservation
} from "@seat/shared";
import { SeatMap } from "@/app/components/SeatMap";
import { validatePhoneLast4 } from "@seat/shared";
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
  const [selected, setSelected] = useState<Seat | null>(null);
  async function submitLookup() {
    setError("");
    setMessage("");
    setFound(null);

    if (!form.name.trim() || !validatePhoneLast4(form.phoneLast4)) {
      setError("이름과 전화번호 뒤 4자리를 다시 확인해 주세요.");
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
    setError("");
    setMessage("");
    const data = await fetchSeatMap();
    setSeats(data.seats);
    setChanging(true);
  }

  async function submitChangeSeat() {
    if (!selected) return;

    setError("");
    setMessage("");

    try {
      const result = await changeReservationSeat({ ...form, newSeatId: selected.id });
      setMessage(`${result.seatDisplayName}으로 좌석이 변경되었습니다.`);
      setChanging(false);
      setSelected(null);
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
          <p className="hint">이름과 전화번호 뒤 4자리로 예약을 조회합니다.</p>

          <div className="field">
            <label htmlFor="lookup-name">이름</label>
            <input id="lookup-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>

          <div className="field">
            <label htmlFor="lookup-phone">전화번호 뒤 4자리</label>
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
                <dt>좌석</dt>
                <dd>{found.seat.displayName}</dd>
              </div>
              <div>
                <dt>전화번호 뒤 4자리</dt>
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

      {changing && (
        <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && setChanging(false)}>
          <div className="modal-card" style={{ width: "min(960px, 100%)" }}>
            <h2>새 좌석 선택</h2>
            <p className="hint">예약 가능한 좌석을 선택한 뒤 변경을 확정해 주세요.</p>
            <p className="seat-map-scroll-hint" role="note">
              좌석도는 가로·세로로 스크롤해 탐색할 수 있습니다.
            </p>
            <div className="seat-panel" style={{ maxHeight: 420 }}>
              <SeatMap seats={seats} selectedId={selected?.id} onSelect={setSelected} />
            </div>
            <div className="button-row" style={{ marginTop: 14 }}>
              <button className="btn btn-secondary" type="button" onClick={() => setChanging(false)}>
                닫기
              </button>
              <button className="btn btn-primary" disabled={!selected} type="button" onClick={submitChangeSeat}>
                변경 확정
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
