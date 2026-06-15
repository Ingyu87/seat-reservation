"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SeatMap } from "@/app/components/SeatMap";
import {
  DISABLED_SEAT_IDS,
  fetchSeatMap,
  getReservationGateSettings,
  hasFirebaseConfig,
  isSeatDisabled,
  lookupReservation,
  reserveSeat,
  validatePhoneLast4,
  verifyReservationEligibility
} from "@seat/shared";
import type { ReservationInput, Seat, SeatMapResponse } from "@seat/shared";
import type { ReservationGateSettings } from "@seat/shared";

type ReservationForm = Omit<ReservationInput, "seatIds"> & {
  seatCount: number;
};

const initialForm: ReservationForm = {
  name: "",
  schoolName: "",
  phoneLast4: "",
  seatCount: 1,
  privacyConsent: false
};

function formatKoreanDateTime(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "long",
    timeStyle: "short"
  });
}

function getReservationClosedMessage(gate: ReservationGateSettings | null) {
  if (!gate) return "";
  if (gate.phase === "ENDED") {
    return `예약 가능 시간이 ${formatKoreanDateTime(gate.closesAt)}에 종료되었습니다.`;
  }
  if (gate.opensAt && gate.closesAt) {
    return `예약은 ${formatKoreanDateTime(gate.opensAt)}부터 ${formatKoreanDateTime(gate.closesAt)}까지만 가능합니다.`;
  }
  if (gate.opensAt) {
    return `예약은 ${formatKoreanDateTime(gate.opensAt)}부터 가능합니다.`;
  }
  if (gate.closesAt) {
    return `예약은 ${formatKoreanDateTime(gate.closesAt)}까지만 가능합니다.`;
  }
  return "현재 예약할 수 없습니다.";
}

