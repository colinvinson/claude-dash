import type { SVGProps } from "react";

// Custom rounded-house icon matching the launcher-reference Sir provided.
// Geometry tuned so the bottom corners of the house roll smoothly into
// the base + the roof apex has the softness of round line joins. Phosphor's
// HouseSimple / HouseLine were too angular at the corners.
//
// Phosphor-compatible API (`size` + `weight`) so it drops into NAV_TABS
// where the rest of the nav icons come from Phosphor. weight="fill"
// renders the solid-filled variant for the active state; everything
// else renders the outline.

type Props = {
  size?:   number | string;
  weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone";
  color?:  string;
} & Omit<SVGProps<SVGSVGElement>, "ref">;

export default function HouseRounded({
  size  = 24,
  weight = "regular",
  color  = "currentColor",
  ...rest
}: Props) {
  const filled = weight === "fill";
  // Path with explicit quadratic-Bezier rounding at EVERY corner:
  //   • apex (top peak)
  //   • top-left + top-right (where roof slopes meet walls)
  //   • bottom-left + bottom-right (where walls meet base)
  // The Z closes from (11, 5) back to (5, 11) — that straight segment
  // is the left roof slope.
  const d =
    "M5 11 Q4 11 4 12 V19 Q4 21 6 21 H18 Q20 21 20 19 V12 Q20 11 19 11 L13 5 Q12 4 11 5 Z";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? color : "none"}
      stroke={filled ? "none" : color}
      strokeWidth={1.6}
      strokeLinejoin="round"
      strokeLinecap="round"
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      <path d={d} />
    </svg>
  );
}
