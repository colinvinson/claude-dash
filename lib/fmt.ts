export function val(n: number | null | undefined, suffix = ""): string {
  if (n == null) return "—";
  return `${n}${suffix}`;
}
