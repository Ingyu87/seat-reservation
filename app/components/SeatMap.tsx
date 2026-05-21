"use client";

import { memo, useMemo, useState } from "react";
import { FLOORS } from "@seat/shared";
import type { CSSProperties } from "react";
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
  const [zoom, setZoom] = useState(1);
  const zoomPercent = Math.round(zoom * 100);

  function changeZoom(next: number) {
    setZoom(Math.max(1, Math.min(2, next)));
  }

  return (
    <div className="seat-map" style={{ "--seat-zoom": zoom } as CSSProperties}>
      <div className="seat-map-toolbar">
        <div className="seat-zoom-controls" aria-label="좌석도 확대 조절">
          <button className="btn btn-secondary btn-small" disabled={zoom <= 1} type="button" onClick={() => changeZoom(zoom - 0.25)}>
            축소
          </button>
          <span>{zoomPercent}%</span>
          <button className="btn btn-secondary btn-small" disabled={zoom >= 2} type="button" onClick={() => changeZoom(zoom + 0.25)}>
            확대
          </button>
          <button className="btn btn-secondary btn-small" disabled={zoom === 1} type="button" onClick={() => changeZoom(1)}>
            초기화
          </button>
        </div>
      </div>

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
            <div className="auditorium-stage">
              <span>STAGE</span>
            </div>
            <div className="auditorium-shell">
              <div
                className="floor-grid"
                style={{
                  gridTemplateColumns: `repeat(${maxColumn}, calc(var(--seat-size) * var(--seat-zoom)))`,
                  gridTemplateRows: `repeat(${maxRow}, calc(var(--seat-size) * var(--seat-zoom)))`
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
            </div>
          </section>
        );
      })}
    </div>
  );
});
