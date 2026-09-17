import { paintAnswers, bindRun, bindExamples, bootBooth, runSystemOne } from "../../shared/booth.js";

await bootBooth("cheat");

const SETUP_DEFAULT = "Two adults, dating 3 years, verbally exclusive, no written rules. They have never listed what counts as cheating.";

const MICRO = [
  {
    label: "Heart DMs",
    setup: SETUP_DEFAULT,
    act: "Alex keeps a private Instagram thread with a coworker. Messages are mostly work, then a streak of heart emojis and 'you looked good today' after a photo. Alex mutes notifications when the partner is in the room. No meetup, no nudes. Schilling's micro-cheating examples were largely this: small digital signals of availability that you would not narrate at dinner."
  },
  {
    label: "Delete after read",
    setup: SETUP_DEFAULT,
    act: "Sam texts an old fling 'this stay is killing me' after a fight, then deletes the thread and the contact name, keeping the number. Partner later sees the empty hole in the log. Glamour's writeup flagged secretive texting plus immediate deletion as the tell, not the emoji by itself."
  },
  {
    label: "Hidden app",
    setup: SETUP_DEFAULT,
    act: "Jordan's Hinge profile is still live. Photos are current. Bio says 'new in town.' They say they forgot to delete it after becoming exclusive six months ago. They open it 'to see who likes me' and never message first. Partner does not have the password."
  },
  {
    label: "Thirst likes",
    setup: SETUP_DEFAULT,
    act: "Riley likes and comments fire emojis on a stranger's gym photos several times a week, including a crotch-level mirror shot. They do not follow anyone their partner would recognize. CBS quoted clinicians calling follow/like patterns micro-cheating when they are a pattern of extra-pair attention."
  },
  {
    label: "Work crush lunch",
    setup: SETUP_DEFAULT,
    act: "Taylor takes a one-on-one lunch with a coworker they find attractive, pays, lingers, and describes the partner as 'complicated' when asked how home is. They tell the partner it was 'a team lunch.' AP listed lingering conversations and sharing relationship details as common micro-cheating complaints."
  },
  {
    label: "Dress for them",
    setup: SETUP_DEFAULT,
    act: "Casey changes after work, extra cologne, fitted shirt, only on days the attractive client is in the office. They tell the partner they had 'a late standup.' AP cited dressing up because you know you will see someone as a micro-cheating example some couples fight about."
  },
  {
    label: "Ex follow, hidden",
    setup: SETUP_DEFAULT,
    act: "Morgan follows an ex, watches stories daily, and uses a finsta the partner does not know. No DMs. Institute for Family Studies noted that in a US sample, only about a third called 'following an old flame' infidelity, while secret emotional relationships scored much higher. The hide is the fight."
  },
  {
    label: "Vent to the crush",
    setup: SETUP_DEFAULT,
    act: "Avery dumps the whole fight ('they never listen, I feel trapped') on a coworker they are attracted to, late at night, then feels lighter and less interested in repairing at home. Psychology Today flagged seeking support from someone you are attracted to, plus comparing the partner, as a gray-zone slide toward an emotional affair."
  },
  {
    label: "Number in secret",
    setup: SETUP_DEFAULT,
    act: "At a wedding, Quinn asks a bridesmaid for her number 'in case the group chat dies,' does not mention the partner, and saves her as a coworker name. They have not texted yet. Matchmakers quoted in Glamour treated asking without telling as micro-cheating because of the concealment, not the digits."
  },
  {
    label: "Compare and fantasize",
    setup: SETUP_DEFAULT,
    act: "Reese has a running private daydream about a barista, including sexual scenarios, and tells a friend 'if I were single...' They are polite in person and have never asked the barista out. Fantasy alone is not a universal red line. Some couples treat the secrecy plus comparison as the injury."
  }
];

