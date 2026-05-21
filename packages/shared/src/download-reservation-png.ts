import { getReservationMiniMapFloors } from "./reservation-minimap";
import type { ReservationSummary, Seat } from "./types";

export type ReservationPngDownloadResult = {
  mode: "download" | "opened";
};

type DownloadReservationInfoPngOptions = {
  seats?: Seat[];
};

function formatReservedAt(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

function isMobileOrSafari() {
  const userAgent = window.navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(userAgent));
  const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent);
  return isIOS || isSafari || /Android|Mobile/i.test(userAgent);
}

function splitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
      continue;
    }

    if (current) lines.push(current);
    current = word;
  }

  if (current) lines.push(current);
  return lines.length ? lines : [text];
}

function openImageForMobileSave(dataUrl: string, fileName: string) {
  const popup = window.open("", "_blank");

  if (!popup) {
    window.location.href = dataUrl;
    return;
  }

  popup.document.write(`<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${fileName}</title>
    <style>
      body {
        margin: 0;
        padding: 20px;
        background: #f4f8f4;
        color: #122033;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        text-align: center;
      }
      p {
        margin: 0 0 14px;
        font-weight: 700;
      }
      img {
        display: block;
        width: 100%;
        max-width: 760px;
        height: auto;
        margin: 0 auto;
        border-radius: 12px;
        box-shadow: 0 16px 40px rgba(18, 32, 51, 0.15);
      }
    </style>
  </head>
  <body>
    <p>모바일에서는 이미지를 길게 눌러 저장해 주세요.</p>
    <img alt="예약 확인 카드" src="${dataUrl}" />
  </body>
</html>`);
  popup.document.close();
}

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const nextRadius = Math.min(radius, width / 2, height / 2);
  ctx.moveTo(x + nextRadius, y);
  ctx.lineTo(x + width - nextRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + nextRadius);
  ctx.lineTo(x + width, y + height - nextRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - nextRadius, y + height);
  ctx.lineTo(x + nextRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - nextRadius);
  ctx.lineTo(x, y + nextRadius);
  ctx.quadraticCurveTo(x, y, x + nextRadius, y);
  ctx.closePath();
}

