# 좌석 예약 시스템 구현 계획

## 1. 권장 아키텍처

개인정보와 중복 예약 방지가 중요하므로 프론트엔드 단독 저장 방식은 사용하지 않는다. Firebase를 사용하되, 개인정보가 포함된 예약 생성, 조회, 변경, 취소는 Cloud Functions에서 처리한다.

확정 MVP 조합:

- Frontend: React 또는 Next.js
- Repository: GitHub
- Frontend Hosting: Vercel
- Auth: Firebase Authentication
- DB: Cloud Firestore
- Server Logic: Cloud Functions
- Admin Auth: Firebase Auth custom claims
- Email: Resend, SendGrid, AWS SES 중 선택

역할 분리:

```txt
GitHub
  소스코드 저장소
  main 브랜치 기준 배포

Vercel
  예약자 웹 페이지 배포
  관리자 웹 페이지 배포
  Firebase client SDK 환경 변수 관리

Firebase
  Authentication
  Cloud Firestore
  Cloud Functions
  Firestore Security Rules
  관리자 custom claims

Email Provider
  예약 완료/변경/취소 이메일 발송
```

Vercel은 프론트엔드 호스팅을 담당하고, Firebase는 백엔드 역할을 담당한다. 좌석 예약, 조회, 변경, 취소는 Vercel 서버리스 함수가 아니라 Firebase Cloud Functions에서 처리한다.

## 2. 핵심 원칙

## 2.1 좌석 중복 예약 방지

- 좌석 상태는 Firestore의 `seats/{seatId}` 문서에 저장한다.
- 예약 생성은 Cloud Functions의 Firestore Transaction 안에서만 처리한다.
- Transaction 안에서 좌석 상태가 `AVAILABLE`인지 확인한다.
- 예약 성공 시 좌석 상태를 `RESERVED`로 변경하고 예약 문서를 생성한다.
- 동시에 같은 좌석을 예약하면 Transaction 중 하나만 성공한다.

## 2.2 개인정보 최소 수집

- 전화번호 전체는 받지 않는다.
- 예약자는 전화번호 뒤 4자리만 입력한다.
- 예약 조회, 변경, 취소는 `이름 + 전화번호 뒤 4자리 + 수정 비밀번호`로 처리한다.
- 수정 비밀번호는 평문 저장 금지, 해시로 저장한다.

## 2.3 이메일 발송과 예약 저장 분리

- 이메일 발송 실패가 예약 실패로 이어지면 안 된다.
- 예약 저장 성공 후 `notificationJobs`에 이메일 발송 작업을 기록한다.
- 발송 성공/실패 상태를 로그로 남긴다.
- 실패한 이메일은 관리자 페이지에서 재발송할 수 있게 한다.

## 3. Firestore 컬렉션

## 3.1 seats

좌석 공개 상태 컬렉션이다. 개인정보를 포함하지 않는다.

```txt
seats/{seatId}
  section: "MAIN"
  rowLabel: "A"
  seatNumber: 12
  displayName: "A열 12번"
  sortOrder: 1012
  status: "AVAILABLE" | "RESERVED" | "LOCKED"
  reservationId: "reservation_xxx" | null
  updatedAt: Timestamp
```

클라이언트가 읽어도 되는 정보:

- 좌석명
- 좌석 상태
- 정렬 정보

## 3.2 reservations

개인정보가 포함된 예약 컬렉션이다. 일반 클라이언트 직접 접근을 막는다.

```txt
reservations/{reservationId}
  seatId: "seat_MAIN_A_12"
  seatDisplayName: "A열 12번"
  name: "홍길동"
  phoneLast4: "5678"
  email: "user@example.com"
  editPasswordHash: "..."
  status: "CONFIRMED" | "CANCELED"
  privacyConsent: true
  privacyConsentAt: Timestamp
  createdAt: Timestamp
  updatedAt: Timestamp
  canceledAt: Timestamp | null
```

권장 인덱스:

- `name`
- `phoneLast4`
- `email`
- `status`
- `seatId`

## 3.3 notificationJobs

이메일 발송 로그 컬렉션이다.

