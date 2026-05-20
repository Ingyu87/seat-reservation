"use client";

import { useEffect, useState } from "react";
import { SeatMap } from "@/app/components/SeatMap";
import { fetchSeatMap, hasFirebaseConfig, reserveSeat } from "@/lib/firebase";
import { validatePhoneLast4 } from "@/lib/seat-utils";
import type { ReservationInput, Seat, SeatMapResponse } from "@/lib/types";

const initialForm = {
  name: "",
  phoneLast4: "",
  email: "",
  privacyConsent: false
};

export default function HomePage() {
  const [data, setData] = useState<SeatMapResponse | null>(null);
  const [selected, setSelected] = useState<Seat | null>(null);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const next = await fetchSeatMap();
    setData(next);
  }

  useEffect(() => {
    load().catch(() => setError("좌석 정보를 불러오지 못했습니다."));
    const timer = window.setInterval(() => {
      load().catch(() => undefined);
    }, 15000);
    return () => window.clearInterval(timer);
  }, []);

  const reserved = data?.reserved ?? 0;
  const total = data?.total ?? 0;

  async function submitReservation() {
    setError("");
    setMessage("");

    if (!selected) return;
    if (!form.name.trim()) {
      setError("이름을 입력해 주세요.");
      return;
    }
    if (!validatePhoneLast4(form.phoneLast4)) {
      setError("전화번호 뒤 4자리를 숫자로 입력해 주세요.");
      return;
    }
    if (!form.email.includes("@")) {
      setError("이메일 주소를 확인해 주세요.");
      return;
    }
    if (!form.privacyConsent) {
      setError("개인정보 수집 및 이용에 동의해 주세요.");
      return;
    }

    setSubmitting(true);
    try {
      const input: ReservationInput = {
        seatId: selected.id,
        name: form.name.trim(),
        phoneLast4: form.phoneLast4,
        email: form.email.trim(),
        privacyConsent: form.privacyConsent
      };
      const result = await reserveSeat(input);
      setMessage(`${result.seatDisplayName || selected.displayName} 좌석 예약이 완료되었습니다.`);
      setSelected(null);
      setForm(initialForm);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "예약 처리 중 오류가 발생했습니다.");
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page">
      {!hasFirebaseConfig && <div className="notice">Firebase 설정이 없어 데모 좌석으로 표시됩니다.</div>}

      <section className="summary" aria-label="좌석 현황">
        <div className="summary-card">
          <span>전체 좌석</span>
          <strong>{total.toLocaleString()}</strong>
        </div>
        <div className="summary-card">
          <span>예약 완료</span>
          <strong>{reserved.toLocaleString()}</strong>
        </div>
        <div className="summary-card">
          <span>잔여 좌석</span>
          <strong>{(total - reserved).toLocaleString()}</strong>
        </div>
      </section>

      {total === 0 && (
        <div className="notice">
          좌석 데이터가 아직 없습니다. 관리자 페이지에서 좌석 데이터 생성을 먼저 실행해 주세요.
        </div>
      )}
      {message && <div className="notice">{message}</div>}
      {error && <div className="error">{error}</div>}

      <div className="legend">
        <span className="legend-item">
          <span className="swatch" style={{ background: "#66BB6A" }} />
          예약 가능
        </span>
        <span className="legend-item">
          <span className="swatch" style={{ background: "#1565C0" }} />
          선택 좌석
        </span>
        <span className="legend-item">
          <span className="swatch" style={{ background: "#BDBDBD" }} />
          예약 완료
        </span>
      </div>

      <div className="stage">★ 무 대 ★</div>
      <section className="seat-panel" aria-label="좌석 배치도">
        <SeatMap
          seats={data?.seats ?? []}
          selectedId={selected?.id}
          onSelect={(seat) => {
            setSelected(seat);
            setForm(initialForm);
            setError("");
            setMessage("");
          }}
        />
      </section>
      <p className="seat-map-hint">좌석을 클릭하여 예약하세요 · 예약 조회는 이름과 전화번호 뒤 4자리로 할 수 있습니다</p>

      {selected && (
        <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && setSelected(null)}>
          <div className="modal-card">
            <h2>좌석 예약</h2>
            <div className="notice">선택 좌석: {selected.displayName}</div>

            <form autoComplete="off" onSubmit={(event) => event.preventDefault()}>
            <div className="field">
              <label htmlFor="reservation-name">이름 *</label>
              <input
                autoComplete="off"
                id="reservation-name"
                name="reservation-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="field">
              <label htmlFor="reservation-phone">전화번호 뒤 4자리 *</label>
              <input
                autoComplete="off"
                id="reservation-phone"
                inputMode="numeric"
                maxLength={4}
                name="reservation-phone"
                value={form.phoneLast4}
                onChange={(e) => setForm({ ...form, phoneLast4: e.target.value.replace(/\D/g, "").slice(0, 4) })}
              />
            </div>

            <div className="field">
              <label htmlFor="reservation-email">이메일 *</label>
              <input
                autoComplete="off"
                id="reservation-email"
                name="reservation-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>

            <label className="hint consent-row">
              <input
                checked={form.privacyConsent}
                type="checkbox"
                onChange={(e) => setForm({ ...form, privacyConsent: e.target.checked })}
              />
              개인정보 수집 및 이용에 동의합니다.
            </label>

            {error && <div className="error">{error}</div>}

            <div className="button-row">
              <button className="btn btn-secondary" type="button" onClick={() => setSelected(null)}>
                닫기
              </button>
              <button className="btn btn-primary" disabled={submitting} type="button" onClick={submitReservation}>
                {submitting ? "예약 중" : "예약하기"}
              </button>
            </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
