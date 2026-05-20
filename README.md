# 행사 좌석 예약 시스템

Firebase 백엔드와 Vercel 프론트엔드를 사용하는 좌석 예약 앱입니다. **예약자 사이트**와 **관리자 사이트**가 분리되어 있습니다.

## 구조

```txt
apps/booking/         예약자용 사이트 (좌석 선택, 예약, 조회)
apps/admin/           관리자용 사이트 (로그인, 예약 관리, 좌석 seed)
packages/shared/      공통 타입, Firebase 클라이언트, 좌석 유틸
functions/            Firebase Cloud Functions
firestore.rules       Firestore Security Rules
```

## 로컬 실행

```bash
npm install
```

`.env.local`은 `.env.example`을 복사해 **각 앱 폴더** 또는 루트에 Firebase 설정을 채웁니다.

```bash
# 예약자 사이트 — http://localhost:3000
npm run dev:booking

# 관리자 사이트 — http://localhost:3001
npm run dev:admin
```

## Vercel 배포 (사이트 2개)

같은 저장소에서 **프로젝트를 2개** 만듭니다.

| Vercel 프로젝트 | Root Directory | 용도 |
| --- | --- | --- |
| `seat-reservation` (기존) | `apps/booking` | 예약자 |
| `seat-reservation-admin` (신규) | `apps/admin` | 관리자 |

각 프로젝트에 동일한 Firebase 환경 변수를 넣고, 사이트 URL을 서로 연결합니다.

```txt
# 예약자 프로젝트
NEXT_PUBLIC_ADMIN_SITE_URL=https://admin.example.com

# 관리자 프로젝트
NEXT_PUBLIC_BOOKING_SITE_URL=https://booking.example.com
```

## Firebase 배포

```bash
cd functions
npm install
npm run build
cd ..
npx firebase-tools deploy --only functions
npx firebase-tools deploy --only firestore:rules
```

## 좌석 seed

관리자 사이트에 로그인한 뒤 **좌석 데이터 생성**을 실행하면 50행 x 50열, 총 2500석이 준비됩니다. 기존 예약은 유지됩니다.

## 관리자 계정

- Firebase Authentication **이메일/비밀번호** 계정
- custom claim `admin: true` 필요 (구글 로그인 필수 아님)
