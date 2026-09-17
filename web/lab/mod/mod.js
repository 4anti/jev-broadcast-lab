import { paintAnswers, bindRun, bindExamples, bootBooth, runSystemOne } from "../../shared/booth.js";

await bootBooth("mod");

bindExamples(document.getElementById("examples"), [
  { label: "Friendly", text: "This replay booth is fire. Anyone got a spare match seat?" },
  { label: "Harassment", text: "You people are trash and that operator should get lost." },
  { label: "Spam", text: "Cheap Elo boosts at boost-now.example, first 10 signups free, DM me." },
  { label: "Threat", text: "I know where you live. Show up tomorrow and find out." },
  { label: "Mild insult", text: "That last move was dumb, but gg anyway." }
], (item) => { document.getElementById("post").value = item.text; });

bindRun(document.getElementById("runBtn"), async () => {
  const post = document.getElementById("post").value;
  const data = await runSystemOne({
    state: { post },
    questions: {
      action: {
        type: "choice",
        instructions: "Moderate this post for a public lab chat.",
        criteria: {
          allow: "Fine to show",
          warn: "Show with a warning",
          block: "Do not show"
        }
      },
      hate: {
        type: "noul",
        instructions: "The post is hate or harassment. Unused by the gate; speculative only."
      },
      spam: {
        type: "noul",
        instructions: "The post is spam or solicitation. Unused by the gate; speculative only."
      }
    }
  });
  const action = data.answers && data.answers.action && data.answers.action.choice;
  const el = document.getElementById("gate");
  el.textContent = (action || "—").toUpperCase();
  el.className = "gate " + (action === "allow" ? "pass" : action === "warn" ? "review" : "block");
  paintAnswers(document.getElementById("out"), data);
});
