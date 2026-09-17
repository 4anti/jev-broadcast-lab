import { paintAnswers, bindRun, bindExamples, bootBooth, runSystemOne } from "../../shared/booth.js";

await bootBooth("call");

function parseAmount(raw) {
  const n = Number(String(raw).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

bindExamples(document.getElementById("examples"), [
  { label: "Duplicate refund", utter: "Refund the duplicate $49.50 to this card, reason duplicate_charge.", amount: "49.50" },
  { label: "Search tickets", utter: "Find open tickets for this account from last week.", amount: "" },
  { label: "Page on-call", utter: "SLA will miss in twenty minutes. Page billing-oncall now.", amount: "" },
  { label: "Small talk", utter: "Thanks, that screenshot helped. I am good for now.", amount: "" },
  { label: "Goodwill credit", utter: "Issue a $20 service credit for the downtime last night.", amount: "20" }
], (item) => {
  document.getElementById("utter").value = item.utter;
  document.getElementById("amountHint").value = item.amount;
});

bindRun(document.getElementById("runBtn"), async () => {
  const utter = document.getElementById("utter").value;
  const amount = parseAmount(document.getElementById("amountHint").value);
  const data = await runSystemOne({
    state: { utter, amount_parsed: amount },
    questions: {
      fn: {
        type: "choice",
        instructions: "Which function should run?",
        criteria: {
          search_tickets: "Look up tickets",
          create_refund: "Issue a refund",
          page_oncall: "Page a human",
          none: "No tool"
        }
      },
      reason: {
        type: "choice",
        instructions: "If refunding, which reason enum? Use none if not a refund.",
        criteria: {
          duplicate_charge: "Charged twice",
          service_credit: "Goodwill credit",
          chargeback_avoid: "Defensive refund",
          none: "Not a refund"
        }
      }
    }
  });
  const fn = data.answers && data.answers.fn && data.answers.fn.choice;
  const reason = data.answers && data.answers.reason && data.answers.reason.choice;
  const mapped = {
    function: fn,
    args: fn === "create_refund" ? { amount, currency: "USD", reason } : {},
    note: "amount comes from Number() in this page, not from Jev."
  };
  document.getElementById("callout").textContent = JSON.stringify(mapped, null, 2);
  paintAnswers(document.getElementById("out"), data);
});
