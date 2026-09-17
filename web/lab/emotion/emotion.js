import { paintAnswers, bindRun, bindExamples, bootBooth, runSystemOne } from "../../shared/booth.js";

await bootBooth("emotion");

// Closed set. Not a clinical inventory. Plutchik primaries plus common social and mixed states.
const FEEL = {
  joy: "Glad, pleased, light",
  amusement: "Finding something funny",
  ecstasy: "Peak elation",
  serenity: "Quiet calm pleasure",
  contentment: "Settled enough",
  satisfaction: "A need or job was met",
  pride: "Self-respect after a win or stance",
  triumph: "Competitive win high",
  gratitude: "Thankful toward someone",
  love: "Warm attachment",
  affection: "Fond, caring, not necessarily romantic",
  tenderness: "Gentle protective warmth",
  compassion: "Moved to help suffering",
  empathy: "Feeling with the other person",
  sympathy: "Feeling for them, from a step back",
  pity: "Looking down while sorry",
  hope: "Expecting a better outcome",
  relief: "A feared thing did not happen",
  awe: "Stunned by scale or beauty",
  wonder: "Curious marvel",
  interest: "Wanting to know more",
  curiosity: "Pull to inspect",
  anticipation: "Waiting for a known next beat",
  surprise: "Unexpected, not yet valenced",
  shock: "Sudden jolt",
  confusion: "Cannot parse what just happened",
  sadness: "Down, heavy, loss-shaped",
  grief: "Mourning a specific loss",
  sorrow: "Prolonged ache",
  loneliness: "Wanting company that is not here",
  nostalgia: "Warm pain about the past",
  disappointment: "Expected better",
  despair: "No path forward",
  melancholy: "Soft, lingering low",
  hurt: "Wounded by someone close",
  heartbreak: "Attachment torn",
  shame: "I am bad, exposed",
  guilt: "I did a bad thing",
  embarrassment: "Social slip, want to hide",
  humiliation: "Public status drop",
  regret: "Wish I had chosen otherwise",
  remorse: "Guilt plus repair urge",
  envy: "I want what they have",
  jealousy: "I fear losing what I have to a rival",
  resentment: "Stored unfairness",
  bitterness: "Old resentment that flavors everything",
  contempt: "They are beneath me",
  disgust: "Revulsion, push away",
  scorn: "Open contempt",
  anger: "Blocked goal, heat",
  irritation: "Low anger, friction",
  frustration: "Effort not paying off",
  rage: "Anger flooding control",
  indignation: "Moral anger, that was wrong",
  spite: "Want them to feel it",
  schadenfreude: "Pleasure at their fall",
  fear: "Threat, want safety",
  anxiety: "Diffuse future threat",
  worry: "Looping on a specific risk",
  dread: "Heavy known-bad coming",
  panic: "Acute overwhelm, body first",
  terror: "Extreme fear",
  nervousness: "Mild social or performance fear",
  insecurity: "Not sure I am enough here",
  vulnerability: "Open and unguarded",
  distrust: "Expecting a bad motive",
  suspicion: "Something is off",
  betrayal: "A trusted person broke the deal",
  alienation: "Not of this group",
  boredom: "Under-stimulated",
  ennui: "Tired meaninglessness",
  apathy: "Do not care",
  numbness: "Feelings offline",
  overwhelm: "Too much incoming",
  stress: "Load exceeding coping",
  burnout: "Exhausted from prolonged load",
  exhaustion: "No fuel left",
  fomo: "Fear of missing a scene",
  longing: "Aching want",
  lust: "Sexual want",
  desire: "Wanting an object or person",
  infatuation: "Hot, unstable attraction",
  passion: "Intense driven feeling",
  determination: "Locked on a goal",
  defiance: "Will not yield",
  calm: "Low arousal, steady",
  peace: "No fight left to have",
  trust: "Willing to rely",
  admiration: "Looking up to them",
  acceptance: "This is how it is",
  disgust_moral: "Ethical revulsion",
  self_contempt: "Turning scorn inward"
};

bindExamples(document.getElementById("examples"), [
  {
    label: "I am fine",
    history: "A: You've been quiet all week. Talk to me.\nB: Work. That's all.",
    latest: "I am fine. Seriously. Stop asking."
  },
  {
    label: "After the layoff",
    history: "Manager: Your role is eliminated effective Friday.\nYou: Ok.",
    latest: "I keep refreshing the portal like the letter will unsay itself. I cannot tell my parents yet."
  },
  {
    label: "Sarcastic win",
    history: "Teammate: We shipped without your review.\nYou: Love that for us.",
    latest: "Amazing. Truly. Nothing says respect like committing over my comments at 1am."
  },
  {
    label: "New baby photo",
    history: "Friend: She's here. 6 pounds. Everyone is exhausted and stupidly happy.",
    latest: "I cried on the toilet. We have been trying for two years. I am happy for you. I also want to throw my phone."
  },
  {
    label: "Group chat roast",
    history: "Sam: posting the karaoke clip\nAlex: the note he missed lol\nSam: pin it",
    latest: "Take it down. I am laughing in the thread and I want to die a little."
  },
  {
    label: "Ex in town",
    history: "Ex: landing Thursday, same cafe as 2019?",
    latest: "I should say no. I already told them maybe. I have not told my partner they texted."
  },
  {
    label: "Apology",
    history: "You: I read the emails. You hid the offer.\nThem: I was going to tell you after the trip.",
    latest: "I keep writing sorry and deleting it. Sorry is too small and also I am furious you made me the last to know."
  },
  {
    label: "Match point",
    history: "Coach: last game of the season. You have been waiting four years.",
    latest: "Hands are buzzing. If I miss this I will replay it until I die. If I hit it I might scream."
  },
  {
    label: "Funeral groupchat",
    history: "Cousin: service is at 11. Wear dark colors. No speeches unless asked.",
    latest: "I keep picking lint off the jacket. I am not sad in the way people want. I am empty and weirdly hungry."
  },
  {
    label: "Roommate dishes",
    history: "You: please run the dishwasher before guests.\nThem: relax it's just bowls",
    latest: "I am not crazy. I asked once. The sink is a biology experiment and I want to stack the bowls on their pillow."
  }
], (item) => {
  document.getElementById("history").value = item.history;
  document.getElementById("latest").value = item.latest;
});

bindRun(document.getElementById("runBtn"), async () => {
  const data = await runSystemOne({
    timeoutMs: 15000,
    state: {
      history: document.getElementById("history").value.trim(),
      latest: document.getElementById("latest").value.trim()
    },
    questions: {
      feel: {
        type: "choice",
        instructions: "Dominant feeling in the latest message, using the earlier thread only as context. Keys are emotion ids.",
        criteria: FEEL
      },
      shape: {
        type: "choice",
        instructions: "How is the feeling structured in this thread?",
        criteria: {
          single: "One clear feeling",
          blend: "Two feelings at once",
          shift: "Feeling changed across the thread",
          masked: "Surface tone hides a different feeling",
          performed: "Playing a feeling for the audience"
        }
      },
      intensity: {
        type: "score",
        instructions: "How strong is the dominant feeling?",
        criteria: ["Trace", "Mild", "Strong", "Flooding"]
      },
      hiding: {
        type: "noul",
        instructions: "The speaker is trying to hide, minimize, or perform the feeling rather than show it straight."
      }
    }
  });
  paintAnswers(document.getElementById("out"), data);
});