export default function HomePage() {
  const [data, setData] = useState<SeatMapResponse | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [form, setForm] = useState(initialForm);
  const [step, setStep] = useState<"form" | "seats">("form");
  const [confirming, setConfirming] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkingReservation, setCheckingReservation] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [gate, setGate] = useState<ReservationGateSettings | null>(null);
  const [gateLoading, setGateLoading] = useState(false);

  async function load(showLoading = false) {
    if (showLoading) setLoading(true);
    try {
      const next = await fetchSeatMap();
      setData(next);
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  useEffect(() => {
    if (!hasFirebaseConfig) return;

    setGateLoading(true);
    getReservationGateSettings()
      .then(setGate)
      .catch(() => undefined)
      .finally(() => setGateLoading(false));
  }, []);

  useEffect(() => {
    if (step !== "seats") return;

    load(true).catch(() => setError("좌석 정보를 불러오지 못했습니다."));

    let timer: number | null = null;

    function startTimer() {
      timer = window.setInterval(() => {
        load().catch(() => undefined);
      }, 30000);
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
  }, [step]);

  const seats = data?.seats ?? [];
  const selectedSeats = useMemo(
    () => selectedIds.map((id) => seats.find((seat) => seat.id === id)).filter((seat): seat is Seat => Boolean(seat)),
    [seats, selectedIds]
  );
  const reserved = data?.reserved ?? 0;
  const total = data?.total ?? 0;
  const disabledCount = useMemo(
    () => seats.filter((seat) => seat.status === "AVAILABLE" && isSeatDisabled(seat.id)).length,
    [seats]
  );
  const available = Math.max(0, total - reserved - disabledCount);
  const reservationClosed = Boolean(gate && !gate.isOpen);
  const reservationClosedMessage = getReservationClosedMessage(gate);

  function validateForm() {
    if (!form.name.trim()) return "학생 이름을 입력해 주세요.";
    if (!form.schoolName.trim()) return "학생 소속교(정식 명칭)를 입력해 주세요.";
    if (!validatePhoneLast4(form.phoneLast4)) return "보호자 전화번호 뒤 4자리를 숫자로 입력해 주세요.";
    if (!form.privacyConsent) return "개인정보 수집 및 이용에 동의해 주세요.";
    return "";
  }

  function isReservationNotFound(error: unknown) {
    if (!error || typeof error !== "object") return false;
    const code = "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
    const message = "message" in error ? String((error as { message?: unknown }).message ?? "") : "";
    return code === "functions/not-found" || message.includes("Reservation was not found");
  }

  function isSeatConflict(error: unknown) {
    if (!error || typeof error !== "object") return false;
    const code = "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
    const message = "message" in error ? String((error as { message?: unknown }).message ?? "") : "";
    return code === "functions/already-exists" || message.includes("Seat is already reserved");
  }

  async function goSeatStep() {
    const validation = validateForm();
    setError(validation);
    setMessage("");
    setCompleted(false);
    if (validation) return;
    if (reservationClosed) {
      setError(reservationClosedMessage);
      return;
    }

    let allowedSeatCount = form.seatCount;
    let nextForm = form;

    if (hasFirebaseConfig) {
      setCheckingReservation(true);
      try {
        const eligibility = await verifyReservationEligibility({
          name: form.name.trim(),
          schoolName: form.schoolName.trim(),
          phoneLast4: form.phoneLast4
        });
        allowedSeatCount = eligibility.seatCount;
        nextForm = {
          ...form,
          name: eligibility.name,
          schoolName: eligibility.schoolName,
          phoneLast4: eligibility.phoneLast4,
          seatCount: eligibility.seatCount
        };

        await lookupReservation({
          name: nextForm.name,
          schoolName: nextForm.schoolName,
          phoneLast4: nextForm.phoneLast4
        });
        setError("이미 예약된 정보가 있습니다. 예약 조회에서 확인해 주세요.");
        setSelectedIds([]);
        return;
      } catch (err) {
        if (!isReservationNotFound(err)) {
          const message = err instanceof Error ? err.message : "";
          setError(message || "신청 명단에 없는 정보입니다. 학생 이름, 소속교 정식 명칭, 전화번호 뒤 4자리를 확인해 주세요.");
          return;
        }
      } finally {
        setCheckingReservation(false);
      }
    }

    setForm(nextForm);
    setSelectedIds([]);
    setMessage(`명단 확인 완료: ${allowedSeatCount}석 예약 가능합니다.`);
    setStep("seats");
  }

  function toggleSeat(seat: Seat) {
    setError("");
    setMessage("");
    setCompleted(false);
    if (isSeatDisabled(seat.id) && !selectedIds.includes(seat.id)) {
      setError("선택할 수 없는 좌석입니다.");
      return;
    }
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
        schoolName: form.schoolName.trim(),
        phoneLast4: form.phoneLast4,
        privacyConsent: form.privacyConsent
      };
      await reserveSeat(input);
      setCompleted(true);
      setMessage("");
      setConfirming(false);
      setStep("form");
      setSelectedIds([]);
      setForm(initialForm);
      setData(null);
    } catch (err) {
      setError(
        isSeatConflict(err)
          ? "다른 사용자가 먼저 예약한 좌석입니다. 좌석 현황을 새로 불러왔습니다."
          : err instanceof Error
            ? err.message
            : "예약 처리 중 오류가 발생했습니다."
      );
      await load(true).catch(() => undefined);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page">
      {!hasFirebaseConfig && <div className="notice">Firebase 설정이 없어 데모 좌석으로 표시합니다.</div>}
      {gateLoading && <div className="notice">예약 오픈 시간을 확인하는 중입니다.</div>}

      {step === "seats" && loading && <div className="notice">좌석 배치도를 준비하고 있습니다.</div>}
      {step === "seats" && !loading && total === 0 && !error && <div className="notice">좌석 정보를 불러오지 못했습니다.</div>}
      {message && <div className="notice">{message}</div>}
      {error && <div className="error">{error}</div>}

      {completed && (
        <section className="panel reservation-complete">
          <h2>예약 완료</h2>
          <p className="hint">예약이 완료되었습니다.</p>
          <button className="btn btn-primary" type="button" onClick={() => setCompleted(false)}>
            종료
          </button>
        </section>
      )}

      {step === "form" && reservationClosed && (
        <section className="panel reservation-form">
          <h1>{gate?.phase === "ENDED" ? "예약 종료" : "예약 오픈 예정"}</h1>
          <p className="hint">현재 좌석 예약을 진행할 수 없습니다.</p>
          <div className="notice">{reservationClosedMessage}</div>
          <Link className="btn btn-secondary" href="/lookup">
            예약 조회
          </Link>
        </section>
      )}

      {step === "form" && !reservationClosed && (
        <section className="panel reservation-form">
          <h1>예약 정보</h1>
          <div className="field">
            <label htmlFor="reservation-name">학생 이름 *</label>
            <input
              autoComplete="off"
              id="reservation-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="reservation-school">학생 소속교(정식 명칭) *</label>
            <input
              autoComplete="off"
              id="reservation-school"
              value={form.schoolName}
              onChange={(e) => setForm({ ...form, schoolName: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="reservation-phone">보호자 전화번호 뒤 4자리 *</label>
            <input
              autoComplete="off"
              id="reservation-phone"
              inputMode="numeric"
              maxLength={4}
              value={form.phoneLast4}
              onChange={(e) => setForm({ ...form, phoneLast4: e.target.value.replace(/\D/g, "").slice(0, 4) })}
            />
          </div>
          <p className="hint">명단 확인 후 예약 가능한 좌석 수가 자동 적용됩니다.</p>
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
          <div className="button-row form-actions">
            <button className="btn btn-primary" disabled={checkingReservation} type="button" onClick={goSeatStep}>
              {checkingReservation ? "예약 확인 중" : "좌석 선택하기"}
            </button>
            <Link className="btn btn-secondary" href="/lookup">
              예약 조회
            </Link>
          </div>
        </section>
      )}

      {step === "seats" && (
        <section className="seat-selection-layout" aria-label="좌석 선택">
          <div className="seat-selection-main">
            <p className="seat-map-scroll-hint" role="note">
              좌석도는 가로와 세로로 스크롤할 수 있습니다. 확대 버튼으로 좌석을 크게 보고 선택해 주세요.
            </p>
            <section className="seat-panel auditorium-panel" aria-label="좌석 배치도">
              <SeatMap seats={seats} selectedIds={selectedIds} disabledIds={DISABLED_SEAT_IDS} onSelect={toggleSeat} />
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
              <span className="legend-item">
                <span className="swatch locked-swatch" />
                선택 불가
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
                <dt>학생 이름</dt>
                <dd>{form.name}</dd>
              </div>
              <div>
                <dt>학생 소속교</dt>
                <dd>{form.schoolName}</dd>
              </div>
              <div>
                <dt>보호자 전화번호 뒤 4자리</dt>
                <dd>{form.phoneLast4}</dd>
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
