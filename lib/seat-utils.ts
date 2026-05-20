import type { Seat } from "@/lib/types";

export const ROWS = 60;
export const COLS = 40;
export const COLS_PER_BLOCK = 20;
export const TOTAL_SEATS = ROWS * COLS;

export type SeatSection = {
  id: string;
  label: string;
  fromRow: number;
  toRow: number;
};

export const SEAT_SECTIONS: SeatSection[] = [
  { id: "FRONT", label: "앞좌석 (A~T열)", fromRow: 1, toRow: 20 },
  { id: "MIDDLE", label: "중간좌석 (U~AN열)", fromRow: 21, toRow: 40 },
  { id: "BACK", label: "뒷좌석 (AO~BH열)", fromRow: 41, toRow: 60 }
];

export function rowLabel(row: number) {
  if (row <= 26) return String.fromCharCode(64 + row);
  const zeroBased = row - 27;
  return String.fromCharCode(65 + Math.floor(zeroBased / 26)) + String.fromCharCode(65 + (zeroBased % 26));
}

export function makeSeatId(row: number, col: number) {
  return `MAIN_${rowLabel(row)}_${col}`;
}

export function generateDemoSeats(): Seat[] {
  return Array.from({ length: ROWS * COLS }, (_, index) => {
    const row = Math.floor(index / COLS) + 1;
    const col = (index % COLS) + 1;
    const label = rowLabel(row);

    return {
      id: makeSeatId(row, col),
      section: "MAIN",
      rowLabel: label,
      seatNumber: col,
      displayName: `${label}-${col}`,
      sortOrder: row * 1000 + col,
      status: "AVAILABLE"
    };
  });
}

export function indexSeatsByPosition(seats: Seat[]) {
  const map = new Map<string, Seat>();
  for (const seat of seats) {
    map.set(`${seat.rowLabel}:${seat.seatNumber}`, seat);
  }
  return map;
}

export function groupSeatsByRow(seats: Seat[]) {
  return seats
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .reduce<Record<string, Seat[]>>((acc, seat) => {
      acc[seat.rowLabel] ??= [];
      acc[seat.rowLabel].push(seat);
      return acc;
    }, {});
}

export function displayNameToSeatId(displayName: string) {
  const [row, col] = displayName.trim().split("-");
  if (!row || !col) return null;
  return `MAIN_${row}_${col}`;
}

export function validatePhoneLast4(value: string) {
  return /^\d{4}$/.test(value);
}
