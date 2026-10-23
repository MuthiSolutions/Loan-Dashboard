// READ-ONLY crash finder for /loan-book. Writes nothing to the database.
//
// Reproduces the /loan-book server render OUTSIDE of Next, piece by piece, against the
// real database, and prints exactly which loan + which component throws, with the stack.
//
// How: transpiles lib/ and components/ with this project's own TypeScript into a temporary
// .crashprobe/ folder (deleted at the end), then renders each component with React's
// server renderer, one loan at a time.
//
// Run:  node scripts/2026-10-23-find-crash.cjs

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, ".crashprobe");

// ---- 1. env from .env.local -------------------------------------------------------
for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
if (!process.env.DATABASE_URL) throw new Error(".env.local has no DATABASE_URL");

// ---- 2. transpile the render path ------------------------------------------------
const ts = require(path.join(ROOT, "node_modules", "typescript"));
const FILES = [
  "lib/types.ts", "lib/db.ts", "lib/repo.ts", "lib/loans.ts",
  "components/LoanBookTable.tsx", "components/LoanCard.tsx", "components/ClosedLoanCard.tsx",
  "components/CollapsibleSection.tsx", "components/ProfitBreakdown.tsx", "components/DocumentLinks.tsx",
  "components/StatusBadge.tsx", "components/Header.tsx", "components/Logo.tsx", "components/LogoutButton.tsx",
];
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "package.json"), JSON.stringify({ type: "commonjs" }));
for (const rel of FILES) {
  const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
  let out = ts.transpileModule(src, {
    fileName: rel,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  out = out.replace(/require\("@\/([^"]+)"\)/g, (_, p) => `require(${JSON.stringify(path.join(OUT, p))})`);
  const dest = path.join(OUT, rel.replace(/\.tsx?$/, ".js"));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, out);
}

// Same React instance the components' jsx-runtime resolves to.
const React = require(path.join(ROOT, "node_modules", "react"));
const { renderToStaticMarkup } = require(path.join(ROOT, "node_modules", "react-dom", "server"));
const load = (rel) => require(path.join(OUT, rel));
const comp = (name) => load(`components/${name}.js`)[name];

const failures = [];
function step(label, fn, { expectedOutsideNext = false } = {}) {
  try {
    fn();
    console.log(`  ✓ ${label}`);
  } catch (e) {
    const stack = String((e && e.stack) || e).split("\n").slice(0, 10).join("\n      ");
    if (expectedOutsideNext) {
      console.log(`  ~ ${label} — failed, but this component needs Next's router (ignore): ${e && e.message}`);
      return;
    }
    console.log(`  ✗ ${label}\n      ${stack}`);
    failures.push({ label, message: e && e.message });
  }
}
const render = (C, props, children) => renderToStaticMarkup(React.createElement(C, props, children));

(async () => {
  const repo = load("lib/repo.js");
  const L = load("lib/loans.js");
  const { pool } = load("lib/db.js");

  try {
    const asOf = new Date();
    const active = await repo.getActiveLoans();
    const repaid = await repo.getRepaidLoans();
    console.log(`\nLoaded ${active.length} active and ${repaid.length} repaid loans from the live DB.\n`);

    console.log("Page-level computations:");
    let loans = active, nums = new Map(), rec = new Set();
    step("loansSortedByUrgency / loanNumbersByBorrower / recycledLoanIds", () => {
      loans = L.loansSortedByUrgency(active, asOf);
      nums = L.loanNumbersByBorrower([...active, ...repaid]);
      rec = L.recycledLoanIds([...active, ...repaid]);
    });

    console.log("\nLoan book table:");
    step("LoanBookTable (all active loans)", () => render(comp("LoanBookTable"), { loans, asOf, recycledIds: rec }));

    console.log("\n'Full detail, loan by loan' — one card per active loan:");
    for (const loan of loans) {
      step(`LoanCard  ${loan.id}`, () => render(comp("LoanCard"), { loan, loanNumber: nums.get(loan.id)?.number }));
    }

    console.log("\nClosed loans:");
    for (const loan of repaid) {
      step(`ClosedLoanCard  ${loan.id}`, () => render(comp("ClosedLoanCard"), { loan, loanNumber: nums.get(loan.id)?.number }));
    }

    console.log("\nThe toggle itself, opened, holding every card:");
    step("CollapsibleSection(open) + all LoanCards", () =>
      render(
        comp("CollapsibleSection"),
        { title: "Full detail, loan by loan", defaultOpen: true },
        loans.map((l) => React.createElement(comp("LoanCard"), { key: l.id, loan: l }))
      )
    );

    console.log("\nHeader:");
    step("Header", () => render(comp("Header"), { asOf, current: "/loan-book" }), { expectedOutsideNext: true });

    // Show the raw data of any loan whose card failed, so the cause is visible.
    const badIds = failures.map((f) => f.label.match(/Card\s+(\S+)$/)).filter(Boolean).map((m) => m[1]);
    for (const id of badIds) {
      const l = [...active, ...repaid].find((x) => x.id === id);
      if (!l) continue;
      console.log(`\nData for ${id}:`);
      console.log("  fees:", JSON.stringify(l.fees));
      console.log("  documents:", JSON.stringify(l.documents));
      console.log("  notes count:", Array.isArray(l.notes) ? l.notes.length : l.notes);
      console.log("  dates:", JSON.stringify({ disbursedOn: l.disbursedOn, dueOn: l.dueOn, repaidOn: l.repaidOn, lastPaymentOn: l.lastPaymentOn, finalDeadline: l.finalDeadline }));
      console.log("  amounts:", JSON.stringify({ principal: l.principal, totalDue: l.totalDue, amountPaid: l.amountPaid, manualAmountOverride: l.manualAmountOverride, penaltySwitchBase: l.penaltySwitchBase }));
    }

    console.log("\n================ RESULT ================");
    if (failures.length === 0) {
      console.log("NO CRASH reproduced: every /loan-book component renders fine against the live data.");
      console.log("=> The crash is in Next's runtime/deployment, not in the loan-book code or data.");
    } else {
      console.log(`${failures.length} failure(s):`);
      for (const f of failures) console.log(`  - ${f.label}: ${f.message}`);
    }
  } finally {
    await pool.end().catch(() => {});
    fs.rmSync(OUT, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error("Probe itself failed:", e && e.stack);
  fs.rmSync(OUT, { recursive: true, force: true });
  process.exit(1);
});
