# 행사 좌석 예약 시스템

Firebase 백엔드와 Vercel 프론트엔드를 사용하는 좌석 예약 앱입니다.

## 구조

```txt
app/                 Next.js 화면
lib/                 Firebase client, 타입, 좌석 유틸
functions/           Firebase Cloud Functions
functions/src/index.ts Firebase Functions와 좌석 seed 함수
firestore.rules      Firestore Security Rules
```

## 로컬 실행

```bash
npm install
npm run dev
```

`.env.local`은 `.env.example`을 복사해서 Firebase client config를 채웁니다.

## Firebase 배포

```bash
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

## 좌석 seed

좌석 생성은 Firebase Cloud Function `seedSeats`로 처리합니다. 관리자 custom claims가 있는 계정으로 로그인한 뒤 호출하면 50행 x 50석, 총 2500석이 생성됩니다.

## Vercel 환경 변수

```txt
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_SITE_URL
```

이메일 발송 API 키는 Vercel에 넣지 않고 Firebase Functions Secret으로 관리합니다.
