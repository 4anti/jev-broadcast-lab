import { paintAnswers, bindRun, bootBooth, runSystemOne } from "../../shared/booth.js";

await bootBooth("call");

function parseAmount(raw) {
  const n = Number(String(raw).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

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
