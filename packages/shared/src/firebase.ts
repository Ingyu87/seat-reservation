"use client";

import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import { generateDemoSeats, SEAT_LAYOUT, SEAT_LAYOUT_TOTAL } from "./seat-utils";
import type {
  AdminReservation,
  AdminUpdateReservationInput,
  LookupInput,
  ReservationEligibility,
  ReservationInput,
  ReservationSummary,
  SeatMapResponse
} from "./types";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

export const hasFirebaseConfig = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId
);

const app = hasFirebaseConfig && getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const firebaseApp = app;
export const auth = hasFirebaseConfig && app ? getAuth(app) : null;
const functions = hasFirebaseConfig && app ? getFunctions(app, "asia-northeast3") : null;

type SeatMapWireResponse = SeatMapResponse | {
  total: number;
  reserved: number;
  reservedSeatIds?: string[];
  seats?: Array<Partial<SeatMapResponse["seats"][number]> & { id: string; status?: string }>;
};

export function getCallableErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message?: string }).message ?? "").trim();
    if (message) return message;
  }

  return fallback;
}

async function callFunction<TInput, TOutput>(name: string, input?: TInput): Promise<TOutput> {
  if (!functions) {
    throw new Error("Firebase 설정이 없습니다.");
  }

  const callable = httpsCallable<TInput | undefined, TOutput>(functions, name);
  const result = await callable(input);
  return result.data;
}

export async function fetchSeatMap(): Promise<SeatMapResponse> {
  if (!functions) {
    const seats = generateDemoSeats();
    return { total: seats.length, reserved: 0, seats };
  }

  const result = await callFunction<undefined, SeatMapWireResponse>("getSeatMap");
  const hasFullSeatMap = Array.isArray(result.seats) && result.seats.every((seat) => typeof seat.displayName === "string");

  if (hasFullSeatMap) {
    return result as SeatMapResponse;
  }

  const reservedIds = new Set(
    result.reservedSeatIds ??
      (result.seats ?? [])
        .filter((seat) => seat.status === "RESERVED")
        .map((seat) => seat.id)
  );
  const seats = SEAT_LAYOUT.map((seat, index) => ({
    ...seat,
    disabled: Boolean(seat.disabled),
    sortOrder: index + 1,
    status: reservedIds.has(seat.id) ? "RESERVED" as const : "AVAILABLE" as const
  }));

  return {
    total: result.total || SEAT_LAYOUT_TOTAL,
    reserved: result.reserved ?? reservedIds.size,
    reservedSeatIds: Array.from(reservedIds),
    seats
  };
}

export async function reserveSeat(input: ReservationInput) {
  if (!functions) {
    return {
      reservationId: "demo",
      seatDisplayNames: input.seatIds
    };
  }

  return callFunction<ReservationInput, { reservationId: string; seatDisplayNames: string[] }>("reserveSeat", input);
}

export async function lookupReservation(input: LookupInput) {
  return callFunction<LookupInput, ReservationSummary>("lookupReservation", input);
}

export async function verifyReservationEligibility(input: LookupInput) {
  return callFunction<LookupInput, ReservationEligibility>("verifyReservationEligibility", input);
}

export async function changeReservationSeat(input: LookupInput & { newSeatIds: string[] }) {
  return callFunction<typeof input, { seatDisplayNames: string[] }>("changeSeat", input);
}

export async function cancelReservation(input: LookupInput) {
  return callFunction<LookupInput, { ok: boolean }>("cancelReservation", input);
}

export async function adminSearchReservations(query: string) {
  return callFunction<{ query: string }, { items: AdminReservation[] }>("adminSearchReservations", { query });
}

export async function adminDeleteReservation(reservationId: string) {
  return callFunction<{ reservationId: string }, { ok: boolean }>("adminDeleteReservation", { reservationId });
}

export async function adminUpdateReservation(input: AdminUpdateReservationInput) {
  return callFunction<AdminUpdateReservationInput, AdminReservation>("adminUpdateReservation", input);
}

export async function adminResetAllReservations() {
  return callFunction<undefined, { deleted: number; canceled: number; released: number }>("adminResetAllReservations");
}

export async function seedSeats() {
  return callFunction<undefined, { total: number; created: number; updated: number }>("seedSeats");
}
