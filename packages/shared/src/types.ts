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
};

export type SeatMapResponse = {
  total: number;
  reserved: number;
  seats: Seat[];
};

export type ReservationInput = {
  seatIds: string[];
  name: string;
  phoneLast4: string;
  email: string;
  privacyConsent: boolean;
};

export type LookupInput = {
  name: string;
  phoneLast4: string;
};

export type ReservationSummary = {
  reservationId: string;
  name: string;
  phoneLast4: string;
  emailMasked: string;
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
  phoneLast4: string;
  email: string;
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
  phoneLast4: string;
  email: string;
  seatDisplayNames?: string[];
};