```txt
notificationJobs/{jobId}
  reservationId: "reservation_xxx"
  type: "EMAIL"
  event: "RESERVED" | "CHANGED" | "CANCELED"
  recipient: "user@example.com"
  payload: object
  status: "PENDING" | "SENT" | "FAILED"
  errorMessage: string | null
  createdAt: Timestamp
  sentAt: Timestamp | null
```

## 3.4 adminLogs

관리자 작업 로그다.

```txt
adminLogs/{logId}
  adminUid: "firebase_uid"
  action: "SEARCH_RESERVATION" | "CANCEL_RESERVATION" | "CHANGE_SEAT" | "EXPORT_CSV"
  targetId: "reservation_xxx"
  createdAt: Timestamp
```

## 4. Cloud Functions 설계

예약자 기능:

- `getSeatMap`
- `reserveSeat`
- `lookupReservation`
- `changeSeat`
- `cancelReservation`

관리자 기능:

- `adminSearchReservations`
- `adminGetReservation`
- `adminCancelReservation`
- `adminChangeSeat`
- `adminExportReservationsCsv`
- `retryNotification`

관리자 함수는 Firebase Auth 로그인과 custom claims의 `admin: true` 권한을 확인한다.

## 5. 예약 생성 로직

`reserveSeat` 요청:

```json
{
  "seatId": "seat_MAIN_A_12",
  "name": "홍길동",
  "phoneLast4": "5678",
  "email": "user@example.com",
  "editPassword": "1234",
  "privacyConsent": true
}
```

Cloud Functions 의사 코드:

```ts
export const reserveSeat = onCall(async (request) => {
  const input = validateReserveSeatInput(request.data);
  const passwordHash = await hashPassword(input.editPassword);

  return await db.runTransaction(async (tx) => {
    const seatRef = db.collection("seats").doc(input.seatId);
    const seatSnap = await tx.get(seatRef);

    if (!seatSnap.exists) {
      throw new HttpsError("not-found", "존재하지 않는 좌석입니다.");
    }

    const seat = seatSnap.data();
    if (seat.status !== "AVAILABLE") {
      throw new HttpsError("already-exists", "방금 다른 사용자가 예약한 좌석입니다.");
    }

    const reservationRef = db.collection("reservations").doc();

    tx.create(reservationRef, {
      seatId: input.seatId,
      seatDisplayName: seat.displayName,
      name: input.name.trim(),
      phoneLast4: normalizePhoneLast4(input.phoneLast4),
      email: input.email.toLowerCase(),
      editPasswordHash: passwordHash,
      status: "CONFIRMED",
      privacyConsent: true,
      privacyConsentAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      canceledAt: null
    });

    tx.update(seatRef, {
      status: "RESERVED",
      reservationId: reservationRef.id,
      updatedAt: FieldValue.serverTimestamp()
    });

    tx.create(db.collection("notificationJobs").doc(), {
      reservationId: reservationRef.id,
      type: "EMAIL",
      event: "RESERVED",
      recipient: input.email.toLowerCase(),
      payload: {
        name: input.name.trim(),
        seatDisplayName: seat.displayName
      },
      status: "PENDING",
      errorMessage: null,
      createdAt: FieldValue.serverTimestamp(),
      sentAt: null
    });

    return {
      reservationId: reservationRef.id,
      seatDisplayName: seat.displayName
    };
  });
});
```

## 6. 예약 조회 로직

`lookupReservation` 요청:

```json
{
  "name": "홍길동",
  "phoneLast4": "5678",
  "editPassword": "1234"
}
```

처리:

1. 이름과 전화번호 뒤 4자리로 `reservations`를 검색한다.
2. 상태가 `CONFIRMED`인 예약만 대상으로 한다.
3. 후보가 여러 명이면 수정 비밀번호 해시를 순차 검증한다.
4. 일치하는 예약이 있으면 좌석 정보를 반환한다.
5. 없으면 동일한 실패 메시지를 반환한다.

응답:

```json
{
  "reservationId": "reservation_xxx",
  "name": "홍길동",
  "phoneLast4": "5678",
  "emailMasked": "u***@example.com",
  "seat": {
    "displayName": "A열 12번"
  },
  "status": "CONFIRMED"
}
```

