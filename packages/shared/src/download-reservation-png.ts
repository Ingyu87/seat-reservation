import type { ReservationSummary } from "./types";

function formatReservedAt(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

export async function downloadReservationInfoPng(found: ReservationSummary) {
  const width = 520;
  const padding = 28;
  const lineHeight = 32;
  const lines = [
    "생태전환교육 행사 · 예약 확인",
    "",
    `예약자: ${found.name}`,
    `좌석: ${found.seat.displayName}`,
    `전화번호 뒤 4자리: ${found.phoneLast4}`,
    `이메일: ${found.emailMasked}`,
    `예약 일시: ${formatReservedAt(found.createdAt)}`,
    `상태: ${found.status === "CONFIRMED" ? "예약 완료" : "취소"}`
  ];

  const canvas = document.createElement("canvas");
  const height = padding * 2 + lines.length * lineHeight + 8;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("이미지를 만들 수 없습니다.");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "#c8e6c9";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, width - 2, height - 2);

  ctx.fillStyle = "#1b5e20";
  ctx.font = "bold 20px Arial, 'Malgun Gothic', 'Noto Sans KR', sans-serif";
  ctx.fillText(lines[0], padding, padding + 4);

  ctx.fillStyle = "#1f2933";
  ctx.font = "16px Arial, 'Malgun Gothic', 'Noto Sans KR', sans-serif";
  let y = padding + lineHeight + 12;
  for (let i = 2; i < lines.length; i += 1) {
    ctx.fillText(lines[i], padding, y);
    y += lineHeight;
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("PNG 파일을 만들 수 없습니다.");

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const safeName = found.name.replace(/[^\w가-힣.-]+/g, "_");
  link.download = `예약확인_${safeName}_${found.seat.displayName}.png`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}
