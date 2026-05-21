"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SeatMap } from "@/app/components/SeatMap";
import {
  downloadReservationInfoPng,
  fetchSeatMap,
  hasFirebaseConfig,
  MAX_SEATS_PER_RESERVATION,
  reserveSeat,
  validatePhoneLast4
} from "@seat/shared";
import type { ReservationInput, ReservationSummary, Seat, SeatMapResponse } from "@seat/shared";

type ReservationForm = Omit<ReservationInput, "seatIds"> & {
  seatCount: number;
};

const initialForm: ReservationForm = {
  name: "",
  phoneLast4: "",
  email: "",
  seatCount: 1,
  privacyConsent: false
};

export default function HomePage() {
  const [data, setData] = useState<SeatMapResponse | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [form, setForm] = useState(initialForm);
  const [step, setStep] = useState<"form" | "seats">("form");
  const [confirming, setConfirming] = useState(false);
  const [completed, setCompleted] = useState<ReservationSummary | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    const next = await fetchSeatMap();
    setData(next);
    setLoading(false);
  }

  useEffect(() => {
    load().catch(() => setError("좌석 정보를 불러오지 못했습니다."));

    let timer: number | null = null;

    function startTimer() {
      timer = window.setInterval(() => {
        load().catch(() => undefined);
      }, 15000);
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        if (timer !== null) {
          window.clearInterval(timer);
          timer = null;
        }
      } else {
        load().catch(() => undefined);
        startTimer();
      }
    }

    startTimer();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (timer !== null) window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const seats = data?.seats ?? [];
  const selectedSeats = useMemo(
    () => selectedIds.map((id) => seats.find((seat) => seat.id === id)).filter((seat): seat is Seat => Boolean(seat)),
    [seats, selectedIds]
  );
  const reserved = data?.reserved ?? 0;
  const total = data?.total ?? 0;
  const available = Math.max(0, total - reserved);

  function validateForm() {
    if (!form.name.trim()) return "이름을 입력해 주세요.";
    if (!validatePhoneLast4(form.phoneLast4)) return "전화번호 뒷자리 4자리를 숫자로 입력해 주세요.";
    if (!form.email.includes("@")) return "이메일 주소를 확인해 주세요.";
    if (!Number.isInteger(form.seatCount) || form.seatCount < 1 || form.seatCount > MAX_SEATS_PER_RESERVATION) {
      return `예약 좌석 수는 1~${MAX_SEATS_PER_RESERVATION}석까지 가능합니다.`;
    }
    if (!form.privacyConsent) return "개인정보 수집 및 이용에 동의해 주세요.";
    return "";
  }

  function goSeatStep() {
    const validation = validateForm();
    setError(validation);
    setMessage("");
    setCompleted(null);
    if (validation) return;
    setSelectedIds([]);
    setStep("seats");
  }

  function toggleSeat(seat: Seat) {
    setError("");
    setMessage("");
    setCompleted(null);
    setSelectedIds((current) => {
      if (current.includes(seat.id)) return current.filter((id) => id !== seat.id);
      if (current.length >= form.seatCount) {
        setError(`${form.seatCount}석까지만 선택할 수 있습니다.`);
        return current;
      }
      return [...current, seat.id];
    });
  }

  function openConfirm() {
    setError("");
    if (selectedIds.length !== form.seatCount) {
      setError(`${form.seatCount}석을 모두 선택해 주세요.`);
      return;
    }
    setConfirming(true);
  }

  async function submitReservation() {
    setError("");
    setMessage("");
    setSubmitting(true);

    try {
      const input: ReservationInput = {
        seatIds: selectedIds,
        name: form.name.trim(),
        phoneLast4: form.phoneLast4,
        email: form.email.trim(),
        privacyConsent: form.privacyConsent
      };
      const result = await reserveSeat(input);
      const seatDisplayNames = result.seatDisplayNames.length
        ? result.seatDisplayNames
        : selectedSeats.map((seat) => seat.displayName);
      const summary: ReservationSummary = {
        reservationId: result.reservationId,
        name: input.name,
        phoneLast4: input.phoneLast4,
        emailMasked: input.email.replace(/^(.).*@/, "$1***@"),
        seatCount: seatDisplayNames.length,
        seats: seatDisplayNames.map((displayName, index) => ({ displayName, id: selectedIds[index] })),
        seat: { displayName: seatDisplayNames[0] ?? "-", id: selectedIds[0] },
        status: "CONFIRMED",
        createdAt: new Date().toISOString()
      };
      setCompleted(summary);
      setMessage("예약이 완료되었습니다. 아래에서 예약 카드를 다운로드할 수 있습니다.");
      setConfirming(false);
      setStep("form");
      setSelectedIds([]);
      setForm(initialForm);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "예약 처리 중 오류가 발생했습니다.");
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  async function downloadCompletedCard() {
    if (!completed) return;
    await downloadReservationInfoPng(completed);
  }

  return (
    <main className="page">
      {!hasFirebaseConfig && <div className="notice">Firebase 설정이 없어 데모 좌석으로 표시합니다.</div>}

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
          <strong>{available.toLocaleString()}</strong>
        </div>
      </section>

      {loading && <div className="notice">좌석 배치도를 준비하고 있습니다.</div>}
      {!loading && total === 0 && !error && <div className="notice">좌석 정보를 불러오지 못했습니다.</div>}
      {message && <div className="notice">{message}</div>}
      {error && <div className="error">{error}</div>}

      {completed && (
        <section className="panel reservation-complete">
          <h2>예약 완료</h2>
          <dl className="lookup-details">
            <div>
              <dt>예약자</dt>
              <dd>{completed.name}</dd>
            </div>
            <div>
              <dt>좌석</dt>
              <dd>{completed.seats.map((seat) => seat.displayName).join(", ")}</dd>
            </div>
          </dl>
          <button className="btn btn-primary" type="button" onClick={downloadCompletedCard}>
            예약 카드 다운로드
          </button>
        </section>
      )}

      {step === "form" && (
        <section className="panel reservation-form">
          <h1>예약자 정보</h1>
          <div className="field">
            <label htmlFor="reservation-name">이름 *</label>
            <input
              autoComplete="off"
              id="reservation-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="reservation-phone">전화번호 뒷자리 4자리 *</label>
            <input
              autoComplete="off"
              id="reservation-phone"
              inputMode="numeric"
              maxLength={4}
              value={form.phoneLast4}
              onChange={(e) => setForm({ ...form, phoneLast4: e.target.value.replace(/\D/g, "").slice(0, 4) })}
            />
          </div>
          <div className="field">
            <label htmlFor="reservation-email">이메일 *</label>
            <input
              autoComplete="off"
              id="reservation-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="field">
            <span className="field-label">예약 좌석 수 *</span>
            <div className="seat-count-picker" role="radiogroup" aria-label="예약 좌석 수">
              {Array.from({ length: MAX_SEATS_PER_RESERVATION }, (_, index) => index + 1).map((count) => (
                <button
                  aria-checked={form.seatCount === count}
                  className={form.seatCount === count ? "active" : ""}
                  key={count}
                  role="radio"
                  type="button"
                  onClick={() => setForm({ ...form, seatCount: count })}
                >
                  {count}석
                </button>
              ))}
            </div>
          </div>
          <label className="hint consent-row">
            <input
              checked={form.privacyConsent}
              type="checkbox"
              onChange={(e) => setForm({ ...form, privacyConsent: e.target.checked })}
            />
            [필수] 개인정보 수집 및 이용에 동의합니다.{" "}
            <Link href="/privacy" target="_blank">
              처리방침
            </Link>
          </label>
          <button className="btn btn-primary" type="button" onClick={goSeatStep}>
            좌석 선택하기
          </button>
        </section>
      )}

      {step === "seats" && (
        <section className="seat-selection-layout" aria-label="좌석 선택">
          <div className="seat-selection-main">
            <p className="seat-map-scroll-hint" role="note">
              좌석도는 가로와 세로로 스크롤할 수 있습니다. 확대 버튼으로 좌석을 크게 보고 선택해 주세요.
            </p>
            <section className="seat-panel auditorium-panel" aria-label="좌석 배치도">
              <SeatMap seats={seats} selectedIds={selectedIds} onSelect={toggleSeat} />
            </section>
          </div>

          <aside className="seat-selection-sidebar" aria-label="선택 좌석 정보">
            <div className="mini-stage-card">
              <div className="mini-stage">STAGE</div>
              <div className="mini-map-dot">1F / 2F</div>
            </div>
            <div className="legend sidebar-legend">
              <span className="legend-item">
                <span className="swatch available-swatch" />
                예약 가능
              </span>
              <span className="legend-item">
                <span className="swatch selected-swatch" />
                선택 좌석
              </span>
              <span className="legend-item">
                <span className="swatch reserved-swatch" />
                예약 완료
              </span>
            </div>
            <dl className="seat-count-list">
              <div>
                <dt>전체 좌석</dt>
                <dd>{total.toLocaleString()}</dd>
              </div>
              <div>
                <dt>잔여 좌석</dt>
                <dd>{available.toLocaleString()}</dd>
              </div>
              <div>
                <dt>선택 좌석</dt>
                <dd>
                  {selectedIds.length} / {form.seatCount}
                </dd>
              </div>
            </dl>
            <div className="selected-seat-list" aria-live="polite">
              {selectedSeats.length === 0 ? (
                <span className="empty-selected">좌석을 선택해 주세요.</span>
              ) : (
                selectedSeats.map((seat) => (
                  <button
                    aria-label={`${seat.displayName} 선택 취소`}
                    className="selected-seat-chip"
                    key={seat.id}
                    type="button"
                    onClick={() => toggleSeat(seat)}
                  >
                    {seat.displayName}
                    <span aria-hidden>×</span>
                  </button>
                ))
              )}
            </div>
            <div className="button-row">
              <button className="btn btn-secondary" type="button" onClick={() => setStep("form")}>
                이전
              </button>
              <button className="btn btn-primary" type="button" onClick={openConfirm}>
                선택 완료
              </button>
            </div>
          </aside>
        </section>
      )}

      {confirming && (
        <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && setConfirming(false)}>
          <div className="modal-card">
            <h2>예약 확인</h2>
            <dl className="lookup-details">
              <div>
                <dt>이름</dt>
                <dd>{form.name}</dd>
              </div>
              <div>
                <dt>전화번호</dt>
                <dd>{form.phoneLast4}</dd>
              </div>
              <div>
                <dt>이메일</dt>
                <dd>{form.email}</dd>
              </div>
              <div>
                <dt>좌석</dt>
                <dd>{selectedSeats.map((seat) => seat.displayName).join(", ")}</dd>
              </div>
            </dl>
            <p className="hint">이대로 예약 완료하시겠습니까?</p>
            <div className="button-row">
              <button className="btn btn-secondary" type="button" onClick={() => setConfirming(false)}>
                아니오
              </button>
              <button className="btn btn-primary" disabled={submitting} type="button" onClick={submitReservation}>
                {submitting ? "예약 중" : "예"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
