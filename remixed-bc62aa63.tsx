import { useState, useEffect, memo, useCallback, useRef } from "react";

const ROWS = 60, COLS = 40, TOTAL = ROWS * COLS;

function rowLbl(r) {
  if (r <= 26) return String.fromCharCode(64 + r);
  const r2 = r - 27;
  return String.fromCharCode(65 + Math.floor(r2 / 26)) + String.fromCharCode(65 + r2 % 26);
}
const sid  = (r, c) => `${r}:${c}`;
const slbl = (r, c) => `${rowLbl(r)}열 ${c}번`;
function genCode(used) {
  let c;
  do { c = String(Math.floor(1000 + Math.random() * 9000)); }
  while (used.has(c));
  return c;
}

const G = {
  dark:   "#1B5E20",
  mid:    "#2E7D32",
  light:  "#E8F5E9",
  avail:  "#66BB6A",
  hover:  "#A5D6A7",
  taken:  "#BDBDBD",
  warn:   "#E65100",
  warnBg: "#FFF3E0",
  blue:   "#1565C0",
  red:    "#C62828",
  teal:   "#00695C",
};

const BTN = (bg = G.mid, fg = "white", extra = {}) => ({
  background: bg, color: fg, border: "none", padding: "9px 18px",
  borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 600,
  fontFamily: "inherit", transition: "opacity .15s", ...extra,
});
const INP = {
  width: "100%", padding: "9px 12px", border: "1.5px solid #ddd",
  borderRadius: 8, fontSize: 14, outline: "none",
  boxSizing: "border-box", marginBottom: 10, fontFamily: "inherit",
};
const LBL = { fontSize: 12, fontWeight: 700, color: "#555", display: "block", marginBottom: 4 };

