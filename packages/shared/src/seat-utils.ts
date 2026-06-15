import {
  DISABLED_SEAT_IDS,
  SEAT_LAYOUT,
  SEAT_LAYOUT_TOTAL,
  SEAT_LAYOUT_TOTAL_BY_FLOOR
} from "./seat-layout.generated";
import type { Seat } from "./types";

export { DISABLED_SEAT_IDS, SEAT_LAYOUT, SEAT_LAYOUT_TOTAL, SEAT_LAYOUT_TOTAL_BY_FLOOR };

export const DISABLED_SEAT_ID_SET = new Set<string>(DISABLED_SEAT_IDS);

export function isSeatDisabled(seatId: string) {
  return DISABLED_SEAT_ID_SET.has(seatId);
}

export const MAX_SEATS_PER_RESERVATION = 5;

export const FLOORS = [
  { id: "F1", label: "1층" },
  { id: "F2", label: "2층" }
] as const;

export type FloorId = (typeof FLOORS)[number]["id"];

export function makeSeatId(floor: FloorId, label: string) {
  return `${floor}_${label}`;
}

export function generateDemoSeats(): Seat[] {
  return SEAT_LAYOUT.map((seat, index) => ({
    ...seat,
    disabled: Boolean(seat.disabled),
    sortOrder: index + 1,
    status: "AVAILABLE"
  }));
}

export type SeatMapCoverage = {
  expected: number;
  present: number;
  needsReseed: boolean;
  missingSections: string[];
};

export function assessSeatMapCoverage(seats: Seat[]): SeatMapCoverage {
  const expectedIds = new Set(SEAT_LAYOUT.map((seat) => seat.id));
  const presentIds = new Set(seats.map((seat) => seat.id));
  const missingFloors = FLOORS.filter((floor) =>
    SEAT_LAYOUT.some((seat) => seat.floor === floor.id && !presentIds.has(seat.id))
  ).map((floor) => floor.label);

  let present = 0;
  for (const id of expectedIds) {
    if (presentIds.has(id)) present += 1;
  }

  return {
    expected: SEAT_LAYOUT_TOTAL,
    present,
    needsReseed: present < SEAT_LAYOUT_TOTAL,
    missingSections: missingFloors
  };
}

export function indexSeatsByPosition(seats: Seat[]) {
  const map = new Map<string, Seat>();
  for (const seat of seats) {
    map.set(`${seat.floor}:${seat.gridRow}:${seat.gridColumn}`, seat);
  }
  return map;
}

export function groupSeatsByFloor(seats: Seat[]) {
  return seats
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .reduce<Record<FloorId, Seat[]>>(
      (acc, seat) => {
        acc[seat.floor].push(seat);
        return acc;
      },
      { F1: [], F2: [] }
    );
}

export function displayNameToSeatId(displayName: string) {
  const normalized = displayName.trim().replace(/\s+/g, " ");
  const match = normalized.match(/^(?:(1층|2층)\s*)?([가-힣]\d{4})$/);
  if (!match) return null;

  const floor = match[1] === "2층" ? "F2" : match[1] === "1층" ? "F1" : null;
  const label = match[2];
  if (floor) return makeSeatId(floor, label);

  const matches = SEAT_LAYOUT.filter((seat) => seat.label === label);
  return matches.length === 1 ? matches[0].id : null;
}

export function seatIdsToDisplayNames(seatIds: string[]) {
  const byId = new Map(SEAT_LAYOUT.map((seat) => [seat.id, seat.displayName]));
  return seatIds.map((id) => byId.get(id) ?? id);
}

export function validatePhoneLast4(value: string) {
  return /^\d{4}$/.test(value);
}
