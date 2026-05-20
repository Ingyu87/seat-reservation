# Vercel 배포 가이드 (예약 + 관리자)

저장소는 모노레포입니다. **Vercel 프로젝트 2개**가 필요합니다.

## 1. 예약자 사이트 (기존 프로젝트)

| 설정 | 값 |
| --- | --- |
| GitHub repo | `Ingyu87/seat-reservation` |
| Root Directory | `.` (비움 / 루트) |
| Framework | Next.js |

### 환경 변수

Firebase 6개 + (선택) 사이트 URL:

```txt
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_ADMIN_SITE_URL=https://<관리자-프로젝트-도메인>
NEXT_PUBLIC_SITE_URL=https://<예약-프로젝트-도메인>
```

`NEXT_PUBLIC_ADMIN_SITE_URL`이 있으면 좌석 미생성·불완전 안내에 관리자 사이트 링크가 표시됩니다.

---

## 2. 관리자 사이트 (신규 프로젝트)

Vercel 대시보드 → **Add New Project** → 같은 GitHub repo 선택.

| 설정 | 값 |
| --- | --- |
| Project Name | 예: `seat-reservation-admin` |
| Root Directory | **`apps/admin`** |
| Framework | Next.js (자동) |

빌드는 [apps/admin/vercel.json](apps/admin/vercel.json)에서 루트 기준으로 실행됩니다:

- Install: `cd ../.. && npm install`
- Build: `cd ../.. && npm run build:admin`

### 환경 변수

Firebase 6개(예약과 동일) + 예약 사이트 URL:

```txt
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_BOOKING_SITE_URL=https://<예약-프로젝트-도메인>
```

배포 후 관리자 URL 예: `https://seat-reservation-admin.vercel.app`

- 로그인: `/login`
- 대시보드: `/`

---

## 3. 배포 후 확인

1. **예약 사이트**: 좌석 맵 로드, 헤더에 관리자 메뉴 없음
2. **관리자 사이트**: 로그인 → 좌석 데이터 생성 → 예약 검색
3. 예약 Vercel에 `NEXT_PUBLIC_ADMIN_SITE_URL` = 관리자 배포 URL
4. 관리자 Vercel에 `NEXT_PUBLIC_BOOKING_SITE_URL` = 예약 배포 URL

## 4. 로컬

```bash
npm install
cp .env.example .env.local          # 루트 — 예약용
cp apps/admin/.env.example apps/admin/.env.local   # 관리자용 (선택)

npm run dev          # :3000 예약
npm run dev:admin    # :3001 관리자
```

## 5. Firebase Functions

프론트만 Vercel이고 API는 Firebase Functions입니다. Functions 미배포 시 예약/관리 API가 동작하지 않습니다.

```bash
cd functions && npm install && npm run build && cd ..
npx firebase-tools deploy --only functions
```
