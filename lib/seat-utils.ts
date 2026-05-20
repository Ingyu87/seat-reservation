import type { Seat } from "@/lib/types";

export const ROWS = 50;
export const COLS = 50;
export const TOTAL_SEATS = ROWS * COLS;

export function rowLabel(row: number) {
  if (row <= 26) return String.fromCharCode(64 + row);
  const zeroBased = row - 27;
  return (
    String.fromCharCode(65 + Math.floor(zeroBased / 26)) +
    String.fromCharCode(65 + (zeroBased % 26))
  );
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
      displayName: `${label}열 ${col}번`,
      sortOrder: row * 1000 + col,
      status: "AVAILABLE"
    };
  });
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

export function validatePhoneLast4(value: string) {
  return /^\d{4}$/.test(value);
}
