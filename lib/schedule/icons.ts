// Per-item icon + color resolver for the Schedule timeline (and any other
// surface that renders a routine-item row — GoalWidget's linked-items list
// also uses it).
//
// Priority:
//   1. If the item has an explicit `icon` override (lucide name string),
//      use that. Set by the AI classifier on item creation, or manually.
//   2. Match the item's `name` against a keyword regex list. Picks a
//      semantically-appropriate icon for common routine items (yoga → bike
//      → meditation → sunscreen → etc.).
//   3. Fall back to the category default (Pill / Beaker / etc).
//
// Colors stay per-category — the visual grouping by hue is intentional. Only
// the icon SHAPE varies per item.

import {
  Pill, Beaker, Syringe, Sparkles, Sun, Moon, Sunrise, Sunset,
  Activity, Dumbbell, Bike, Footprints,
  Utensils, Coffee, Apple, Beef, Salad, Cookie, EggFried,
  Brain, BookOpen,
  Glasses, Eye,
  ShowerHead, Bath, Droplet,
  Cross, Heart, HeartPulse,
  Bed, Wind, Flower2, Mountain, TreePine, Leaf,
  Music, Smartphone, Camera,
  FlaskConical, TestTube,
  Clock,
  type LucideIcon,
} from "lucide-react";

// Curated Lucide subset the AI classifier is allowed to choose from. Keys
// match the kebab-case Lucide name so a server-side classifier can return
// a string and the client resolves it cleanly.
export const ICON_NAMES: Record<string, LucideIcon> = {
  // medical
  "pill":          Pill,
  "beaker":        Beaker,
  "syringe":       Syringe,
  "flask-conical": FlaskConical,
  "test-tube":     TestTube,
  // skincare / hygiene
  "sparkles":      Sparkles,
  "shower-head":   ShowerHead,
  "bath":          Bath,
  "droplet":       Droplet,
  // time-of-day / nature
  "sun":           Sun,
  "moon":          Moon,
  "sunrise":       Sunrise,
  "sunset":        Sunset,
  "mountain":      Mountain,
  "tree-pine":     TreePine,
  "leaf":          Leaf,
  // exercise / movement
  "activity":      Activity,
  "dumbbell":      Dumbbell,
  "bike":          Bike,
  "footprints":    Footprints,
  // food
  "utensils":      Utensils,
  "coffee":        Coffee,
  "apple":         Apple,
  "beef":          Beef,
  "salad":         Salad,
  "cookie":        Cookie,
  "egg-fried":     EggFried,
  // mind / focus
  "brain":         Brain,
  "book-open":     BookOpen,
  "flower2":       Flower2,
  "wind":          Wind,
  // accessories
  "glasses":       Glasses,
  "eye":           Eye,
  // faith
  "cross":         Cross,
  // body
  "heart":         Heart,
  "heart-pulse":   HeartPulse,
  "bed":           Bed,
  // misc
  "music":         Music,
  "smartphone":    Smartphone,
  "camera":        Camera,
  "clock":         Clock,
};

// Category defaults — used when keyword match fails.
const CATEGORY_ICON: Record<string, LucideIcon> = {
  supplement: Pill,
  medication: Beaker,
  injection:  Syringe,
  skincare:   Sparkles,
  habit:      Sun,
  exercise:   Activity,
  meal:       Utensils,
};

// Per-category color (visual grouping). Items can override via `item.color`.
const CATEGORY_COLOR: Record<string, string> = {
  supplement: "#fb923c",
  medication: "#60a5fa",
  injection:  "#a78bfa",
  skincare:   "#f472b6",
  habit:      "#818cf8",
  exercise:   "#f87171",
  meal:       "#4ade80",
};

