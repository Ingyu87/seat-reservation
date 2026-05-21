import { getReservationMiniMapFloors } from "@seat/shared";
import type { ReservationSummary, Seat } from "@seat/shared";

type ReservationMiniMapProps = {
  reservation: ReservationSummary;
  seats: Seat[];
};

const VIEWBOX_WIDTH = 520;
const FLOOR_HEIGHT = 210;
const MARGIN = 18;

export function ReservationMiniMap({ reservation, seats }: ReservationMiniMapProps) {
  const floors = getReservationMiniMapFloors(reservation, seats);

  if (seats.length === 0) {
    return <p className="hint">좌석 위치를 불러오는 중입니다.</p>;
  }

  if (floors.length === 0) {
    return <p className="hint">좌석 위치를 표시할 수 없습니다.</p>;
  }

  return (
    <div className="reservation-minimap" aria-label="예약 좌석 위치">
      <div className="reservation-minimap-title">
        <strong>좌석 위치</strong>
        <span>예약 좌석은 보라색으로 표시됩니다.</span>
      </div>
      <div className="reservation-minimap-floors">
        {floors.map((floor) => {
          const rows = floor.maxRow - floor.minRow + 1;
          const columns = floor.maxColumn - floor.minColumn + 1;
          const cell = Math.min((VIEWBOX_WIDTH - MARGIN * 2) / columns, (FLOOR_HEIGHT - 54) / rows);
          const reservedIds = new Set(floor.reservedSeats.map((seat) => seat.id));

          return (
            <figure className="reservation-minimap-floor" key={floor.floor}>
              <figcaption>
                <strong>{floor.floorLabel}</strong>
                <span>{floor.reservedSeats.map((seat) => seat.label).join(", ")}</span>
              </figcaption>
              <svg
                role="img"
                viewBox={`0 0 ${VIEWBOX_WIDTH} ${FLOOR_HEIGHT}`}
                aria-label={`${floor.floorLabel} 예약 좌석 위치`}
              >
                <rect className="reservation-minimap-bg" x="1" y="1" width={VIEWBOX_WIDTH - 2} height={FLOOR_HEIGHT - 2} rx="10" />
                <path className="reservation-minimap-stage" d={`M ${MARGIN} 26 Q ${VIEWBOX_WIDTH / 2} 6 ${VIEWBOX_WIDTH - MARGIN} 26`} />
                <text className="reservation-minimap-stage-label" x={VIEWBOX_WIDTH / 2} y="43" textAnchor="middle">
                  STAGE
                </text>
                {floor.seats.map((seat) => {
                  const x = MARGIN + (seat.gridColumn - floor.minColumn) * cell;
                  const y = 58 + (seat.gridRow - floor.minRow) * cell;
                  const reserved = reservedIds.has(seat.id);

                  return (
                    <g key={seat.id}>
                      <rect
                        className={reserved ? "reservation-minimap-seat reserved" : "reservation-minimap-seat"}
                        x={x}
                        y={y}
                        width={Math.max(1.8, cell * 0.72)}
                        height={Math.max(1.8, cell * 0.72)}
                        rx={Math.min(2, cell * 0.18)}
                      />
                      {reserved && (
                        <>
                          <circle className="reservation-minimap-seat-ring" cx={x + cell * 0.36} cy={y + cell * 0.36} r={Math.max(4, cell * 1.25)} />
                          <text className="reservation-minimap-label" x={x + cell * 0.8} y={Math.max(14, y - 4)}>
                            {seat.label}
                          </text>
                        </>
                      )}
                    </g>
                  );
                })}
              </svg>
            </figure>
          );
        })}
      </div>
    </div>
  );
}