const FULL = [
  {
    label: "Secret emotional pair",
    setup: SETUP_DEFAULT,
    act: "Two people text every night after the partner is asleep, say 'you get me,' plan future trips, and agree not to mention it at home. No sex, no kissing. IFS: 76% of a US adult sample called a secret in-person emotional relationship infidelity, 72% for the online version. Sex is not required on that definition."
  },
  {
    label: "Kiss at the party",
    setup: SETUP_DEFAULT,
    act: "A slow song, a kiss on the mouth with someone who is not the partner, then 'it was nothing, alcohol.' They tell the partner two days later only because a photo exists. Many couples call this cheating. Some call it a one-time physical breach without an affair."
  },
  {
    label: "Hotel night",
    setup: SETUP_DEFAULT,
    act: "A conference, a shared hotel room, sex, a story about missing the shuttle. This is the ordinary sexual-affair case most exclusive couples already named as cheating without a glossary."
  },
  {
    label: "Cybersex, no meet",
    setup: SETUP_DEFAULT,
    act: "Video sex with a stranger on an app, paid once, camera on, then deleted. Never in the same city. Cross-cultural infidelity reviews treat cybersex as a recognized infidelity subtype even when bodies never meet. Some partners care more about the camera than about porn."
  },
  {
    label: "Hidden porn habit",
    setup: SETUP_DEFAULT,
    act: "Nightly porn, incognito, partner asked last year to keep it out of the shared bed. They agreed, then kept going on a second phone. IFS: only about 30% of that US sample called pornography infidelity. Many conservative Christian teachings still treat lust-as-adultery of the heart. Jev has to pick a bucket, not a church."
  },
  {
    label: "Bar flirting",
    setup: SETUP_DEFAULT,
    act: "A work mixer. They lean in, touch an arm, laugh loud, exchange Instagram, and tell the partner 'networking.' IFS: about 42% of that US sample called flirting infidelity. The rest called it rude or nothing."
  },
  {
    label: "OnlyFans, hidden card",
    setup: SETUP_DEFAULT,
    act: "A monthly subscription to a specific creator they DM, using a card the partner does not see. No in-person meet. Closer to porn-plus-parasocial than to an affair for some couples. A betrayal of a money-and-secrecy rule for others."
  },
  {
    label: "AI companion",
    setup: SETUP_DEFAULT,
    act: "They spend two hours a night on a companion chatbot with a sexual persona named after an old crush, tell it 'you understand me,' and snap when the partner interrupts. Research reviews now list internet infidelity and even sex-tech as contested categories. No human third party exists."
  }
];

