import { paintAnswers, bindExamples, bootBooth, runSystemOne } from "../../shared/booth.js";
import { setTicker } from "../../shared/chrome.js";

await bootBooth("loop");

const SIZE = 8;
const MAPS = {
  chase: { x: 1, y: 6, dir: "e", hp: 5, ammo: 3, foe: { x: 6, y: 1 }, last: "wait" },
  adjacent: { x: 3, y: 3, dir: "e", hp: 5, ammo: 3, foe: { x: 4, y: 3 }, last: "wait" },
  noammo: { x: 1, y: 6, dir: "e", hp: 5, ammo: 0, foe: { x: 2, y: 6 }, last: "wait" },
  behind: { x: 4, y: 4, dir: "e", hp: 5, ammo: 3, foe: { x: 3, y: 4 }, last: "wait" },
  lowhp: { x: 2, y: 2, dir: "n", hp: 1, ammo: 2, foe: { x: 2, y: 3 }, last: "wait" }
};

let mapKey = "chase";
let world = structuredClone(MAPS.chase);
let running = false;
let serial = 0;

function dist(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function paintWorld() {
  const host = document.getElementById("world");
  host.textContent = "";
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const c = document.createElement("div");
      c.className = "cell";
      if (x === world.x && y === world.y) {
        c.classList.add("you");
        c.textContent = world.dir[0].toUpperCase();
      } else if (x === world.foe.x && y === world.foe.y) {
        c.classList.add("foe");
        c.textContent = "E";
      }
      host.appendChild(c);
    }
  }
  document.getElementById("stats").textContent = world.hp + " / " + world.ammo;
}

function logLine(text) {
  const el = document.getElementById("log");
  const d = document.createElement("div");
  d.textContent = text;
  el.prepend(d);
}

function showErr(text) {
  document.getElementById("err").textContent = text || "";
}

function apply(choice, fire) {
  const step = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };
  if (choice && choice.startsWith("move_")) {
    const k = choice.slice(5);
    const d = step[k];
    if (d) {
      world.x = Math.max(0, Math.min(SIZE - 1, world.x + d[0]));
      world.y = Math.max(0, Math.min(SIZE - 1, world.y + d[1]));
      world.dir = k;
    }
  } else if (choice === "turn_left") {
    world.dir = { n: "w", w: "s", s: "e", e: "n" }[world.dir];
  } else if (choice === "turn_right") {
    world.dir = { n: "e", e: "s", s: "w", w: "n" }[world.dir];
  }
  world.last = choice;
  if (fire && fire >= 0.6 && world.ammo > 0) {
    world.ammo -= 1;
    const d = step[world.dir];
    if (d && world.x + d[0] === world.foe.x && world.y + d[1] === world.foe.y) {
      world.foe = { x: Math.floor(Math.random() * SIZE), y: Math.floor(Math.random() * SIZE) };
      logLine("hit. foe respawned.");
    } else {
      logLine("shot " + world.dir + " missed.");
    }
  }
  if (dist(world, world.foe) <= 1) world.hp = Math.max(0, world.hp - 1);
}

paintWorld();

bindExamples(document.getElementById("examples"), [
  { label: "Chase", key: "chase" },
  { label: "Adjacent", key: "adjacent" },
  { label: "No ammo", key: "noammo" },
  { label: "Behind", key: "behind" },
  { label: "Low HP", key: "lowhp" }
], (item) => {
  if (running) return;
  mapKey = item.key;
  world = structuredClone(MAPS[mapKey]);
  showErr("");
  paintWorld();
});

document.getElementById("runBtn").addEventListener("click", async () => {
  world = structuredClone(MAPS[mapKey]);
  running = true;
  serial += 1;
  const mine = serial;
  showErr("");
  document.getElementById("runBtn").disabled = true;
  document.getElementById("stopBtn").disabled = false;
  document.getElementById("log").textContent = "";
  paintWorld();
  const max = Number(document.getElementById("maxTicks").value) || 8;
  const hz = Math.min(4, Math.max(0.2, Number(document.getElementById("hz").value) || 1));
  const gap = 1000 / hz;
  for (let i = 0; i < max && running && serial === mine; i++) {
    document.getElementById("tickN").textContent = String(i + 1);
    const snapshot = {
      x: world.x,
      y: world.y,
      dir: world.dir,
      hp: world.hp,
      ammo: world.ammo,
      foe: world.foe,
      dist: dist(world, world.foe)
    };
    try {
      const data = await runSystemOne({
        state: snapshot,
        questions: {
          act: {
            type: "choice",
            instructions: "Next action on this 8x8 grid. Stay in bounds.",
            criteria: {
              move_n: "North",
              move_e: "East",
              move_s: "South",
              move_w: "West",
              turn_left: "Turn left",
              turn_right: "Turn right",
              wait: "Wait"
            }
          },
          fire: {
            type: "noul",
            instructions: "Fire this tick. Ammo is limited."
          },
          threat: {
            type: "score",
            instructions: "How threatened is the player?",
            criteria: ["Safe", "Watch", "Danger", "Critical"]
          }
        },
        timeoutMs: 20000
      });
      if (serial !== mine) return;
      const act = data.answers && data.answers.act && data.answers.act.choice;
      const fire = data.answers && data.answers.fire && data.answers.fire.noul;
      const threat = data.answers && data.answers.threat && data.answers.threat.score;
      apply(act, fire);
      paintWorld();
      paintAnswers(document.getElementById("out"), data);
      document.getElementById("lastAct").textContent = act || "—";
      document.getElementById("lastFire").textContent = typeof fire === "number" ? fire.toFixed(2) : "—";
      document.getElementById("lastThreat").textContent = typeof threat === "number" ? threat.toFixed(2) : "—";
      logLine("t" + (i + 1) + " " + act + " fire=" + (typeof fire === "number" ? fire.toFixed(2) : "—"));
      setTicker("grid t" + (i + 1) + " " + act);
    } catch (err) {
      const msg = err.message || String(err);
      logLine("error " + msg);
      showErr(msg);
      setTicker("error " + msg);
      break;
    }
    if (world.hp <= 0) {
      logLine("down.");
      showErr("HP hit zero. Stopped.");
      break;
    }
    await new Promise((r) => setTimeout(r, gap));
  }
  running = false;
  document.getElementById("runBtn").disabled = false;
  document.getElementById("stopBtn").disabled = true;
});

document.getElementById("stopBtn").addEventListener("click", () => {
  running = false;
  serial += 1;
  document.getElementById("runBtn").disabled = false;
  document.getElementById("stopBtn").disabled = true;
});
