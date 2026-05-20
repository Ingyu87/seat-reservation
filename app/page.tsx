"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchSeatMap, hasFirebaseConfig, reserveSeat } from "@/lib/firebase";
import { groupSeatsByRow, validatePhoneLast4 } from "@/lib/seat-utils";
import type { ReservationInput, Seat, SeatMapResponse } from "@/lib/types";

const initialForm = {
  name: "",
  phoneLast4: "",
  email: "",
  editPassword: "",
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

  const rows = useMemo(() => groupSeatsByRow(data?.seats ?? []), [data]);
  const reserved = data?.reserved ?? 0;
  const total = data?.total ?? 2500;

  async function submitReservation() {
    setError("");
    setMessage("");

    if (!selected) return;
    if (!form.name.trim()) {
      setError("이름을 입력해주세요.");
      return;
    }
    if (!validatePhoneLast4(form.phoneLast4)) {
      setError("전화번호 뒤 4자리를 숫자로 입력해주세요.");
      return;
    }
    if (!form.email.includes("@")) {
      setError("이메일을 정확히 입력해주세요.");
      return;
    }
    if (form.editPassword.length < 4) {
      setError("수정 비밀번호는 4자리 이상 입력해주세요.");
      return;
    }
    if (form.editPassword === form.phoneLast4) {
      setError("수정 비밀번호는 전화번호 뒤 4자리와 다르게 입력해주세요.");
      return;
    }
    if (!form.privacyConsent) {
      setError("개인정보 수집 및 이용에 동의해주세요.");
      return;
    }

    setSubmitting(true);
    try {
      const input: ReservationInput = {
        seatId: selected.id,
        name: form.name.trim(),
        phoneLast4: form.phoneLast4,
        email: form.email.trim(),
        editPassword: form.editPassword,
        privacyConsent: form.privacyConsent
      };
      const result = await reserveSeat(input);
      setMessage(`${result.seatDisplayName || selected.displayName} 예약이 완료되었습니다.`);
      setSelected(null);
      setForm(initialForm);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "예약 중 문제가 발생했습니다.");
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page">
      {!hasFirebaseConfig && (
        <div className="notice">
          Firebase 환경 변수가 없어 데모 좌석으로 표시 중입니다. 실제 예약 저장은 Firebase 연결 후 동작합니다.
        </div>
      )}

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

      <div className="stage">무대</div>
      <section className="seat-panel" aria-label="좌석 배치도">
        {Object.entries(rows).map(([label, seats]) => (
          <div className="seat-row" key={label}>
            <div className="row-label">{label}</div>
            {seats.map((seat, index) => (
              <button
                aria-label={`${seat.displayName}, ${seat.status === "AVAILABLE" ? "예약 가능" : "예약 완료"}`}
                className={[
                  "seat-cell",
                  seat.status.toLowerCase(),
                  selected?.id === seat.id ? "selected" : ""
                ].join(" ")}
                disabled={seat.status !== "AVAILABLE"}
                key={seat.id}
                style={index === 24 ? { marginRight: 10 } : undefined}
                title={seat.displayName}
                type="button"
                onClick={() => {
                  setSelected(seat);
                  setError("");
                  setMessage("");
                }}
              />
            ))}
          </div>
        ))}
      </section>

      {selected && (
        <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && setSelected(null)}>
          <div className="modal-card">
            <h2>좌석 예약</h2>
            <div className="notice">선택 좌석: {selected.displayName}</div>

            <div className="field">
              <label htmlFor="name">이름 *</label>
              <input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>

            <div className="field">
              <label htmlFor="phoneLast4">전화번호 뒤 4자리 *</label>
              <input
                id="phoneLast4"
                inputMode="numeric"
                maxLength={4}
                value={form.phoneLast4}
                onChange={(e) => setForm({ ...form, phoneLast4: e.target.value.replace(/\D/g, "").slice(0, 4) })}
              />
            </div>

            <div className="field">
              <label htmlFor="email">이메일 *</label>
              <input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>

            <div className="field">
              <label htmlFor="editPassword">수정 비밀번호 *</label>
              <input
                id="editPassword"
                type="password"
                value={form.editPassword}
                onChange={(e) => setForm({ ...form, editPassword: e.target.value })}
              />
              <span className="hint">예약 조회, 좌석 변경, 예약 취소에 사용됩니다. 전화번호 뒤 4자리와 다르게 입력해주세요.</span>
            </div>

            <label className="hint" style={{ display: "flex", gap: 8, margin: "12px 0" }}>
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
                취소
              </button>
              <button className="btn btn-primary" disabled={submitting} type="button" onClick={submitReservation}>
                {submitting ? "예약 중" : "예약하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
