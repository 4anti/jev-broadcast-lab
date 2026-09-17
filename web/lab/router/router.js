import { paintAnswers, bindRun, bindExamples, bootBooth, runSystemOne } from "../../shared/booth.js";

await bootBooth("router");

bindExamples(document.getElementById("examples"), [
  { label: "Double charge", text: "Charged twice for the same seat. I need the extra $49 back today or I am canceling." },
  { label: "Login lockout", text: "I cannot log in after the reset email. Password page loops. I have a demo in an hour." },
  { label: "Seat upgrade", text: "We want to add 12 seats this quarter. Can someone send a quote before Friday?" },
  { label: "Privacy letter", text: "Our counsel needs a DPA and a written answer on where EU ticket data is stored." },
  { label: "App crash", text: "The replay booth dies on iOS 18 when I open a long PGN. Happens every time." }
], (item) => { document.getElementById("ticket").value = item.text; });

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
