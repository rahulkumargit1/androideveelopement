import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "VeriCash — Fake Currency Detection";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#0f1f3d",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Gold left accent bar */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 10,
            height: "100%",
            backgroundColor: "#ffbc78",
          }}
        />

        {/* Background decorative circles */}
        <div
          style={{
            position: "absolute",
            right: 80,
            top: "50%",
            transform: "translateY(-50%)",
            width: 440,
            height: 440,
            borderRadius: "50%",
            border: "2px solid rgba(255,188,120,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 340,
              height: 340,
              borderRadius: "50%",
              border: "1px solid rgba(255,188,120,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Star / seal shape using text */}
            <div
              style={{
                fontSize: 160,
                color: "rgba(255,188,120,0.18)",
                lineHeight: 1,
              }}
            >
              ★
            </div>
          </div>
        </div>

        {/* Content area */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "56px 70px",
            flex: 1,
          }}
        >
          {/* Logo row */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 40 }}>
            <div
              style={{
                width: 58,
                height: 58,
                borderRadius: "50%",
                backgroundColor: "#ffbc78",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                flexShrink: 0,
              }}
            >
              ★
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: "#ffffff", letterSpacing: -0.5 }}>
                VeriCash
              </span>
              <span style={{ fontSize: 13, color: "#8a96b2", letterSpacing: 2, textTransform: "uppercase" }}>
                Office of Currency Authentication
              </span>
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: 600, height: 1, backgroundColor: "#1e3460", marginBottom: 44 }} />

          {/* Headline */}
          <div style={{ fontSize: 74, fontWeight: 900, color: "#ffffff", letterSpacing: -2, lineHeight: 1.05, marginBottom: 10 }}>
            Fake Currency
          </div>
          <div style={{ fontSize: 74, fontWeight: 900, color: "#ffbc78", letterSpacing: -2, lineHeight: 1.05, marginBottom: 36 }}>
            Detection
          </div>

          {/* Description */}
          <div style={{ fontSize: 24, color: "#c5cee0", lineHeight: 1.5, maxWidth: 660, marginBottom: 44 }}>
            Scan any banknote · Instant authenticity verdict · 7 image-processing techniques
          </div>

          {/* Feature chips row */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {["INR · USD · EUR", "CIE Lab Fingerprints", "FFT Micro-print", "TFLite Classifier"].map((tag) => (
              <div
                key={tag}
                style={{
                  padding: "8px 20px",
                  borderRadius: 9999,
                  border: "1.5px solid rgba(255,188,120,0.5)",
                  color: "#ffbc78",
                  fontSize: 16,
                  fontWeight: 600,
                }}
              >
                {tag}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 70px",
            borderTop: "1px solid #1e3460",
            backgroundColor: "#0b1729",
          }}
        >
          <span style={{ color: "#4a7fbf", fontSize: 20, letterSpacing: 0.5 }}>
            vericash.duckdns.org
          </span>
          <div style={{ display: "flex", gap: 24 }}>
            {["Authentic ✅", "Suspicious ⚠️", "Counterfeit ❌"].map((v) => (
              <span key={v} style={{ color: "#565c65", fontSize: 16 }}>
                {v}
              </span>
            ))}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
