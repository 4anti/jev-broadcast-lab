import { paintAnswers, bindRun, bindExamples, bootBooth, runSystemOne } from "../../shared/booth.js";

await bootBooth("rank");

const DOC = [
  "Status: incident open",
  "Owner: billing-oncall",
  "The refund SLA is two business days after the charge is confirmed duplicate.",
  "Do not promise same-hour refunds in chat.",
  "Password resets go to support, not billing.",
  "Legal holds freeze refunds until counsel clears them.",
  "Chargeback codes live in the ledger, not this runbook.",
  "VIP seats still follow the same SLA.",
  "If the card network already reversed the charge, mark refund as n/a.",
  "Escalation: page billing-oncall when SLA will miss."
];

function lines() {
  const overflow = document.getElementById("overflow").checked;
  const out = DOC.map((text, i) => ({ id: "L" + String(i + 1).padStart(3, "0"), text }));
  if (overflow) {
    for (let i = out.length; i < 280; i++) {
      out.push({ id: "L" + String(i + 1).padStart(3, "0"), text: "padding line " + (i + 1) + " - not the SLA" });
    }
  }
  return out;
}

function paintDoc(all, hit) {
  const host = document.getElementById("lines");
  host.textContent = "";
  for (const row of all.slice(0, 40)) {
    const d = document.createElement("div");
    if (row.id === hit) d.className = "hit";
    const ln = document.createElement("span");
    ln.className = "ln";
    ln.textContent = row.id;
    const tx = document.createElement("span");
    tx.textContent = row.text;
    d.append(ln, tx);
    host.appendChild(d);
  }
  if (all.length > 40) {
    const more = document.createElement("div");
    more.textContent = "… " + (all.length - 40) + " more lines not painted";
    host.appendChild(more);
  }
}

paintDoc(lines(), null);

bindExamples(document.getElementById("examples"), [
  { label: "Refund SLA", query: "Where is the refund SLA?" },
  { label: "Password reset", query: "Who handles password resets?" },
  { label: "Chargeback", query: "Where do chargeback codes live?" },
  { label: "Escalation", query: "Who do I page if the SLA will miss?" },
  { label: "Legal hold", query: "What happens to refunds under a legal hold?" }
], (item) => { document.getElementById("query").value = item.query; });

bindRun(document.getElementById("runBtn"), async () => {
  const all = lines();
  const sent = all.slice(0, 255);
  document.getElementById("sentLegal").textContent = sent.length + " / " + all.length;
  const criteria = {};
  for (const row of sent) criteria[row.id] = row.text;
  const data = await runSystemOne({
    state: { query: document.getElementById("query").value, line_count: all.length, sent: sent.length },
    questions: {
      line: {
        type: "choice",
        instructions: "Which line best answers the query? Keys are line ids.",
        criteria
      },
      in_doc: {
        type: "noul",
        instructions: "The answer to the query is present in the sent lines."
      }
    }
  });
  const hit = data.answers && data.answers.line && data.answers.line.choice;
  paintDoc(all, hit);
  paintAnswers(document.getElementById("out"), data);
});
