import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#181816",
          color: "#f7f6f0",
          display: "flex",
          fontFamily: "sans-serif",
          fontSize: 154,
          fontWeight: 700,
          height: "100%",
          justifyContent: "center",
          width: "100%",
        }}
      >
        DMH
      </div>
    ),
    size
  );
}