// Keyword → Lucide-name. First match wins; ordered for specificity (more
// specific patterns above more general ones).
const KEYWORD_ICONS: Array<[RegExp, string]> = [
  // Exercise / movement
  [/\b(yoga|stretch|mobility|pilates|tai\s*chi)\b/i,             "activity"],
  [/\b(bike|cycl(?:e|ing)|spin)\b/i,                              "bike"],
  [/\b(run|jog|sprint|marathon)\b/i,                              "footprints"],
  [/\b(walk|stroll|hike|hiking)\b/i,                              "footprints"],
  [/\b(workout|gym|lift|squat|deadlift|bench|train|training)\b/i, "dumbbell"],

  // Food & drink
  [/\b(coffee|espresso|latte|cappuccino|americano)\b/i,           "coffee"],
  [/\b(breakfast|cereal|oatmeal|oats|eggs?|omelet)\b/i,            "egg-fried"],
  [/\b(protein|shake|whey|steak|chicken|beef|fish)\b/i,            "beef"],
  [/\b(salad|veggies|vegetables|greens|spinach|kale)\b/i,          "salad"],
  [/\b(snack|cookie|chocolate|candy|treat)\b/i,                    "cookie"],
  [/\b(apple|fruit|banana|berry|berries|orange|smoothie)\b/i,      "apple"],
  [/\b(lunch|dinner|meal|eat|food)\b/i,                            "utensils"],

  // Supplements & meds (catches a lot)
  [/\b(magnesium|zinc|creatine|vitamin|d3|d-?3|b12|b-?12|omega|fish\s*oil|nootropic|adaptogen|ashwagandha|rhodiola|theanine|caffeine\s*pill)\b/i, "pill"],
  [/\b(concerta|adderall|ritalin|methylphenidate|amphetamine|antibiotic|ibuprofen|tylenol|advil|aspirin|levothyroxine|metformin|antidepressant|ssri)\b/i, "beaker"],
  [/\b(inject(?:ion)?|peptide|trt|hcg|glp|semaglutide|tirzepatide|melanotan)\b/i, "syringe"],

  // Skincare
  [/\b(retinol|tretinoin|moistur|cleanser|cleans(?:e|ing)|serum|sunscreen|spf|skincare|face\s*wash|toner|exfoliat)\b/i, "sparkles"],

  // Hygiene
  [/\b(shower|wash\s*hair)\b/i,                                   "shower-head"],
  [/\b(bath|soak|epsom)\b/i,                                       "bath"],

  // Sleep / rest
  [/\b(sleep|bedtime|nap|wind\s*down)\b/i,                         "bed"],

  // Sun / outdoors
  [/\b(sun(?:light)?|sun\s*expos|sunbath|tan|uv)\b/i,              "sun"],
  [/\b(outdoors?|nature|forest|park|hike)\b/i,                      "tree-pine"],

  // Meditation / breathwork / mental
  [/\b(meditat|breathwork|breath\s*work|mindful(?:ness)?|zen|cold\s*plunge|wim\s*hof)\b/i, "flower2"],
  [/\b(breath(?:ing)?\s*exercise|box\s*breath)\b/i,                 "wind"],
  [/\b(brain|focus|cognitive|memory|learning)\b/i,                 "brain"],
  [/\b(read|book|journal|writ(?:e|ing))\b/i,                       "book-open"],

  // Faith
  [/\b(pray(?:er)?|bible|scripture|church|faith|worship|gospel)\b/i, "cross"],

  // Accessories / devices
  [/\b(blue\s*light|glasses|sunglasses)\b/i,                       "glasses"],
  [/\b(music|playlist|spotify|song)\b/i,                            "music"],
  [/\b(phone|smartphone|call|text\s*reply)\b/i,                     "smartphone"],
  [/\b(photo|picture|selfie|progress\s*pic)\b/i,                    "camera"],

  // Hydration
  [/\b(water|hydrat|glass(?:es)?\s*of\s*water|drink\s*water)\b/i,  "droplet"],
];

// Resolve a Lucide component for an item. Order: explicit override → keyword
// match → category default → Clock.
export function resolveIcon(item: { name: string; icon?: string | null; category?: string | null }): LucideIcon {
  if (item.icon && ICON_NAMES[item.icon]) return ICON_NAMES[item.icon];
  const name = item.name.toLowerCase();
  for (const [pattern, iconKey] of KEYWORD_ICONS) {
    if (pattern.test(name)) return ICON_NAMES[iconKey] ?? Clock;
  }
  if (item.category && CATEGORY_ICON[item.category]) return CATEGORY_ICON[item.category];
  return Clock;
}

// Color stays per-category. Items override via `item.color`.
export function resolveColor(item: { color?: string | null; category?: string | null }): string {
  if (item.color) return item.color;
  if (item.category && CATEGORY_COLOR[item.category]) return CATEGORY_COLOR[item.category];
  return "#a1a1aa";
}

// Convenience for components that want both at once.
export function resolveItemStyle(item: { name: string; icon?: string | null; color?: string | null; category?: string | null }) {
  return { Icon: resolveIcon(item), color: resolveColor(item) };
}
