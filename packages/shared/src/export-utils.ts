import type { AdminReservation } from "./types";

function escapeCsv(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR");
}

export function downloadReservationsExcel(items: AdminReservation[], filename = "예약목록.csv") {
  const headers = ["이름", "전화번호 뒷자리", "이메일", "좌석 수", "좌석 위치", "상태", "예약 일시", "수정 일시"];
  const rows = items.map((item) => [
    item.name,
    item.phoneLast4,
    item.email,
    String(item.seatCount),
    item.seatDisplayNames.join(", "),
    item.status === "CONFIRMED" ? "예약 완료" : "취소",
    formatDate(item.createdAt),
    formatDate(item.updatedAt)
  ]);

  const csv = [headers, ...rows].map((row) => row.map((cell) => escapeCsv(cell)).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