const CULTURE = [
  {
    label: "Open, on the rules",
    setup: "A nested couple with a written agreement: other partners allowed if they are named in advance, condoms, no overnights in the shared bed, weekly check-in.",
    act: "They sleep with a named third who was discussed on Sunday, follow the condom rule, and debrief Monday. Under this contract the sex is not a breach. Hiding a fourth person would be."
  },
  {
    label: "Open, broke the rule",
    setup: "Same written open agreement: named in advance, no overnights in the shared bed.",
    act: "They bring someone new home at 2am, no prior name, and ask the partner to sleep on the couch. The sex was 'allowed' in the abstract. The process rule was not."
  },
  {
    label: "Don't ask, don't tell",
    setup: "A couple that said 'what happens on tour stays on tour' and has kept that for years. Both have used it.",
    act: "A tour kiss, then they come home and do not mention it, per the deal. If the deal is real, this is compliance. If one person never meant it, it is a mismatch, not a secret third definition of cheating."
  },
  {
    label: "Private chat, non-mahram",
    setup: "A married couple in a conservative Sunni household. They treat unsupervised private chat with a non-mahram (someone marriageable, not a close blood relative) as off-limits, even with no sexual talk. That is their stated rule, not a claim about all Muslims.",
    act: "The husband has a long, warm, late-night voice-note thread with a female coworker about kids and stress. No photos, no meet. In this house the rule was already named. In a secular exclusive couple the same thread might be 'micro' or 'nothing.'"
  },
  {
    label: "Halal app, family in",
    setup: "An unmarried couple using a Muslim marriage app with family aware, intending nikah. Their communities treat secret Western-style dating as the problem, not chaperoned getting-to-know-you.",
    act: "They switch to a hidden WhatsApp and start meeting in cars. No sex. Relative to their own prior rule, this is a breach of process. Relative to a US dating couple, it is ordinary."
  },
  {
    label: "Yichud-adjacent",
    setup: "An Orthodox Jewish married couple. Their community treats seclusion (yichud) with someone of the opposite sex behind a closed door as a halakhic boundary, separate from adultery.",
    act: "A closed-door office meeting with a colleague, no touch, 40 minutes, door unvisioned. Some poskim would call the setting forbidden. A secular HR policy might call it a meeting. The couple asked for the religious frame."
  },
  {
    label: "Porn as lust",
    setup: "An evangelical couple that cited Matthew 5:28 in premarital counseling and agreed porn is adultery of the heart. They are not asking a national poll.",
    act: "One spouse returns to porn after promising to stop, then lies in accountability software. On their contract this is a named sexual-moral breach. On the IFS US poll it often would not be 'cheating.'"
  },
  {
    label: "Family honor hangout",
    setup: "A Hindu family in a city where the parents still treat an unmarried woman's private cafe time with an unrelated man as a reputation hit, even when she has a boyfriend they have not been told about.",
    act: "She studies with a male classmate in public, tells her boyfriend, hides it from parents. The boyfriend does not call it cheating. The parents would call the secrecy toward them a different sin (disobedience, not infidelity). Two rulebooks, one cafe."
  },
  {
    label: "Arranged vs secret dating",
    setup: "A family-introduced match is in progress. Both families think the pair is 'talking' only through relatives. One person is also seeing someone else from university.",
    act: "University dating includes kissing. The family match has had only three chaperoned teas. In the family's frame, the university relationship is a betrayal of the process. In the university partner's frame, the family match is the other woman."
  },
  {
    label: "Closeted hookup",
    setup: "A same-sex couple, one partner not out at work. They agreed hookups are forbidden, discretion about the closet is required.",
    act: "A Grindr meetup on a work trip, then a story about a late client. Sexual breach plus a closet risk dumped on the partner. The closet does not make the hookup allowed."
  },
  {
    label: "Wedding dance",
    setup: SETUP_DEFAULT,
    act: "A family wedding. They slow-dance with an ex for one song, both smiling, partner watching, no hide. In some families this is rude. In others it is the point of a wedding. Secrecy is absent."
  },
  {
    label: "Work trip hotel split",
    setup: SETUP_DEFAULT,
    act: "Two coworkers, storm, one room left, they tell the partner in real time on video, sleep in separate beds, door photos. No touch. This is logistics with sunlight. Compare to the hidden hotel night in the other pile."
  }
];

function paintScene(item) {
  document.getElementById("setup").value = item.setup;
  document.getElementById("act").value = item.act;
  document.getElementById("scene").textContent = item.act;
}

function bindGroup(id, items) {
  bindExamples(document.getElementById(id), items, paintScene);
}

bindGroup("exMicro", MICRO);
bindGroup("exFull", FULL);
bindGroup("exCulture", CULTURE);
paintScene(MICRO[0]);

bindRun(document.getElementById("runBtn"), async () => {
  const data = await runSystemOne({
    timeoutMs: 15000,
    state: {
      setup: document.getElementById("setup").value.trim(),
      act: document.getElementById("act").value.trim()
    },
    questions: {
      verdict: {
        type: "choice",
        instructions: "Classify the act relative to this couple's setup. Use community_rule only if the setup named a religious or family boundary. Use depends_on_couple if exclusive people would split and no rule was named. Do not moralize past the labels.",
        criteria: {
          not_cheating: "No extra-pair betrayal relative to this setup",
          micro: "Small extra-pair attention or concealment, short of an affair",
          emotional_affair: "Secret emotional primary bond with someone else",
          sexual_affair: "Sexual or clearly sexual-digital contact that breaks exclusivity",
          depends_on_couple: "Reasonable exclusive couples would split on this",
          community_rule: "A breach of a named religious, family, or subculture rule more than of sex-as-such"
        }
      },
      secrecy: {
        type: "noul",
        instructions: "Concealment from the partner (or from the named family rule-holders) is doing real work in this case."
      },
      harm: {
        type: "score",
        instructions: "Typical trust harm if this stays hidden, for this setup. Not a legal finding.",
        criteria: ["None", "Sting", "Break", "Blow-up"]
      }
    }
  });
  paintAnswers(document.getElementById("out"), data);
});
