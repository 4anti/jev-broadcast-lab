import { paintAnswers, bindRun, bindExamples, bootBooth, runSystemOne } from "../../shared/booth.js";

await bootBooth("debate");

const MOVES = {
  ad_hominem_abusive: "Attack the speaker's character instead of the claim",
  ad_hominem_circumstantial: "Dismiss the claim because of the speaker's job, party, or incentive",
  tu_quoque: "You also do it, so the claim is false",
  guilt_by_association: "Reject the claim because of who else holds it",
  genetic: "Reject the claim because of where it came from",
  straw_man: "Refute a weaker or distorted version of the claim",
  motte_bailey: "Defend a modest claim, then go back to a stronger one",
  false_dichotomy: "Force two options when more exist",
  slippery_slope: "Treat a first step as if a disaster must follow",
  hasty_generalization: "Jump from a thin sample to a rule",
  post_hoc: "After this, therefore because of this",
  false_cause: "Treat correlation or coincidence as the mechanism",
  red_herring: "Change the subject",
  whataboutism: "Deflect to a different wrong instead of this one",
  appeal_emotion: "Swap heat for reasons",
  appeal_popularity: "Many people believe it, so it is true",
  appeal_authority: "A status person said it, so the claim is settled",
  appeal_tradition: "We have always done it this way",
  appeal_ignorance: "Not disproven, therefore true, or the reverse",
  circular: "The conclusion is smuggled into the premise",
  equivocation: "A key word silently changes meaning",
  no_true_scotsman: "Move the definition to eject counterexamples",
  special_pleading: "Ask for an exemption without a rule for it",
  moving_goalposts: "Change what would count as a successful answer",
  gish_gallop: "Flood with too many points to answer in time",
  false_equivalence: "Treat two unlike cases as the same",
  loaded_question: "A question that already assumes the conclusion",
  anecdotal: "One story does the work of a pattern",
  sunk_cost: "Keep going because of what was already spent",
  middle_ground: "Split the difference as if that makes it true",
  personal_incredulity: "I cannot imagine it, so it is false",
  two_wrongs: "Their wrong licenses ours",
  steelman: "Restate the strongest fair version, then answer that",
  reductio: "Show the claim implies something they also reject",
  analogy: "Map the structure onto a clearer case",
  distinguish: "Same word, different case, here is the cut",
  burden: "Show who actually has to prove what",
  evidence: "Bring a specific fact, number, or source that bears on the claim",
  definition: "Fix the term before arguing the substance",
  concession: "Grant part of the claim, then limit the rest",
  turn: "Accept a premise and show it supports the other side",
  clarify: "Ask a real clarifying question before attacking",
  on_point_rebuttal: "Directly deny a premise or the inference with reasons"
};

bindExamples(document.getElementById("examples"), [
  {
    label: "Ad hominem",
    claim: "We should raise the city bus subsidy. Ridership is down because fares went up last year.",
    reply: "You only say that because you don't own a car. People with real jobs don't take the bus."
  },
  {
    label: "Straw man",
    claim: "We should require permits for short-term rentals in this neighborhood so long-term housing supply is not gutted.",
    reply: "So you want to ban tourists and turn the city into a gated village. Got it."
  },
  {
    label: "Tu quoque",
    claim: "Campaign staff should not use personal phones for official negotiating texts. It wrecks the record.",
    reply: "You used WhatsApp for the last hire. Sit down."
  },
  {
    label: "Whataboutism",
    claim: "This factory's river dump exceeded the permit this quarter and should be fined.",
    reply: "What about the plant in the next county? They have been worse for years and you never mention them."
  },
  {
    label: "False dichotomy",
    claim: "The library should stay open Sundays. It is the only quiet public desk some students have.",
    reply: "Either we fund Sunday hours or we fund firefighters. Pick one."
  },
  {
    label: "Slippery slope",
    claim: "Let 16-year-olds work closing shifts at the grocery if they want the hours.",
    reply: "Next it will be 12-year-olds in the warehouse and then we have abolished childhood."
  },
  {
    label: "Appeal to authority",
    claim: "This diet study is underpowered and the confidence interval crosses zero. Do not sell it as a breakthrough.",
    reply: "A celebrity doctor with a podcast already endorsed it. That settles the science."
  },
  {
    label: "Gish gallop",
    claim: "The new campus building went 18% over budget. We should publish the change orders.",
    reply: "Also the architect is from out of state, the paint is ugly, the bike racks are wrong, the old building had ghosts, the dean's cousin got a job, and anyway concrete is expensive worldwide so this is fine, plus students today are soft, and have you seen parking?"
  },
  {
    label: "Steelman",
    claim: "Ban phones in exam halls even for calculator apps. Too easy to hide a second device.",
    reply: "The strongest version is: any phone in the room raises cheating cost for proctors more than it helps honest students who already have approved calculators. If that is the claim, the answer is loaner calculators at the door, not a vibe about kids and TikTok."
  },
  {
    label: "Reductio",
    claim: "If a policy has any risk of misuse, we should not ship it.",
    reply: "Then we cannot ship email, locks, or kitchens. Your rule bans more than the thing you are scared of. Narrow it to this misuse path."
  },
  {
    label: "No true Scotsman",
    claim: "Our volunteer group never harasses speakers. That is not who we are.",
    reply: "Those people who heckled last night were not real members. Real members would never. So the record stays clean."
  },
  {
    label: "On-point",
    claim: "Raising the fare cut ridership. Look at the monthly counts before and after July.",
    reply: "The drop started in May, two months before the fare change, and tracks the campus summer break. The July step is small once you seasonally adjust. Fare is not the main lever."
  }
], (item) => {
  document.getElementById("claim").value = item.claim;
  document.getElementById("reply").value = item.reply;
});

bindRun(document.getElementById("runBtn"), async () => {
  const data = await runSystemOne({
    timeoutMs: 15000,
    state: {
      claim: document.getElementById("claim").value.trim(),
      reply: document.getElementById("reply").value.trim()
    },
    questions: {
      move: {
        type: "choice",
        instructions: "What is the main move in the counter? Prefer a specific fallacy id if it fits. Use a valid-counter id if the reply actually answers the claim.",
        criteria: MOVES
      },
      target: {
        type: "choice",
        instructions: "What did the counter aim at?",
        criteria: {
          claim: "The stated claim",
          premise: "A supporting reason",
          person: "The speaker",
          motive: "Why they might say it",
          definition: "The meaning of a word",
          side_issue: "A different topic",
          evidence: "The data or source"
        }
      },
      quality: {
        type: "score",
        instructions: "How well does the counter actually answer the original claim?",
        criteria: ["Miss", "Glance", "Partial", "Meets it"]
      },
      on_point: {
        type: "noul",
        instructions: "The counter addresses the original claim rather than the speaker or a side issue."
      }
    }
  });
  paintAnswers(document.getElementById("out"), data);
});
