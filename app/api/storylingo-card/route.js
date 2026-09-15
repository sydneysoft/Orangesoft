import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1080px",
          height: "1350px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "82px",
          background: "#090807",
          color: "#f7f0df",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "26px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
            <div
              style={{
                width: "68px",
                height: "68px",
                borderRadius: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#d7b76a",
                color: "#090807",
                fontSize: "34px",
                fontWeight: 900,
              }}
            >
              S
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: "54px", fontWeight: 900, letterSpacing: "-2px" }}>STORYLINGO</div>
              <div style={{ fontSize: "21px", letterSpacing: "5px", color: "#d7b76a" }}>LEARN LANGUAGES THROUGH STORIES</div>
            </div>
          </div>

          <div style={{ marginTop: "60px", fontSize: "78px", lineHeight: 1.02, fontWeight: 900, maxWidth: "880px" }}>
            A reading room for language learners.
          </div>
          <div style={{ fontSize: "34px", lineHeight: 1.35, color: "#d9d1bf", maxWidth: "865px" }}>
            Read stories you actually want to finish. Keep translation, vocabulary and practice close at hand while you read.
          </div>

          <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", marginTop: "28px" }}>
            {["🇬🇧 English", "🇺🇦 Ukrainian", "🇵🇱 Polish", "🇫🇷 French", "🇩🇪 German", "🇪🇸 Spanish"].map((label) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  padding: "14px 19px",
                  border: "1px solid #4d4638",
                  borderRadius: "999px",
                  fontSize: "23px",
                  background: "#151311",
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div style={{ display: "flex", gap: "18px" }}>
            {["TRANSLATION", "VOCABULARY", "PRACTICE"].map((item) => (
              <div
                key={item}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  padding: "26px",
                  border: "1px solid #3a352c",
                  background: "#12100e",
                }}
              >
                <div style={{ color: "#d7b76a", fontSize: "17px", letterSpacing: "3px" }}>BUILT INTO READING</div>
                <div style={{ marginTop: "10px", fontSize: "28px", fontWeight: 800 }}>{item}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #3a352c", paddingTop: "24px" }}>
            <div style={{ fontSize: "26px", fontWeight: 700 }}>storylingo.uk</div>
            <div style={{ fontSize: "20px", color: "#a99f8b" }}>UKRAINIAN · POLISH · FRENCH · UNIVERSAL STORIES</div>
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1350 }
  );
}
