export const mockHealth = {
  readinessScore: 76,
  readinessLabel: "Go hard today",
  sleepScore: 72,
  sleepHours: 5.9,
  sleepEfficiency: 72,
  activityScore: 42,
  hrv: 126,
  rhr: 45,
  spo2: 96.3,
  respRate: 15.4,
  skinTempDelta: +0.1,
  sleepStages: {
    rem: 225,   // minutes
    deep: 125,
    light: 178,
    awake: 62,
  },
  todaysCall: {
    severity: "green" as const,
    headline: "Push hard today. Body's primed — go for the PR, do the harder workout, take on the heavy task.",
    bullets: [
      "Sleep 72% — decent, not great.",
      "Only 5.9 hrs in bed — short sleep is the #1 thing wrecking recovery.",
      "Low strain 6.4 yesterday — room to push today if recovery allows.",
      "HRV 126ms — strong autonomic state.",
      "RHR 45bpm — well-conditioned.",
    ],
  },
};

export const mockTime = {
  wakeTime: "8:00 AM",
  sleepTarget: "12:00 AM",
  totalAwakeMinutes: 960,
  currentLabel: "Afternoon — push it",
  awakeTimeLeftMinutes: 479,
};

export const mockEnergyWindows = [
  { label: "Peak",   start: 8,  end: 12, color: "#f97316" },
  { label: "Steady", start: 12, end: 17, color: "#eab308" },
  { label: "Foggy",  start: 17, end: 24, color: "#6366f1" },
];

export const mockStack = {
  morning: [
    { id: "1", name: "Caffeine",       dose: "coffee or monster",     note: "Cutoff 12 PM",  taken: false },
    { id: "2", name: "L-theanine",     dose: "100–200mg",             note: "Take WITH the caffeine — same drink, same minute", taken: false, isStack: true },
    { id: "3", name: "Concerta 18mg",  dose: "1 capsule",             note: "After breakfast / with food", taken: false },
    { id: "4", name: "Vitamin C",      dose: "500mg–1g",              note: "With breakfast", taken: false },
  ],
  lunch: [
    { id: "5", name: "Omega-3",        dose: "2–3g EPA+DHA",          note: "Needs fat to absorb — biggest meal of the day", taken: false },
    { id: "6", name: "Creatine",       dose: "5g Monohydrate",        note: "Timing doesn't matter, just be consistent", taken: false },
  ],
  evening: [
    { id: "7", name: "Zinc",           dose: "15–30mg",               note: "With small snack — keep +2hrs from magnesium", taken: false },
    { id: "8", name: "Ashwagandha",    dose: "300–600mg",             note: "At night — calms cortisol before bed", taken: false, notOrdered: true },
    { id: "9", name: "Magnesium glycinate", dose: "300–400mg",        note: "30–60 min before bed — sleep helper", taken: false },
  ],
};

export const mockMedication = {
  name: "Concerta 18mg",
  takenToday: false,
  minutesAgo: null as number | null,
  pharmacokinetics: [
    { label: "Onset",     minutesFromNow: 30  },
    { label: "Peak",      minutesFromNow: 180 },
    { label: "Half-life", minutesFromNow: 480 },
  ],
};

export const mockVelo = { takenToday: 0, dailyLimit: 5 };

export const mockGoals = {
  date: "FRI, MAY 9",
  streak: 0,
  items: [
    { id: "1", title: "You must make 2 reels",                        complete: false, priority: true },
    { id: "2", title: "Figure out how to extract exact code from dashboard", complete: false, priority: true },
    { id: "3", title: "Risk assess discord",                          complete: false, priority: true },
    { id: "4", title: "Make episode one of the start of the dashboard on YouTube", complete: false, priority: true },
    { id: "5", title: "Hang out with Ines if possible",               complete: false, priority: false },
  ],
};

export const mockWorkout = {
  split: "LEGS DAY",
  gyms: ["Les Roches", "Clever Fit"],
  activeGym: "Les Roches",
  days: ["Push", "Pull", "Legs"],
  activeDay: "Legs",
  exercise: "Hammer Curls",
  lastSet: { weight: 20, reps: 5, daysAgo: 2 },
  nextTarget: { weight: 20, reps: 6, note: "5 reps short of 6–8. Repeat 20kg until you hit 6+ clean.", type: "REPEAT" as const },
  stats: { est1rm: 95, bestSet: "75×8", sessions: 4 },
  history: [
    { date: "May 5", weight: 20, reps: 5 },
    { date: "May 1", weight: 75, reps: 5 },
    { date: "May 1", weight: 75, reps: 6 },
    { date: "May 1", weight: 75, reps: 8 },
  ],
  trend: [62, 65, 70, 68, 72, 75, 74, 78, 80, 83],
};

export const mockFinances = {
  monthlyBurn: 168.43,
  subscriptions: [
    { id: "1", name: "Netlify",     amount: 11.55,  cycle: "Monthly", renewal: "Tue, May 26" },
    { id: "2", name: "Whoop PEAK",  amount: 23.42,  cycle: "Yearly",  renewal: "Mon, May 25", billed: "USD 281.04 / yearly" },
    { id: "3", name: "Claude Max",  amount: 107.80, cycle: "Monthly", renewal: "Tue, May 26" },
    { id: "4", name: "CapCut",      amount: 25.67,  cycle: "Monthly", renewal: "Tue, May 26" },
  ],
  incomingOrders: ["Hair blow dryer", "Height increasing shoes (CN)", "Height increasing dress shoes (CN)"],
  budget: [
    { label: "Budget yogurt ×14 (1.25 CHF)", amount: 17.50 },
    { label: "White Monster ×7",             amount: 12.00 },
    { label: "Organic bananas",              amount: 4.00  },
    { label: "Velo",                         amount: 10.00 },
    { label: "Greek yogurt",                 amount: 7.00  },
  ],
  budgetTotal: 80.50,
  blacklisted: "ABSOLUTE — 29 CHF",
};
