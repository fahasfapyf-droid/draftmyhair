import { ImageResponse } from "next/og";

export const alt = "Draft My Hair - See Your Next Hairstyle Before You Cut It.";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#181816",
          color: "#f7f6f0",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "space-between",
          padding: "72px",
          width: "100%",
        }}
      >
        <div style={{ display: "flex", fontFamily: "sans-serif", fontSize: 42, fontWeight: 700 }}>
          Draft My Hair
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontFamily: "sans-serif", fontSize: 76, fontWeight: 700 }}>
            See Your Next Hairstyle
          </div>
          <div style={{ display: "flex", fontFamily: "sans-serif", fontSize: 76, fontWeight: 700 }}>
            Before You Cut It.
          </div>
          <div style={{ color: "#b9b7ad", display: "flex", fontFamily: "sans-serif", fontSize: 32, marginTop: 30 }}>
            Same Face. New Hair.
          </div>
        </div>
      </div>
    ),
    size
  );
}
