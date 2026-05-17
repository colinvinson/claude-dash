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
  // Path: peak at top-center, sides curve smoothly into rounded bottom
  // corners. Stroke-linejoin="round" softens the apex.
  const d =
    "M12 3.5 L4.5 10 a2 2 0 0 0 -0.7 1.5 V19 a3 3 0 0 0 3 3 h10.4 a3 3 0 0 0 3 -3 V11.5 a2 2 0 0 0 -0.7 -1.5 Z";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? color : "none"}
      stroke={filled ? "none" : color}
      strokeWidth={2}
      strokeLinejoin="round"
      strokeLinecap="round"
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      <path d={d} />
    </svg>
  );
}
