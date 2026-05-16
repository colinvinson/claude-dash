// Variable reward copy.
//
// ADHD brain habituates to fixed feedback fast — "Logged" said the same way
// 50 times a day becomes invisible. Rotating through a phrase bank gives a
// slot-machine "what's it going to say this time" hit instead.
//
// %TOKENS in the template get replaced from the vars dict, e.g.
//   pick("setLogged", { n: 3 })  // "Set 3 — in the book."

const BANK: Record<string, string[]> = {
  setLogged: [
    "Set %n — in the book.",
    "Set %n. Banked.",
    "%n logged.",
    "Set %n. Down.",
    "%n in the bag.",
    "Locked in. Set %n.",
    "Set %n. Noted.",
    "%n — recorded.",
    "Set %n nailed.",
    "Filed under done.",
  ],
  itemTaken: [
    "Done.",
    "✓ Logged.",
    "Banked.",
    "In.",
    "Marked.",
    "Sorted.",
    "✓ Noted.",
    "Locked.",
    "Off the list.",
    "Indeed.",
  ],
  proteinLogged: [
    "+%gg.",
    "%gg added.",
    "+%gg banked.",
    "%gg in.",
    "%gg locked.",
    "Logged %gg.",
    "+%gg noted.",
    "%gg — counted.",
  ],
  waterLogged: [
    "+1.",
    "Glass logged.",
    "Banked.",
    "In.",
    "Glass down.",
    "Hydration noted.",
  ],
  goalDone: [
    "Goal cleared.",
    "Done. Off the list.",
    "Locked.",
    "Banked.",
    "Cleared.",
    "Filed.",
    "✓ Goal done.",
    "Noted, sir.",
  ],
  weightLogged: [
    "Weigh-in logged.",
    "%lblb noted.",
    "Banked.",
    "Logged.",
    "%lblb — recorded.",
  ],
};

export function pick(category: keyof typeof BANK | string, vars: Record<string, string | number> = {}): string {
  const bank = BANK[category] ?? ["Done."];
  const phrase = bank[Math.floor(Math.random() * bank.length)];
  return phrase.replace(/%(\w+)/g, (_match, key: string) => {
    const v = vars[key.toLowerCase()];
    return v == null ? "" : String(v);
  });
}
