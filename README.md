# 행사 좌석 예약 시스템

Firebase 백엔드와 Vercel 프론트엔드를 사용하는 좌석 예약 앱입니다.

- **예약자 사이트**: 저장소 루트 (기본 Vercel 프로젝트)
- **관리자 사이트**: `apps/admin` (별도 Vercel 프로젝트)

## 구조

```txt
app/                  예약자용 Next.js (루트)
apps/admin/           관리자용 Next.js
packages/shared/      공통 타입, Firebase, 좌석 유틸
functions/            Firebase Cloud Functions
```

## 로컬 실행

```bash
npm install
cp .env.example .env.local   # Firebase 설정 입력

# 예약자 — http://localhost:3000
npm run dev

# 관리자 — http://localhost:3001
npm run dev:admin
```

## Vercel 배포

| 프로젝트 | Root Directory | 포트(로컬) |
| --- | --- | --- |
| 예약자 (기존) | `.` (루트) | 3000 |
| 관리자 (신규) | `apps/admin` | 3001 |

상세 절차·환경 변수 목록: **[DEPLOYMENT.md](DEPLOYMENT.md)**

환경 변수 요약:

```txt
# 예약 Vercel
NEXT_PUBLIC_ADMIN_SITE_URL=https://관리자-도메인

# 관리자 Vercel
NEXT_PUBLIC_BOOKING_SITE_URL=https://예약-도메인
```

(두 프로젝트 모두 Firebase `NEXT_PUBLIC_FIREBASE_*` 6개 동일)

## Firebase

```bash
cd functions && npm install && npm run build && cd ..
npx firebase-tools deploy --only functions
```

## 좌석 seed

관리자 사이트 로그인 → **좌석 데이터 생성** (50×50, 2500석, 기존 예약 유지)

## 관리자 계정

Firebase **이메일/비밀번호** + custom claim `admin: true` (예: `admin@re.kr`)

설정 방법: **[ADMIN_ACCOUNT.md](ADMIN_ACCOUNT.md)**