export default function App() {
  const [seats,   setSeats]   = useState({});
  const [codes,   setCodes]   = useState({});
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState("map");
  const [modal,   setModal]   = useState(null);
  const [pending, setPending] = useState(null);
  const [confirmed, setConfirmed] = useState(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [ferr, setFerr] = useState("");
  const [lcode, setLcode] = useState("");
  const [found, setFound] = useState(null);
  const [lmsg,  setLmsg]  = useState("");
  const prefill = useRef(null);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  async function load() {
    try {
      const r = await window.storage.get("eco_rsv_v2", true);
      if (r?.value) { const d = JSON.parse(r.value); setSeats(d.s || {}); setCodes(d.c || {}); }
    } catch {}
    setLoading(false);
  }

  async function save(s, c) {
    try { await window.storage.set("eco_rsv_v2", JSON.stringify({ s, c }), true); }
    catch { alert("저장 오류가 발생했습니다. 다시 시도해주세요."); }
  }

  const clickSeat = useCallback((r, c) => {
    const id = sid(r, c);
    if (seats[id]) return;
    setPending({ r, c, id });
    setForm(prefill.current || { name: "", phone: "", email: "" });
    prefill.current = null;
    setFerr("");
    setModal("reserve");
  }, [seats]);

  async function doReserve() {
    if (!form.name.trim()) { setFerr("이름을 입력해주세요."); return; }
    if (!form.phone.trim() && !form.email.trim()) { setFerr("전화번호 또는 이메일을 하나 이상 입력해주세요."); return; }
    let fs = seats, fc = codes;
    try {
      const r = await window.storage.get("eco_rsv_v2", true);
      if (r?.value) { const d = JSON.parse(r.value); fs = d.s || {}; fc = d.c || {}; setSeats(fs); setCodes(fc); }
    } catch {}
    if (fs[pending.id]) { setFerr("방금 다른 사용자가 이 좌석을 예약했습니다. 다른 좌석을 선택해주세요."); return; }
    const code = genCode(new Set(Object.keys(fc)));
    const info = {
      name:  form.name.trim(),  phone: form.phone.trim(),
      email: form.email.trim(), code,
      label: slbl(pending.r, pending.c), id: pending.id,
      time:  new Date().toLocaleString("ko-KR"),
    };
    const ns = { ...fs, [pending.id]: info };
    const nc = { ...fc, [code]: pending.id };
    setSeats(ns); setCodes(nc);
    await save(ns, nc);
    setModal("confirm"); setConfirmed(info);
  }

  function doLookup() {
    setLmsg("");
    const id = codes[lcode];
    if (id && seats[id]) { setFound({ ...seats[id] }); }
    else { setFound(null); setLmsg("해당 예약번호를 찾을 수 없습니다."); }
  }

  async function doCancel(code) {
    if (!window.confirm("정말 예약을 취소하시겠습니까?")) return;
    const id = codes[code];
    const ns = { ...seats }, nc = { ...codes };
    delete ns[id]; delete nc[code];
    setSeats(ns); setCodes(nc); await save(ns, nc);
    setFound(null); setLcode(""); setLmsg("✅ 예약이 취소되었습니다.");
  }

  async function doChange(code) {
    const id = codes[code], old = seats[id];
    if (!window.confirm(`현재 좌석(${old.label}) 예약을 취소하고 새 좌석을 선택하시겠습니까?`)) return;
    const ns = { ...seats }, nc = { ...codes };
    delete ns[id]; delete nc[code];
    setSeats(ns); setCodes(nc); await save(ns, nc);
    prefill.current = { name: old.name, phone: old.phone, email: old.email };
    setFound(null); setLcode(""); setLmsg(""); setTab("map");
    setTimeout(() => alert(`기존 좌석(${old.label}) 예약이 취소되었습니다.\n새 좌석을 클릭하여 예약해주세요.`), 150);
  }

  const reserved = Object.keys(seats).length;

  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", background: G.light }}>
      <div style={{ fontSize: 48 }}>🌿</div>
      <div style={{ fontSize: 20, color: G.mid, fontWeight: 700, marginTop: 12 }}>생태전환교육 행사</div>
      <div style={{ color: "#888", marginTop: 8, fontSize: 14 }}>좌석 정보를 불러오는 중...</div>
    </div>
  );

  return (
    <div style={{ fontFamily: '"Noto Sans KR", sans-serif', background: G.light, minHeight: "100vh" }}>
      <style>{`
        .sa{background:${G.avail};transition:background .1s;cursor:pointer;}
        .sa:hover{background:${G.hover};}
        .st{background:${G.taken};cursor:not-allowed;}
        .lbtn{display:block;text-align:center;text-decoration:none;border-radius:8px;padding:9px 18px;font-weight:600;font-size:14px;font-family:inherit;cursor:pointer;}
        .mbtn:hover{opacity:.85;}
        input:focus{border-color:${G.mid}!important;box-shadow:0 0 0 2px ${G.light};}
      `}</style>

      {/* ─── Header ─── */}
      <div style={{ background: `linear-gradient(135deg,${G.dark},${G.mid})`, color: "white", padding: "13px 20px", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 12px rgba(0,0,0,.25)" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>🌿 생태전환교육 행사 좌석 예약</div>
            <div style={{ fontSize: 11, opacity: .8, marginTop: 3 }}>
              전체 {TOTAL.toLocaleString()}석 &nbsp;|&nbsp; 예약 {reserved.toLocaleString()}석 &nbsp;|&nbsp;
              <span style={{ color: "#A5D6A7", fontWeight: 700 }}>잔여 {(TOTAL - reserved).toLocaleString()}석</span>
            </div>
          </div>
          <button className="mbtn" onClick={() => { setTab(t => t === "map" ? "lookup" : "map"); setFound(null); setLmsg(""); setLcode(""); }}
            style={{ background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.4)", color: "white", padding: "7px 14px", borderRadius: 20, cursor: "pointer", fontSize: 12, whiteSpace: "nowrap", fontFamily: "inherit" }}>
            {tab === "map" ? "🔍 예약 조회 / 변경" : "🪑 좌석 선택"}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: 16 }}>
        {tab === "lookup"
          ? <LookupPanel code={lcode} setCode={setLcode} onLookup={doLookup} found={found} msg={lmsg} onCancel={doCancel} onChange={doChange} />
          : <>
              <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 12, fontSize: 12, flexWrap: "wrap" }}>
                {[[G.avail, "예약 가능"], [G.taken, "예약 완료"], [G.hover, "마우스 오버"]].map(([c, l]) => (
                  <span key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 2, background: c, display: "inline-block", flexShrink: 0 }} />
                    {l}
                  </span>
                ))}
              </div>
              <div style={{ background: G.dark, color: "white", textAlign: "center", padding: "7px 16px", borderRadius: "8px 8px 0 0", fontSize: 12, fontWeight: 700, letterSpacing: 6 }}>★ 무  대 ★</div>
              <div style={{ background: "white", border: `1px solid #C8E6C9`, borderTop: "none", borderRadius: "0 0 8px 8px", padding: "10px 8px", overflowX: "auto" }}>
                <SeatMap seats={seats} onSeatClick={clickSeat} />
              </div>
              <div style={{ textAlign: "center", fontSize: 11, color: "#bbb", marginTop: 10 }}>
                좌석을 클릭하여 예약하세요 · 예약 완료 후 4자리 예약번호를 꼭 저장해두세요
              </div>
            </>
        }
      </div>

      {/* ─── 예약 모달 ─── */}
      {modal === "reserve" && pending && (
        <ModalWrap onClose={() => { setModal(null); setPending(null); }}>
          <div style={{ background: "white", borderRadius: 14, padding: 24, width: 340, maxWidth: "92vw", boxShadow: "0 20px 60px rgba(0,0,0,.22)" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: G.mid, marginBottom: 6 }}>🪑 좌석 예약</div>
            <div style={{ background: G.light, borderRadius: 8, padding: "10px 12px", marginBottom: 16, fontSize: 13, color: G.dark, fontWeight: 700 }}>
              📍 선택 좌석: {slbl(pending.r, pending.c)}
            </div>
            <label style={LBL}>이름 <Req /></label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="홍길동" style={INP} />
            <label style={LBL}>전화번호 <Hint>(예약번호 발송)</Hint></label>
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="010-0000-0000" type="tel" style={INP} />
            <label style={LBL}>이메일 <Hint>(예약번호 발송)</Hint></label>
            <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="example@email.com" type="email" style={INP}
              onKeyDown={e => e.key === "Enter" && doReserve()} />
            {ferr && <div style={{ background: "#FFEBEE", color: G.red, padding: "8px 10px", borderRadius: 6, fontSize: 12, marginBottom: 8 }}>{ferr}</div>}
            <div style={{ fontSize: 11, color: "#aaa", marginBottom: 14 }}>* 전화번호·이메일 중 하나 이상 필수 입력</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="mbtn" onClick={() => { setModal(null); setPending(null); }} style={BTN("#f5f5f5", "#555", { flex: 1, border: "1px solid #ddd" })}>취소</button>
              <button className="mbtn" onClick={doReserve} style={BTN(G.mid, "white", { flex: 2 })}>예약 완료</button>
            </div>
          </div>
        </ModalWrap>
      )}

      {/* ─── 확인 모달 ─── */}
      {modal === "confirm" && confirmed && (
        <ModalWrap onClose={() => { setModal(null); setPending(null); setConfirmed(null); }}>
          <ConfirmCard info={confirmed} onClose={() => { setModal(null); setPending(null); setConfirmed(null); }} />
        </ModalWrap>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
const SeatMap = memo(function SeatMap({ seats, onSeatClick }) {
  const sections = [
    { label: "앞좌석 (A~T열)", rows: [1, 20] },
    { label: "중간좌석 (U~AN열)", rows: [21, 40] },
    { label: "뒷좌석 (AO~BH열)", rows: [41, 60] },
  ];
  return (
    <div style={{ userSelect: "none", overflowY: "auto", maxHeight: 540 }}>
      {sections.map(({ label, rows: [from, to] }) => (
        <div key={label}>
          <div style={{ fontSize: 10, color: "#999", textAlign: "center", padding: "6px 0 4px", borderBottom: "1px solid #f0f0f0", marginBottom: 4, letterSpacing: 1 }}>{label}</div>
          {Array.from({ length: to - from + 1 }, (_, ri) => {
            const r = from + ri;
            return (
              <div key={r} style={{ display: "flex", alignItems: "center", marginBottom: 2 }}>
                <div style={{ width: 18, fontSize: 8, color: "#ccc", textAlign: "right", marginRight: 3, flexShrink: 0 }}>{rowLbl(r)}</div>
                <div style={{ display: "flex", gap: 2 }}>
                  {Array.from({ length: 20 }, (_, ci) => {
                    const c = ci + 1, id = sid(r, c), tk = !!seats[id];
                    return <div key={c} title={tk ? `${slbl(r, c)} (예약완료)` : slbl(r, c)} onClick={tk ? undefined : () => onSeatClick(r, c)}
                      className={tk ? "st" : "sa"} style={{ width: 11, height: 11, borderRadius: 2, flexShrink: 0 }} />;
                  })}
                </div>
                <div style={{ width: 10, flexShrink: 0 }} />
                <div style={{ display: "flex", gap: 2 }}>
                  {Array.from({ length: 20 }, (_, ci) => {
                    const c = ci + 21, id = sid(r, c), tk = !!seats[id];
                    return <div key={c} title={tk ? `${slbl(r, c)} (예약완료)` : slbl(r, c)} onClick={tk ? undefined : () => onSeatClick(r, c)}
                      className={tk ? "st" : "sa"} style={{ width: 11, height: 11, borderRadius: 2, flexShrink: 0 }} />;
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
});

// ──────────────────────────────────────────────────────────────────
function ModalWrap({ children, onClose }) {
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16, backdropFilter: "blur(2px)" }}>
      {children}
    </div>
  );
}

function Req() { return <span style={{ color: "#c00" }}>*</span>; }
function Hint({ children }) { return <span style={{ fontSize: 11, fontWeight: 400, color: "#aaa" }}>&nbsp;{children}</span>; }

// ──────────────────────────────────────────────────────────────────
function ConfirmCard({ info, onClose }) {
  const [copied, setCopied] = useState(false);
  const body = `[생태전환교육 행사] 좌석 예약 완료\n\n예약자: ${info.name}\n좌  석: ${info.label}\n예약번호: ${info.code}\n예약일시: ${info.time}\n\n※ 예약번호(${info.code})는 좌석 변경·취소 시 필요합니다.`;
  const mLink = info.email ? `mailto:${info.email}?subject=[생태전환교육] 좌석 예약 확인 (예약번호: ${info.code})&body=${encodeURIComponent(body)}` : null;
  const sLink = info.phone ? `sms:${info.phone}?body=${encodeURIComponent(`[생태전환교육 행사] ${info.label} 예약완료 | 예약번호: ${info.code}`)}` : null;
  function copy() { navigator.clipboard?.writeText(info.code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); }); }

  return (
    <div style={{ background: "white", borderRadius: 14, padding: 24, width: 340, maxWidth: "92vw", boxShadow: "0 20px 60px rgba(0,0,0,.22)", maxHeight: "90vh", overflowY: "auto" }}>
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 44 }}>✅</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: G.mid, marginTop: 6 }}>예약이 완료되었습니다!</div>
      </div>
      <div style={{ background: G.light, borderRadius: 10, padding: "14px 16px", marginBottom: 14 }}>
        {[["예약자", info.name], ["좌 석", info.label], ["예약일시", info.time]].map(([k, v]) => (
          <KV key={k} k={k} v={v} />
        ))}
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
          <span style={{ color: "#888", width: 60, fontSize: 13, flexShrink: 0 }}>예약번호</span>
          <span style={{ fontWeight: 800, fontSize: 24, color: G.dark, letterSpacing: 4 }}>{info.code}</span>
          <button className="mbtn" onClick={copy} style={{ background: copied ? "#C8E6C9" : "#f0f0f0", border: "none", borderRadius: 5, padding: "3px 9px", cursor: "pointer", fontSize: 11, color: copied ? G.mid : "#555", fontFamily: "inherit" }}>
            {copied ? "복사됨!" : "복사"}
          </button>
        </div>
        {info.phone && <KV k="전화번호" v={info.phone} />}
        {info.email && <KV k="이메일" v={info.email} />}
      </div>
      <div style={{ background: G.warnBg, borderRadius: 8, padding: "10px 12px", fontSize: 12, color: G.warn, marginBottom: 14, lineHeight: 1.6 }}>
        ⚠️ <strong>예약번호 [{info.code}]</strong>를 반드시 메모해두세요!<br />
        좌석 변경·취소 시 필요합니다.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
        {mLink && <a href={mLink} className="lbtn mbtn" style={{ background: G.blue, color: "white" }}>📧 이메일로 예약정보 발송</a>}
        {sLink && <a href={sLink} className="lbtn mbtn" style={{ background: G.teal, color: "white" }}>💬 SMS로 예약정보 발송</a>}
      </div>
      <button className="mbtn" onClick={onClose} style={BTN(G.mid, "white", { width: "100%" })}>확인</button>
    </div>
  );
}

function KV({ k, v }) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 6, fontSize: 13 }}>
      <span style={{ color: "#888", width: 60, flexShrink: 0 }}>{k}</span>
      <span style={{ fontWeight: 600, color: G.dark, wordBreak: "break-all" }}>{v}</span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
function LookupPanel({ code, setCode, onLookup, found, msg, onCancel, onChange }) {
  return (
    <div style={{ maxWidth: 440, margin: "20px auto 0" }}>
      <h2 style={{ color: G.mid, textAlign: "center", marginBottom: 4, fontSize: 20, fontWeight: 700 }}>예약 조회 / 변경 / 취소</h2>
      <p style={{ textAlign: "center", color: "#888", fontSize: 13, marginBottom: 20 }}>예약 시 받은 4자리 예약번호를 입력하세요</p>
      <div style={{ background: "white", borderRadius: 12, padding: 20, boxShadow: "0 2px 16px rgba(0,0,0,.08)" }}>
        <label style={LBL}>예약번호 (4자리 숫자)</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="0000" maxLength={4} onKeyDown={e => e.key === "Enter" && onLookup()}
            style={{ ...INP, marginBottom: 0, textAlign: "center", fontSize: 26, fontWeight: 800, letterSpacing: 8, flex: 1 }} />
          <button className="mbtn" onClick={onLookup} style={BTN()}>조회</button>
        </div>
        {msg && (
          <div style={{ padding: "10px 12px", borderRadius: 8, fontSize: 13, marginBottom: 10, background: msg.startsWith("✅") ? G.light : "#FFEBEE", color: msg.startsWith("✅") ? G.mid : G.red }}>
            {msg}
          </div>
        )}
        {found && (
          <div style={{ borderTop: "1px solid #eee", paddingTop: 14 }}>
            <div style={{ background: G.light, borderRadius: 8, padding: "12px 14px", marginBottom: 14 }}>
              <KV k="예약자" v={found.name} />
              <KV k="좌 석" v={found.label} />
              <div style={{ display: "flex", gap: 8, marginBottom: 6, fontSize: 13 }}>
                <span style={{ color: "#888", width: 60, flexShrink: 0 }}>예약번호</span>
                <span style={{ fontWeight: 800, fontSize: 18, color: G.dark, letterSpacing: 3 }}>{found.code}</span>
              </div>
              <KV k="예약일시" v={found.time} />
              {found.phone && <KV k="전화번호" v={found.phone} />}
              {found.email && <KV k="이메일" v={found.email} />}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="mbtn" onClick={() => onChange(found.code)} style={BTN(G.blue, "white", { flex: 1 })}>🔄 좌석 변경</button>
              <button className="mbtn" onClick={() => onCancel(found.code)} style={BTN(G.red, "white", { flex: 1 })}>❌ 예약 취소</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
