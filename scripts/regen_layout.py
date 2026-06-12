"""좌석 배치도 엑셀(.xlsx)에서 seat-layout.generated.ts 를 다시 생성한다.

규칙:
- 좌석 셀 좌표 = (gridRow, gridColumn + 1)  (엑셀은 B열부터 데이터가 시작)
- 회색 음영(theme 0, tint < -0.1) 또는 노란색(FFFFFF00) 채우기 = 비활성(disabled) 좌석

사용법: python scripts/regen_layout.py
"""

import glob
import json
import os
import re

import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 가장 최근(파일명 기준)의 좌석배치도 xlsx 사용
candidates = sorted(glob.glob(os.path.join(ROOT, "*좌석배치도*.xlsx")))
if not candidates:
    raise SystemExit("좌석배치도 xlsx 파일을 찾을 수 없습니다.")
xlsx = candidates[-1]
print("source:", os.path.basename(xlsx))

targets = [
    os.path.join(ROOT, "packages", "shared", "src", "seat-layout.generated.ts"),
    os.path.join(ROOT, "functions", "src", "seat-layout.generated.ts"),
]

src = open(targets[0], encoding="utf-8").read()
seats = json.loads(re.search(r"JSON\.parse\('(.+?)'\)", src, re.S).group(1))

wb = openpyxl.load_workbook(xlsx, data_only=True)
sheets = {"F1": wb.worksheets[0], "F2": wb.worksheets[1]}


def is_disabled(cell):
    f = cell.fill
    if not f or not f.patternType:
        return False
    fg = f.fgColor
    rgb = getattr(fg, "rgb", None)
    rgb = rgb if isinstance(rgb, str) else None
    theme = getattr(fg, "theme", None)
    theme = theme if isinstance(theme, int) else None
    tint = round(getattr(fg, "tint", 0) or 0, 3)
    if rgb == "FFFFFF00":  # 노란색 강조
        return True
    if theme == 0 and tint < -0.1:  # 회색 음영
        return True
    return False


count = 0
for s in seats:
    cell = sheets[s["floor"]].cell(row=s["gridRow"], column=s["gridColumn"] + 1)
    if is_disabled(cell):
        s["disabled"] = True
        count += 1
    else:
        s.pop("disabled", None)

print("disabled seats:", count, "/", len(seats))

payload = json.dumps(seats, ensure_ascii=False, separators=(",", ":"))
assert "'" not in payload, "JSON payload에 작은따옴표가 있어 구분자와 충돌합니다."

content = (
    f"/* Generated from {os.path.basename(xlsx)}. Do not edit by hand. */\n"
    "\n"
    "export type SeatLayoutItem = {\n"
    "  id: string;\n"
    "  floor: \"F1\" | \"F2\";\n"
    "  floorLabel: string;\n"
    "  label: string;\n"
    "  area: string;\n"
    "  seatRow: number;\n"
    "  seatNumber: number;\n"
    "  gridRow: number;\n"
    "  gridColumn: number;\n"
    "  displayName: string;\n"
    "  disabled?: boolean;\n"
    "};\n"
    "\n"
    f"export const SEAT_LAYOUT = JSON.parse('{payload}') as SeatLayoutItem[];\n"
    "export const SEAT_LAYOUT_TOTAL = SEAT_LAYOUT.length;\n"
    "export const SEAT_LAYOUT_TOTAL_BY_FLOOR = {\n"
    "  F1: SEAT_LAYOUT.filter((seat) => seat.floor === \"F1\").length,\n"
    "  F2: SEAT_LAYOUT.filter((seat) => seat.floor === \"F2\").length\n"
    "};\n"
    "export const DISABLED_SEAT_IDS = SEAT_LAYOUT.filter((seat) => seat.disabled).map((seat) => seat.id);\n"
)

for t in targets:
    with open(t, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(content)
    print("wrote", os.path.relpath(t, ROOT))
