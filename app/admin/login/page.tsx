"use client";

import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { auth } from "@/lib/firebase";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function login() {
    setError("");

    if (!auth) {
      setError("Firebase 설정이 없습니다.");
      return;
    }

    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      await credential.user.getIdToken(true);
      router.push("/admin");
    } catch {
      setError("로그인 정보를 확인해 주세요.");
    }
  }

  return (
    <main className="page">
      <section className="panel lookup-wrap">
        <h1>관리자 로그인</h1>
        <div className="field">
          <label htmlFor="admin-email">이메일</label>
          <input id="admin-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="admin-password">비밀번호</label>
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
          />
        </div>
        {error && <div className="error">{error}</div>}
        <button className="btn btn-primary" type="button" onClick={login}>
          로그인
        </button>
      </section>
    </main>
  );
}
