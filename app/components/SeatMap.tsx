"use client";

import { memo, useMemo } from "react";
import { FLOORS } from "@seat/shared";
import type { Seat } from "@seat/shared";

type SeatMapProps = {
  seats: Seat[];
  selectedIds?: string[];
  onSelect?: (seat: Seat) => void;
  disabledIds?: string[];
};

function SeatCell({
  disabled,
  seat,
  selected,
  onSelect
}: {
  disabled: boolean;
  seat: Seat;
  selected: boolean;
  onSelect?: (seat: Seat) => void;
}) {
  const available = seat.status === "AVAILABLE" && !disabled;

  return (
    <button
      aria-label={`${seat.displayName}, ${available ? "예약 가능" : "예약 불가"}`}
      className={["seat-cell", seat.status.toLowerCase(), selected ? "selected" : "", disabled ? "locked" : ""]
        .filter(Boolean)
        .join(" ")}
      disabled={!available && !selected}
      style={{ gridColumn: seat.gridColumn, gridRow: seat.gridRow }}
      title={seat.displayName}
      type="button"
      onClick={() => onSelect?.(seat)}
    >
      <span className="seat-cell-label">{seat.label}</span>
    </button>
  );
}

export const SeatMap = memo(function SeatMap({ seats, selectedIds = [], disabledIds = [], onSelect }: SeatMapProps) {
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const disabled = useMemo(() => new Set(disabledIds), [disabledIds]);

  return (
    <div className="seat-map">
      {FLOORS.map((floor) => {
        const floorSeats = seats.filter((seat) => seat.floor === floor.id);
        if (floorSeats.length === 0) return null;

        const maxRow = Math.max(...floorSeats.map((seat) => seat.gridRow));
        const maxColumn = Math.max(...floorSeats.map((seat) => seat.gridColumn));

        return (
          <section className="floor-map" key={floor.id} aria-label={`${floor.label} 좌석 배치도`}>
            <div className="floor-heading">
              <strong>{floor.label}</strong>
              <span>{floorSeats.length.toLocaleString()}석</span>
            </div>
            <div className="stage">무대</div>
            <div
              className="floor-grid"
              style={{
                gridTemplateColumns: `repeat(${maxColumn}, var(--seat-size))`,
                gridTemplateRows: `repeat(${maxRow}, var(--seat-size))`
              }}
            >
              {floorSeats.map((seat) => (
                <SeatCell
                  disabled={disabled.has(seat.id)}
                  key={seat.id}
                  seat={seat}
                  selected={selected.has(seat.id)}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
});