보안상 실패 사유는 구체적으로 나누지 않는다.

```txt
예약 정보를 찾을 수 없습니다. 입력 정보를 다시 확인해주세요.
```

## 7. 좌석 변경 로직

`changeSeat` 요청:

```json
{
  "name": "홍길동",
  "phoneLast4": "5678",
  "editPassword": "1234",
  "newSeatId": "seat_MAIN_B_8"
}
```

처리:

- 본인 확인을 먼저 수행한다.
- Firestore Transaction 안에서 기존 좌석과 새 좌석을 함께 갱신한다.
- 새 좌석이 `AVAILABLE`일 때만 변경한다.
- 기존 좌석은 `AVAILABLE`로 되돌린다.
- 새 좌석은 `RESERVED`로 변경한다.
- 변경 이메일 발송 작업을 생성한다.

## 8. 예약 취소 로직

`cancelReservation` 요청:

```json
{
  "name": "홍길동",
  "phoneLast4": "5678",
  "editPassword": "1234"
}
```

처리:

- 본인 확인을 먼저 수행한다.
- 예약 상태를 `CANCELED`로 변경한다.
- 좌석 상태를 `AVAILABLE`로 되돌린다.
- 취소 이메일 발송 작업을 생성한다.

## 9. Firestore Security Rules 예시

```js
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() {
      return request.auth != null;
    }

    function isAdmin() {
      return isSignedIn() && request.auth.token.admin == true;
    }

    match /seats/{seatId} {
      allow read: if true;
      allow write: if false;
    }

    match /reservations/{reservationId} {
      allow read, write: if isAdmin();
    }

    match /notificationJobs/{jobId} {
      allow read, write: if isAdmin();
    }

    match /adminLogs/{logId} {
      allow read: if isAdmin();
      allow write: if false;
    }
  }
}
```

핵심:

- `seats`는 공개 읽기 가능하지만 개인정보가 없다.
- `seats` 쓰기는 클라이언트에서 금지한다.
- `reservations`는 관리자만 직접 읽을 수 있다.
- 일반 예약자의 조회/변경/취소는 Cloud Functions 응답으로만 제공한다.

## 10. 이메일 발송

권장 provider:

- Resend
- SendGrid
- AWS SES

발신 주소:

```txt
From: 행사 좌석예약 <no-reply@행사도메인.com>
Reply-To: 운영자 이메일
To: 예약자가 입력한 이메일
```

개인 Gmail 또는 네이버 메일로 대량 발송하지 않는다. 발송 서비스에서 도메인을 인증한 뒤 `no-reply@도메인` 형태를 사용한다.

예약 완료 이메일 예:

```txt
제목: [행사 좌석 예약 완료] A열 12번

홍길동님, 좌석 예약이 완료되었습니다.

좌석: A열 12번
예약일시: 2026.05.20 14:30

예약 조회, 변경, 취소 시 이름, 전화번호 뒤 4자리, 수정 비밀번호가 필요합니다.
```

## 11. 환경 변수와 Secret

## 11.1 Vercel 환경 변수

Vercel에는 브라우저에서 필요한 Firebase client config만 등록한다.

```txt
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_SITE_URL
```

주의:

- `NEXT_PUBLIC_` 값은 브라우저에 노출된다.
- Firebase client config는 노출되어도 되는 값이지만, Firestore Security Rules와 Cloud Functions 권한 설계가 반드시 안전해야 한다.
- 이메일 발송 API 키는 Vercel에 두지 않는다.

## 11.2 Firebase Functions Secret

Firebase Functions에는 서버에서만 사용하는 secret을 둔다.

```txt
RESEND_API_KEY
EMAIL_FROM
EMAIL_REPLY_TO
PUBLIC_SITE_URL
```

클라이언트에 노출 가능한 Firebase config와 이메일 API 키를 혼동하면 안 된다. 이메일 API 키는 반드시 Cloud Functions 쪽 secret으로 관리한다.

## 11.3 로컬 개발 환경

로컬에는 `.env.local`을 사용한다.

