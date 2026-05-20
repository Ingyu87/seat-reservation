"use client";

import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import { generateDemoSeats } from "./seat-utils";
import type {
  AdminReservation,
  AdminUpdateReservationInput,
  LookupInput,
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

export const auth = hasFirebaseConfig && app ? getAuth(app) : null;
const functions = hasFirebaseConfig && app ? getFunctions(app, "asia-northeast3") : null;

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

  return callFunction<undefined, SeatMapResponse>("getSeatMap");
}

export async function reserveSeat(input: ReservationInput) {
  if (!functions) {
    return {
      reservationId: "demo",
      seatDisplayName: "데모 좌석"
    };
  }

  return callFunction<ReservationInput, { reservationId: string; seatDisplayName: string }>("reserveSeat", input);
}

export async function lookupReservation(input: LookupInput) {
  return callFunction<LookupInput, ReservationSummary>("lookupReservation", input);
}

export async function changeReservationSeat(input: LookupInput & { newSeatId: string }) {
  return callFunction<typeof input, { seatDisplayName: string }>("changeSeat", input);
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
  return callFunction<undefined, { canceled: number; released: number }>("adminResetAllReservations");
}

export async function seedSeats() {
  return callFunction<undefined, { total: number; created: number; updated: number }>("seedSeats");
}