function drawReservationMiniMap(
  ctx: CanvasRenderingContext2D,
  reservation: ReservationSummary,
  seats: Seat[],
  x: number,
  y: number,
  width: number
) {
  const floors = getReservationMiniMapFloors(reservation, seats);
  if (floors.length === 0) return 0;

  const margin = 18;
  const floorHeight = 190;
  const floorGap = 18;
  const totalHeight = floors.length * floorHeight + (floors.length - 1) * floorGap + 46;

  ctx.fillStyle = "#f8fbf8";
  ctx.strokeStyle = "#d9ded9";
  ctx.lineWidth = 1;
  ctx.beginPath();
  roundedRectPath(ctx, x, y, width, totalHeight, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#1f2933";
  ctx.font = "bold 16px Arial, 'Malgun Gothic', 'Noto Sans KR', sans-serif";
  ctx.fillText("좌석 위치", x + margin, y + 28);
  ctx.fillStyle = "#6b7280";
  ctx.font = "12px Arial, 'Malgun Gothic', 'Noto Sans KR', sans-serif";
  ctx.fillText("예약 좌석은 보라색으로 표시됩니다.", x + margin + 78, y + 28);

  let floorY = y + 46;
  for (const floor of floors) {
    const rows = floor.maxRow - floor.minRow + 1;
    const columns = floor.maxColumn - floor.minColumn + 1;
    const reservedIds = new Set(floor.reservedSeats.map((seat) => seat.id));
    const mapX = x + margin;
    const mapY = floorY + 30;
    const mapWidth = width - margin * 2;
    const mapHeight = floorHeight - 44;
    const cell = Math.min(mapWidth / columns, mapHeight / rows);

    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#e0e5e0";
    ctx.beginPath();
    roundedRectPath(ctx, x + 12, floorY, width - 24, floorHeight, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#1f2933";
    ctx.font = "bold 13px Arial, 'Malgun Gothic', 'Noto Sans KR', sans-serif";
    ctx.fillText(floor.floorLabel, x + margin, floorY + 20);
    ctx.fillStyle = "#5045c7";
    ctx.font = "bold 12px Arial, 'Malgun Gothic', 'Noto Sans KR', sans-serif";
    ctx.fillText(floor.reservedSeats.map((seat) => seat.label).join(", "), x + margin + 42, floorY + 20);

    ctx.strokeStyle = "#9aa09a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(mapX, floorY + 38);
    ctx.quadraticCurveTo(x + width / 2, floorY + 20, x + width - margin, floorY + 38);
    ctx.stroke();
    ctx.fillStyle = "#777";
    ctx.font = "bold 11px Arial, 'Malgun Gothic', 'Noto Sans KR', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("STAGE", x + width / 2, floorY + 54);
    ctx.textAlign = "start";

    for (const seat of floor.seats) {
      const seatX = mapX + (seat.gridColumn - floor.minColumn) * cell;
      const seatY = mapY + (seat.gridRow - floor.minRow) * cell;
      const size = Math.max(1.7, cell * 0.72);
      const reserved = reservedIds.has(seat.id);

      ctx.fillStyle = reserved ? "#6d5dfc" : "#34bf3d";
      ctx.strokeStyle = reserved ? "#3f35a6" : "#f7fff7";
      ctx.lineWidth = reserved ? 1.2 : 0.5;
      ctx.beginPath();
      roundedRectPath(ctx, seatX, seatY, size, size, Math.min(2, size * 0.25));
      ctx.fill();
      ctx.stroke();

      if (reserved) {
        ctx.strokeStyle = "#3f35a6";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(seatX + size / 2, seatY + size / 2, Math.max(4, cell * 1.2), 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = "#2d257f";
        ctx.font = "bold 10px Arial, 'Malgun Gothic', 'Noto Sans KR', sans-serif";
        ctx.fillText(seat.label, seatX + size + 4, Math.max(floorY + 64, seatY - 3));
      }
    }

    floorY += floorHeight + floorGap;
  }

  return totalHeight;
}

export async function downloadReservationInfoPng(
  found: ReservationSummary,
  options: DownloadReservationInfoPngOptions = {}
): Promise<ReservationPngDownloadResult> {
  const width = 760;
  const padding = 30;
  const lineHeight = 32;
  const seatLine = found.seats.map((seat) => seat.displayName).join(", ");
  const rows = [
    "예약 확인",
    "",
    `예약자: ${found.name}`,
    `좌석 수: ${found.seatCount}`,
    `좌석: ${seatLine}`,
    `전화번호 뒷자리: ${found.phoneLast4}`,
    `이메일: ${found.emailMasked}`,
    `예약 일시: ${formatReservedAt(found.createdAt)}`,
    `상태: ${found.status === "CONFIRMED" ? "예약 완료" : "취소"}`
  ];

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("이미지를 만들 수 없습니다.");

  ctx.font = "16px Arial, 'Malgun Gothic', 'Noto Sans KR', sans-serif";
  const wrappedRows = rows.flatMap((row) => (row ? splitText(ctx, row, width - padding * 2) : [""]));
  const miniMapFloors = options.seats?.length ? getReservationMiniMapFloors(found, options.seats) : [];
  const miniMapHeight = miniMapFloors.length > 0 ? miniMapFloors.length * 190 + (miniMapFloors.length - 1) * 18 + 46 : 0;
  const textHeight = padding * 2 + wrappedRows.length * lineHeight + 8;
  const height = textHeight + (miniMapHeight ? miniMapHeight + 20 : 0);
  canvas.width = width;
  canvas.height = height;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "#c8e6c9";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, width - 2, height - 2);

  ctx.fillStyle = "#1b5e20";
  ctx.font = "bold 22px Arial, 'Malgun Gothic', 'Noto Sans KR', sans-serif";
  ctx.fillText(wrappedRows[0], padding, padding + 4);

  ctx.fillStyle = "#1f2933";
  ctx.font = "16px Arial, 'Malgun Gothic', 'Noto Sans KR', sans-serif";
  let y = padding + lineHeight + 12;
  for (let i = 2; i < wrappedRows.length; i += 1) {
    ctx.fillText(wrappedRows[i], padding, y);
    y += lineHeight;
  }

  if (miniMapFloors.length > 0 && options.seats) {
    drawReservationMiniMap(ctx, found, options.seats, padding, y + 4, width - padding * 2);
  }

  const safeName = found.name.replace(/[^\w가-힣]+/g, "_");
  const fileName = `예약확인_${safeName}.png`;
  const dataUrl = canvas.toDataURL("image/png");

  if (isMobileOrSafari()) {
    openImageForMobileSave(dataUrl, fileName);
    return { mode: "opened" };
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) {
    openImageForMobileSave(dataUrl, fileName);
    return { mode: "opened" };
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = fileName;
  link.href = url;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  return { mode: "download" };
}
