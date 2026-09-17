import { paintAnswers, bindRun, bootBooth, runSystemOne } from "../../shared/booth.js";

await bootBooth("mod");

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