```txt
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

`.env.local`은 GitHub에 커밋하지 않는다.

## 12. GitHub, Vercel, Firebase 배포 흐름

## 12.1 GitHub 저장소

권장 브랜치:

```txt
main        운영 배포 브랜치
develop     개발 브랜치, 선택 사항
feature/*   기능 작업 브랜치
```

커밋 대상:

- 프론트엔드 코드
- Firebase Functions 코드
- Firestore Security Rules
- 문서

커밋 제외:

- `.env.local`
- Firebase service account JSON
- 이메일 발송 API 키
- 기타 secret

## 12.2 Vercel 배포

Vercel 설정:

- GitHub 저장소 연결
- Production Branch: `main`
- Framework Preset: Next.js 또는 React 프로젝트 설정에 맞게 선택
- Environment Variables에 Firebase client config 등록

배포 흐름:

```txt
GitHub main push
→ Vercel 자동 빌드
→ 프론트엔드 배포
→ 사용자는 Vercel 도메인으로 접속
→ 프론트엔드는 Firebase Cloud Functions 호출
```

## 12.3 Firebase 배포

Firebase에서 별도로 배포해야 하는 항목:

- Cloud Functions
- Firestore Security Rules
- Firestore Indexes

예상 명령:

```bash
firebase deploy --only functions
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

운영 전 확인:

- Vercel 배포 URL을 Firebase Auth authorized domains에 추가한다.
- Cloud Functions CORS 또는 callable function 설정을 Vercel 도메인 기준으로 확인한다.
- Firestore Rules Simulator로 일반 사용자가 `reservations`를 직접 읽을 수 없는지 확인한다.

## 12.4 배포 순서

초기 배포 순서:

1. Firebase 프로젝트 생성
2. Firestore 생성
3. Firebase Authentication 활성화
4. 관리자 계정 생성
5. 관리자 custom claims 설정
6. Firestore Security Rules 배포
7. Firestore Indexes 배포
8. Cloud Functions 배포
9. GitHub 저장소 생성 및 push
10. Vercel에서 GitHub 저장소 연결
11. Vercel 환경 변수 등록
12. Vercel 배포
13. Vercel 도메인을 Firebase Auth authorized domains에 등록
14. 좌석 seed 실행
15. 예약 동시성 테스트
16. 이메일 발송 테스트

## 13. 관리자 검색

관리자 검색 대상:

- 이름
- 전화번호 뒤 4자리
- 이메일
- 좌석명

검색 결과:

- 이름
- 전화번호 뒤 4자리
- 이메일
- 좌석 위치
- 상태
- 예약 일시

## 14. 테스트 계획

필수 테스트:

- 빈 좌석 조회
- 좌석 예약 성공
- 이미 예약된 좌석 예약 실패
- 같은 좌석 동시 예약 시 한 명만 성공
- 이름, 전화번호 뒤 4자리, 수정 비밀번호로 조회 성공
- 틀린 수정 비밀번호로 조회 실패
- 좌석 변경 성공
- 예약된 좌석으로 변경 실패
- 예약 취소 성공
- 취소 후 좌석 재예약 가능
- 이메일 발송 로그 생성
- 관리자 이름 검색 성공
- 관리자 CSV 다운로드 성공

동시성 테스트:

- 같은 `seatId`로 동시에 20개 예약 요청을 보낸다.
- 성공은 1건이어야 한다.
- 실패는 19건이어야 한다.
- 해당 좌석의 확정 예약은 1건이어야 한다.

## 15. 운영 체크리스트

- 실제 좌석 배치 검수
- 관리자 계정 생성
- Firebase 관리자 custom claims 설정
- Firestore Security Rules 배포 전 검수
- 일반 사용자가 `reservations` 컬렉션을 직접 읽을 수 없는지 확인
- 이메일 발신 도메인 인증
- 개인정보 처리방침 문구 확정
- 개인정보 수집 및 이용 동의 체크박스 확인
- 개인정보 보관 기간 및 삭제 방식 확정
- 예약 오픈 전 동시성 테스트
- 예약 오픈 전 테스트 예약 데이터 삭제
- 행사 전 CSV 다운로드 확인
- 발송 실패 재처리 방법 확인
