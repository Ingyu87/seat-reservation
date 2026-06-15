export type SeatStatus = "AVAILABLE" | "RESERVED";

export type Seat = {
  id: string;
  floor: "F1" | "F2";
  floorLabel: string;
  label: string;
  area: string;
  seatRow: number;
  seatNumber: number;
  gridRow: number;
  gridColumn: number;
  displayName: string;
  sortOrder: number;
  status: SeatStatus;
  disabled?: boolean;
};

export type SeatMapResponse = {
  total: number;
  reserved: number;
  seats: Seat[];
  reservedSeatIds?: string[];
};

export type ReservationInput = {
  seatIds: string[];
  name: string;
  schoolName: string;
  phoneLast4: string;
  privacyConsent: boolean;
};

export type LookupInput = {
  name: string;
  schoolName: string;
  phoneLast4: string;
};

export type ReservationEligibility = {
  name: string;
  schoolName: string;
  phoneLast4: string;
  seatCount: number;
};

export type ReservationGateSettings = {
  opensAt?: string | null;
  closesAt?: string | null;
  isOpen: boolean;
  phase: "BEFORE_OPEN" | "OPEN" | "ENDED";
  now: string;
  updatedAt?: string;
};

export type ReservationSummary = {
  reservationId: string;
  name: string;
  schoolName: string;
  phoneLast4: string;
  seatCount: number;
  seats: Array<{
    displayName: string;
    id?: string;
  }>;
  seat: {
    displayName: string;
    id?: string;
  };
  status: "CONFIRMED" | "CANCELED";
  createdAt?: string;
};

export type AdminReservation = {
  id: string;
  name: string;
  schoolName: string;
  phoneLast4: string;
  seatIds: string[];
  seatDisplayNames: string[];
  seatCount: number;
  seatId?: string;
  seatDisplayName: string;
  status: "CONFIRMED" | "CANCELED";
  createdAt?: string;
  updatedAt?: string;
};

export type AdminUpdateReservationInput = {
  reservationId: string;
  name: string;
  schoolName: string;
  phoneLast4: string;
  seatDisplayNames?: string[];
};
