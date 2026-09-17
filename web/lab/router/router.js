import { paintAnswers, bindRun, bootBooth, runSystemOne } from "../../shared/booth.js";

await bootBooth("router");

bindRun(document.getElementById("runBtn"), async () => {
  const ticket = document.getElementById("ticket").value.trim();
  const data = await runSystemOne({
    state: { ticket },
    questions: {
      team: {
        type: "choice",
        instructions: "Which desk should own this ticket?",
        criteria: {
          billing: "Charges, invoices, refunds, failed payments",
          support: "Product how-to, bugs, account access",
          sales: "Upgrades, quotes, new seats",
          legal: "Contracts, privacy, threats of suit"
        }
      },
      urgency: {
        type: "score",
        instructions: "How quickly should a human take this?",
        criteria: ["Whenever", "Today", "This hour", "Now"]
      },
      refund: {
        type: "noul",
        instructions: "The customer is requesting a refund of money already charged."
      }
    }
  });
  paintAnswers(document.getElementById("out"), data);
});
