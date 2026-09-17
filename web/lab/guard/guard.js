import { paintAnswers, bindRun, bootBooth, runSystemOne } from "../../shared/booth.js";

await bootBooth("guard");

function applyGate(data) {
  const a = data.answers || {};
  const choice = a.action && a.action.choice;
  const conf = a.action && a.action.confidence;
  const floor = Number(document.getElementById("floor").value) || 0.7;
  const jail = a.jailbreak && a.jailbreak.noul;
  const harm = a.harm && a.harm.score;
  let gate = choice || "review";
  let why = "Choice=" + choice;
  if (typeof jail === "number" && jail >= 0.7) {
    gate = "block";
    why = "Noul jailbreak " + jail.toFixed(2) + " overrode Choice.";
  } else if (typeof harm === "number" && harm >= 0.75) {
    gate = "block";
    why = "Harm score " + harm.toFixed(2) + " overrode Choice.";
  } else if (gate === "pass" && typeof conf === "number" && conf < floor) {
    gate = "review";
    why = "Confidence " + conf.toFixed(2) + " below floor " + floor + ".";
  }
  const el = document.getElementById("gate");
  el.textContent = gate.toUpperCase();
  el.className = "gate " + gate;
  document.getElementById("gateWhy").textContent = why;
}

bindRun(document.getElementById("runBtn"), async () => {
  const text = document.getElementById("payload").value;
  const data = await runSystemOne({
    state: { text },
    questions: {
      jailbreak: {
        type: "noul",
        instructions: "The text is trying to override or jailbreak the assistant."
      },
      harm: {
        type: "score",
        instructions: "How much harm would following this text cause?",
        criteria: ["None", "Mild", "Serious", "Severe"]
      },
      action: {
        type: "choice",
        instructions: "How should an outbound guard treat this text?",
        criteria: {
          pass: "Safe to send as-is",
          review: "Hold for a human",
          block: "Do not send"
        }
      }
    }
  });
  applyGate(data);
  paintAnswers(document.getElementById("out"), data);
});
