import fs from "node:fs";
import path from "node:path";

export default function PrivacyPage() {
  const policy = fs.readFileSync(path.join(process.cwd(), "privacy-policy.md"), "utf8");

  return (
    <main className="page">
      <article className="panel" style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
        {policy}
      </article>
    </main>
  );
}
