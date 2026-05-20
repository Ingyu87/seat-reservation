# 관리자 계정 설정 (admin@re.kr)

관리자 이메일은 코드에 고정되어 있지 않습니다. **Firebase Authentication**에 계정을 만들고 `admin: true` 권한을 부여하면 됩니다.

기존 관리자 계정을 바꿔도 됩니다. `admin@re.kr`로 새로 만들면 됩니다.

## 1. Firebase에서 사용자 추가

1. [Firebase Console](https://console.firebase.google.com) → 프로젝트 `seat-reservation-7f4c5`
2. **Authentication** → **사용자** → **사용자 추가**
3. 이메일: `admin@re.kr`
4. 비밀번호: 안전한 비밀번호 설정 (직접 관리)

## 2. 관리자 권한(admin claim) 부여

Firebase Console UI에서는 custom claim을 넣을 수 없어, 아래 스크립트를 한 번 실행합니다.

### 준비

1. Firebase Console → **프로젝트 설정** → **서비스 계정** → **새 비공개 키 생성** (JSON 저장)
2. PowerShell:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\경로\serviceAccountKey.json"
node scripts/grant-admin.mjs admin@re.kr
```

성공 메시지가 나오면 완료입니다.

## 3. 로그인

- URL: https://seat-reservation-admin.vercel.app/login
- 이메일: `admin@re.kr`
- 비밀번호: 1단계에서 설정한 비밀번호

**로그아웃 후 다시 로그인**해야 권한이 반영됩니다.

## 4. 예전 관리자 계정

다른 이메일을 쓰던 경우:

- Firebase Authentication에서 **해당 사용자 비활성화 또는 삭제** (선택)
- `admin@re.kr`만 `admin` claim 유지

## 5. 행사 종료 후

개인정보는 **행사 종료 후** 관리자 사이트에서 **「예약 전체 초기화」**로 예약·좌석 예약 상태를 정리합니다. (개인정보 처리방침 참고)
