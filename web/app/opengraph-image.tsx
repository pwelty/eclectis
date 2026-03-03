import { ImageResponse } from "next/og"

export const runtime = "edge"
export const alt = "Eclectis — AI content curation"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          backgroundColor: "#1a2332",
          color: "#eef0f4",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "24px",
          }}
        >
          {/* Brand accent bar */}
          <div
            style={{
              width: "64px",
              height: "4px",
              backgroundColor: "#db9226",
              borderRadius: "2px",
            }}
          />
          <div
            style={{
              fontSize: "72px",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              lineHeight: 1,
            }}
          >
            Eclectis
          </div>
          <div
            style={{
              fontSize: "28px",
              fontWeight: 400,
              color: "#8b95a5",
              maxWidth: "600px",
              textAlign: "center",
              lineHeight: 1.4,
            }}
          >
            AI content curation for what matters
          </div>
        </div>
        {/* Footer keywords */}
        <div
          style={{
            position: "absolute",
            bottom: "48px",
            display: "flex",
            gap: "32px",
            fontSize: "16px",
            color: "#5a6778",
          }}
        >
          <span>RSS feeds</span>
          <span>Email briefings</span>
          <span>Podcasts</span>
          <span>Read-later</span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
