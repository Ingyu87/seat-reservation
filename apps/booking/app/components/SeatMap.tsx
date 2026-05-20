"use client";

import { memo, useMemo } from "react";
import {
  COLS_PER_BLOCK,
  indexSeatsByPosition,
  rowLabel,
  SEAT_SECTIONS
} from "@seat/shared";
import type { Seat } from "@seat/shared";

type SeatMapProps = {
  seats: Seat[];
  selectedId?: string | null;
  onSelect?: (seat: Seat) => void;
};

function SeatCell({
  seat,
  selected,
  onSelect
}: {
  seat: Seat;
  selected: boolean;
  onSelect?: (seat: Seat) => void;
}) {
  const available = seat.status === "AVAILABLE";

  return (
    <button
      aria-label={`${seat.displayName}, ${available ? "예약 가능" : "예약 완료"}`}
      className={["seat-cell", seat.status.toLowerCase(), selected ? "selected" : ""].join(" ")}
      disabled={!available}
      title={seat.displayName}
      type="button"
      onClick={() => onSelect?.(seat)}
    />
  );
}

function SeatBlock({
  cols,
  label,
  seatMap,
  selectedId,
  onSelect
}: {
  cols: number[];
  label: string;
  seatMap: Map<string, Seat>;
  selectedId?: string | null;
  onSelect?: (seat: Seat) => void;
}) {
  return (
    <div aria-label={label} className="seat-block">
      {cols.map((col) => {
        const seat = seatMap.get(`${label}:${col}`);
        if (!seat) return <span aria-hidden className="seat-cell seat-empty" key={col} />;
        return (
          <SeatCell key={seat.id} seat={seat} selected={selectedId === seat.id} onSelect={onSelect} />
        );
      })}
    </div>
  );
}

export const SeatMap = memo(function SeatMap({ seats, selectedId, onSelect }: SeatMapProps) {
  const seatMap = useMemo(() => indexSeatsByPosition(seats), [seats]);
  const leftCols = useMemo(() => Array.from({ length: COLS_PER_BLOCK }, (_, i) => i + 1), []);
  const rightCols = useMemo(
    () => Array.from({ length: COLS_PER_BLOCK }, (_, i) => i + COLS_PER_BLOCK + 1),
    []
  );

  return (
    <div className="seat-map">
      {SEAT_SECTIONS.map((section) => (
        <div className="seat-section" key={section.id}>
          <div className="seat-section-label">{section.label}</div>
          {Array.from({ length: section.toRow - section.fromRow + 1 }, (_, index) => {
            const row = section.fromRow + index;
            const label = rowLabel(row);

            return (
              <div className="seat-row" key={label}>
                <div className="row-label">{label}</div>
                <SeatBlock
                  cols={leftCols}
                  label={label}
                  seatMap={seatMap}
                  selectedId={selectedId}
                  onSelect={onSelect}
                />
                <div aria-hidden className="seat-aisle" />
                <SeatBlock
                  cols={rightCols}
                  label={label}
                  seatMap={seatMap}
                  selectedId={selectedId}
                  onSelect={onSelect}
                />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
});
