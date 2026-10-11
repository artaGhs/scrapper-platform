import { ImageResponse } from "next/og";

export const alt =
  "ThreadFinder — Someone’s asking. You can help. Find Reddit conversations about the problem your business solves.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: "100%",
        height: "100%",
        position: "relative",
        color: "#fff",
        background:
          "radial-gradient(ellipse 85% 120% at 50% -20%, #030a24 60%, #08256f 72%, #1f4bff 79%, #79a2ff 86%, #eaf1ff 93%, #fff 98%)",
        padding: "42px 64px",
      }}
    >
      {[
        [105, 146],
        [240, 74],
        [1020, 145],
        [1100, 290],
        [75, 350],
        [944, 54],
        [325, 154],
        [820, 190],
      ].map(([left, top], index) => (
        <div
          key={index}
          style={{
            display: "flex",
            position: "absolute",
            left,
            top,
            width: 3,
            height: 3,
            borderRadius: "50%",
            background: "#dce8ff",
            opacity: 0.5,
          }}
        />
      ))}
      <div
        style={{
          display: "flex",
          width: "100%",
          alignItems: "center",
          gap: 12,
          fontSize: 34,
          letterSpacing: -1.5,
        }}
      >
        <svg width="38" height="38" viewBox="0 0 28 28" fill="none">
          <path
            d="M3 5h22v15H14l-8 5v-5H3z"
            stroke="#fff"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M8 10h12M8 15h7"
            stroke="#fff"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
        <span>scrapper.</span>
      </div>
      <div
        style={{
          display: "flex",
          marginTop: 46,
          border: "1px solid rgba(220,232,255,0.3)",
          background: "rgba(220,232,255,0.08)",
          borderRadius: 30,
          padding: "10px 22px",
          color: "#dce8ff",
          fontSize: 20,
        }}
      >
        One free Reddit search
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginTop: 26,
          fontSize: 78,
          letterSpacing: -4,
          lineHeight: 1.12,
        }}
      >
        <span>Someone’s asking.</span>
        <span style={{ fontStyle: "italic", color: "#dce8ff" }}>
          You can help.
        </span>
      </div>
      <div
        style={{
          display: "flex",
          maxWidth: 780,
          marginTop: 28,
          textAlign: "center",
          fontSize: 25,
          lineHeight: 1.45,
          color: "#dce8ff",
        }}
      >
        Find Reddit conversations about the problem your business solves.
      </div>
    </div>,
    size,
  );
}
