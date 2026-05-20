import type { Seat } from "./types";

export const ROWS = 50;
export const COLS = 50;
export const COLS_PER_BLOCK = 25;
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
  { id: "BACK", label: "뒷좌석 (AO~AX열)", fromRow: 41, toRow: 50 }
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

export type SeatMapCoverage = {
  expected: number;
  present: number;
  needsReseed: boolean;
  missingSections: string[];
};

export function assessSeatMapCoverage(seats: Seat[]): SeatMapCoverage {
  const seatIds = new Set(seats.map((seat) => seat.id));
  let present = 0;
  const missingSections: string[] = [];

  for (const section of SEAT_SECTIONS) {
    let sectionPresent = 0;
    const sectionTotal = (section.toRow - section.fromRow + 1) * COLS;

    for (let row = section.fromRow; row <= section.toRow; row += 1) {
      for (let col = 1; col <= COLS; col += 1) {
        if (seatIds.has(makeSeatId(row, col))) {
          sectionPresent += 1;
        }
      }
    }

    present += sectionPresent;
    if (sectionPresent < sectionTotal) {
      missingSections.push(section.label);
    }
  }

  return {
    expected: TOTAL_SEATS,
    present,
    needsReseed: present < TOTAL_SEATS,
    missingSections
  };
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
