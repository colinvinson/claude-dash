// Curated equipment taxonomy. ~30 common categories grouped by muscle
// region so the selector UI doesn't feel overwhelming. IDs are stable and
// referenced by optimization rules to gate exercise alternatives.

export type EquipmentCategory =
  | "barbell" | "lower-body" | "upper-body-pull" | "upper-body-push"
  | "isolation" | "cardio";

export type Equipment = {
  id: string;
  name: string;
  category: EquipmentCategory;
};

// Anything Sir is reasonably likely to find at a commercial gym. The list
// stays opinionated and short — every entry should be one a real
// optimization rule can use.
export const EQUIPMENT: Equipment[] = [
  // Free weights / barbell
  { id: "barbell",              name: "Barbell + rack",          category: "barbell" },
  { id: "dumbbells-heavy",      name: "Dumbbells (≥80lb)",      category: "barbell" },
  { id: "smith-machine",        name: "Smith machine",            category: "barbell" },
  { id: "trap-bar",             name: "Trap bar",                 category: "barbell" },
  { id: "ez-bar",               name: "EZ-curl bar",              category: "barbell" },

  // Lower body machines
  { id: "leg-press",            name: "Leg press",                category: "lower-body" },
  { id: "hack-squat",           name: "Hack squat",               category: "lower-body" },
  { id: "pendulum-squat",       name: "Pendulum / belt squat",    category: "lower-body" },
  { id: "leg-extension",        name: "Leg extension",            category: "lower-body" },
  { id: "leg-curl-lying",       name: "Lying leg curl",           category: "lower-body" },
  { id: "leg-curl-seated",      name: "Seated leg curl",          category: "lower-body" },
  { id: "leg-curl-standing",    name: "Standing leg curl",        category: "lower-body" },
  { id: "hip-thrust-machine",   name: "Hip thrust machine",       category: "lower-body" },
  { id: "calf-raise-standing",  name: "Standing calf raise",      category: "lower-body" },
  { id: "calf-raise-seated",    name: "Seated calf raise",        category: "lower-body" },
  { id: "adductor-machine",     name: "Adductor / abductor",      category: "lower-body" },

  // Upper body pull
  { id: "lat-pulldown",         name: "Lat pulldown",             category: "upper-body-pull" },
  { id: "pullup-bar",           name: "Pull-up bar",              category: "upper-body-pull" },
  { id: "chest-supported-row",  name: "Chest-supported row",      category: "upper-body-pull" },
  { id: "cable-row-seated",     name: "Seated cable row",         category: "upper-body-pull" },
  { id: "t-bar-row",            name: "T-bar row",                category: "upper-body-pull" },

  // Upper body push
  { id: "chest-press-machine",  name: "Chest press machine",      category: "upper-body-push" },
  { id: "incline-press-machine",name: "Incline press machine",    category: "upper-body-push" },
  { id: "pec-deck",             name: "Pec deck",                 category: "upper-body-push" },
  { id: "shoulder-press-machine", name: "Shoulder press machine", category: "upper-body-push" },
  { id: "dip-station",          name: "Dip station / assist",     category: "upper-body-push" },

  // Cables + isolation
  { id: "cable-stack-dual",     name: "Dual cable column",        category: "isolation" },
  { id: "cable-stack-single",   name: "Single cable column",      category: "isolation" },
  { id: "lateral-raise-machine",name: "Lateral raise machine",    category: "isolation" },
  { id: "rear-delt-machine",    name: "Rear-delt machine",        category: "isolation" },
  { id: "preacher-bench",       name: "Preacher / spider bench",  category: "isolation" },
  { id: "tricep-pushdown-rope", name: "Rope for pushdowns",       category: "isolation" },
];

export const EQUIPMENT_BY_ID: Record<string, Equipment> = Object.fromEntries(
  EQUIPMENT.map((e) => [e.id, e]),
);

export const EQUIPMENT_GROUPS: Array<{ category: EquipmentCategory; label: string; items: Equipment[] }> = [
  { category: "barbell",         label: "Free weights",     items: EQUIPMENT.filter((e) => e.category === "barbell") },
  { category: "lower-body",      label: "Lower body",       items: EQUIPMENT.filter((e) => e.category === "lower-body") },
  { category: "upper-body-pull", label: "Pull",             items: EQUIPMENT.filter((e) => e.category === "upper-body-pull") },
  { category: "upper-body-push", label: "Push",             items: EQUIPMENT.filter((e) => e.category === "upper-body-push") },
  { category: "isolation",       label: "Cables / isolation", items: EQUIPMENT.filter((e) => e.category === "isolation") },
];

// A "baseline" set we assume even when Sir hasn't marked his gym yet — every
// commercial gym has these. Rules requiring ONLY baseline equipment fire
// unconditionally.
export const BASELINE_EQUIPMENT = new Set<string>([
  "barbell", "dumbbells-heavy",
]);

export function hasEquipment(available: string[], required: string[]): boolean {
  if (required.length === 0) return true;
  const set = new Set([...available, ...BASELINE_EQUIPMENT]);
  return required.every((r) => set.has(r));
}
