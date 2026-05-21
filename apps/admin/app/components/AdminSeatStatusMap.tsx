import type { Seat } from "@seat/shared";

type AdminSeatStatusMapProps = {
  seats: Seat[];
};

const VIEWBOX_WIDTH = 1040;
const MARGIN = 30;
const MAP_TOP = 92;
const MAP_BOTTOM = 34;
const MAX_SEAT_SIZE = 8;
const MIN_SEAT_SIZE = 4;

export function AdminSeatStatusMap({ seats }: AdminSeatStatusMapProps) {
  const floors = Array.from(new Set(seats.map((seat) => seat.floor))).sort();

  if (seats.length === 0) {
    return <div className="notice">좌석 현황을 불러오는 중입니다.</div>;
  }

  return (
    <div className="admin-seat-status-map" aria-label="실시간 좌석 예약 현황">
      {floors.map((floor) => {
        const floorSeats = seats.filter((seat) => seat.floor === floor).sort((a, b) => a.sortOrder - b.sortOrder);
        const reservedCount = floorSeats.filter((seat) => seat.status === "RESERVED").length;
        const rows = floorSeats.map((seat) => seat.gridRow);
        const columns = floorSeats.map((seat) => seat.gridColumn);
        const minRow = Math.min(...rows);
        const maxRow = Math.max(...rows);
        const minColumn = Math.min(...columns);
        const maxColumn = Math.max(...columns);
        const rowCount = maxRow - minRow + 1;
        const columnCount = maxColumn - minColumn + 1;
        const cell = Math.max(MIN_SEAT_SIZE, Math.min(MAX_SEAT_SIZE, (VIEWBOX_WIDTH - MARGIN * 2) / columnCount));
        const usedWidth = columnCount * cell;
        const mapLeft = Math.max(MARGIN, (VIEWBOX_WIDTH - usedWidth) / 2);
        const floorHeight = MAP_TOP + rowCount * cell + MAP_BOTTOM;

        return (
          <section className="admin-seat-floor" key={floor}>
            <div className="admin-seat-floor-head">
              <div>
                <strong>{floorSeats[0]?.floorLabel ?? floor}</strong>
                <span>{floorSeats.length.toLocaleString()}석</span>
              </div>
              <div>
                <span>예약 {reservedCount.toLocaleString()}석</span>
                <span>잔여 {(floorSeats.length - reservedCount).toLocaleString()}석</span>
              </div>
            </div>
            <svg role="img" viewBox={`0 0 ${VIEWBOX_WIDTH} ${floorHeight}`} aria-label={`${floorSeats[0]?.floorLabel ?? floor} 좌석 현황`}>
              <rect className="admin-seat-map-bg" x="1" y="1" width={VIEWBOX_WIDTH - 2} height={floorHeight - 2} rx="12" />
              <path className="admin-seat-stage" d={`M ${MARGIN} 34 Q ${VIEWBOX_WIDTH / 2} 8 ${VIEWBOX_WIDTH - MARGIN} 34`} />
              <text className="admin-seat-stage-label" x={VIEWBOX_WIDTH / 2} y="56" textAnchor="middle">
                STAGE
              </text>
              {floorSeats.map((seat) => {
                const x = mapLeft + (seat.gridColumn - minColumn) * cell;
                const y = MAP_TOP + (seat.gridRow - minRow) * cell;
                const reserved = seat.status === "RESERVED";

                return (
                  <rect
                    className={reserved ? "admin-seat-dot reserved" : "admin-seat-dot available"}
                    key={seat.id}
                    x={x}
                    y={y}
                    width={Math.max(2, cell * 0.72)}
                    height={Math.max(2, cell * 0.72)}
                    rx={Math.min(2, cell * 0.16)}
                  >
                    <title>{`${seat.displayName} ${reserved ? "예약 완료" : "예약 가능"}`}</title>
                  </rect>
                );
              })}
            </svg>
          </section>
        );
      })}
    </div>
  );
}
