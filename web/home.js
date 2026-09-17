import { bootChrome, setTicker } from "./shared/chrome.js";
import { paintAnswers, runSystemOne } from "./shared/booth.js";

const cfg = await bootChrome({ booth: "home" });
if (!cfg.hasEnvKey) {
  const kf = document.getElementById("keyField");
  if (kf) kf.style.display = "";
}
document.getElementById("proofKey").textContent = cfg.hasEnvKey ? "env" : "missing";
document.getElementById("proofModel").textContent = cfg.modelDefault || "jev-latest";
document.getElementById("proofQ").textContent = String(cfg.queueDepth ?? "—");
document.getElementById("proofTx").textContent = "config ok";

document.getElementById("probeBtn").addEventListener("click", async () => {
  const btn = document.getElementById("probeBtn");
  btn.disabled = true;
  try {
    const data = await runSystemOne({
      state: { page: "home", claim: "This lab is a broadcast playground for TypeSafe Jev." },
      questions: {
        what: {
          type: "choice",
          instructions: "What is this page describing?",
          criteria: {
            broadcast_lab: "A lab for closed-schema Jev calls",
            chess_engine: "A chess engine like Stockfish",
            chatbot: "A chat model that writes prose"
          }
        }
      }
    });
    paintAnswers(document.getElementById("out"), data);
    document.getElementById("proofTx").textContent =
      (data.answers && data.answers.what && data.answers.what.choice) || "ok";
  } catch (err) {
    document.getElementById("out").textContent = err.message || String(err);
    setTicker("error " + (err.message || err));
  } finally {
    btn.disabled = false;
  }
});
