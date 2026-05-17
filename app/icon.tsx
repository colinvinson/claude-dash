import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0b0716",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fafafa",
          fontSize: 22,
          fontWeight: 700,
        }}
      >
        ✦
      </div>
    ),
    { ...size }
  );
}
