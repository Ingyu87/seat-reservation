import type { ReservationSummary, Seat } from "./types";

export type ReservationMiniMapFloor = {
  floor: Seat["floor"];
  floorLabel: string;
  seats: Seat[];
  reservedSeats: Seat[];
  minRow: number;
  maxRow: number;
  minColumn: number;
  maxColumn: number;
};

function normalizeSeatName(value?: string) {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

export function resolveReservationSeats(reservation: ReservationSummary, seats: Seat[]) {
  const byId = new Map(seats.map((seat) => [seat.id, seat]));
  const byDisplayName = new Map(seats.map((seat) => [normalizeSeatName(seat.displayName), seat]));
  const matched = new Map<string, Seat>();

  for (const reservationSeat of reservation.seats) {
    const bySeatId = reservationSeat.id ? byId.get(reservationSeat.id) : null;
    const byName = byDisplayName.get(normalizeSeatName(reservationSeat.displayName));
    const seat = bySeatId ?? byName;
    if (seat) matched.set(seat.id, seat);
  }

  return [...matched.values()].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getReservationMiniMapFloors(reservation: ReservationSummary, seats: Seat[]) {
  const reservedSeats = resolveReservationSeats(reservation, seats);
  const reservedIds = new Set(reservedSeats.map((seat) => seat.id));
  const floors = new Set(reservedSeats.map((seat) => seat.floor));
  const result: ReservationMiniMapFloor[] = [];

  for (const floor of floors) {
    const floorSeats = seats.filter((seat) => seat.floor === floor).sort((a, b) => a.sortOrder - b.sortOrder);
    if (floorSeats.length === 0) continue;

    const rows = floorSeats.map((seat) => seat.gridRow);
    const columns = floorSeats.map((seat) => seat.gridColumn);

    result.push({
      floor,
      floorLabel: floorSeats[0]?.floorLabel ?? floor,
      seats: floorSeats,
      reservedSeats: floorSeats.filter((seat) => reservedIds.has(seat.id)),
      minRow: Math.min(...rows),
      maxRow: Math.max(...rows),
      minColumn: Math.min(...columns),
      maxColumn: Math.max(...columns)
    });
  }

  return result.sort((a, b) => a.floor.localeCompare(b.floor));
}
