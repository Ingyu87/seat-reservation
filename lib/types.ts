export type SeatStatus = "AVAILABLE" | "RESERVED" | "LOCKED";

export type Seat = {
  id: string;
  section: string;
  rowLabel: string;
  seatNumber: number;
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
  seatId: string;
  name: string;
  phoneLast4: string;
  email: string;
  editPassword: string;
  privacyConsent: boolean;
};

export type LookupInput = {
  name: string;
  phoneLast4: string;
  editPassword: string;
};

export type ReservationSummary = {
  reservationId: string;
  name: string;
  phoneLast4: string;
  emailMasked: string;
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
  seatDisplayName: string;
  status: "CONFIRMED" | "CANCELED";
  createdAt?: string;
  updatedAt?: string;
};
