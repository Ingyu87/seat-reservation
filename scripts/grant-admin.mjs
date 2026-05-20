/**
 * 관리자 custom claim(admin: true) 부여
 *
 * 사용 전:
 * 1. Firebase Console > Authentication > 사용자 추가
 *    이메일: admin@re.kr, 비밀번호 설정
 * 2. 서비스 계정 키 다운로드 후 환경 변수 설정:
 *    set GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\serviceAccountKey.json
 * 3. 실행:
 *    node scripts/grant-admin.mjs admin@todxo.kr
 *    node scripts/grant-admin.mjs --uid q7bX0fR3nVYaPj1SP94iDaJn6jA3
 */

import { readFileSync } from "node:fs";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const args = process.argv.slice(2);
const uidFlag = args.indexOf("--uid");
const identifier = uidFlag >= 0 ? args[uidFlag + 1] : args[0];

if (!identifier) {
  console.error("사용법: node scripts/grant-admin.mjs <이메일>");
  console.error("       node scripts/grant-admin.mjs --uid <UID>");
  process.exit(1);
}

let projectId = process.env.FIREBASE_PROJECT_ID;
if (!projectId) {
  try {
    const rc = JSON.parse(readFileSync(".firebaserc", "utf8"));
    projectId = rc.projects?.default;
  } catch {
    /* ignore */
  }
}

if (!projectId) {
  console.error("프로젝트 ID를 찾을 수 없습니다. FIREBASE_PROJECT_ID를 설정하세요.");
  process.exit(1);
}

if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  initializeApp({
    credential: applicationDefault(),
    projectId
  });
} else {
  console.error(
    "GOOGLE_APPLICATION_CREDENTIALS 환경 변수가 필요합니다.\n" +
      "Firebase Console > 프로젝트 설정 > 서비스 계정 > 새 비공개 키 생성"
  );
  process.exit(1);
}

const auth = getAuth();
const user = uidFlag >= 0 ? await auth.getUser(identifier) : await auth.getUserByEmail(identifier);
await auth.setCustomUserClaims(user.uid, { admin: true });
console.log(`OK: ${user.email ?? "(no email)"} (uid: ${user.uid}) 에 admin 권한을 부여했습니다.`);
console.log("관리자 사이트에서 로그아웃 후 다시 로그인하면 적용됩니다.");
