import React from "react";
import type { LeaderboardEntry } from "../types";

interface LeaderboardProps {
  data: LeaderboardEntry[];
  timeframe: "today" | "week" | "month";
  onTimeframeChange: (timeframe: "today" | "week" | "month") => void;
}

const getRankBadge = (rank: number) => {
  if (rank === 1) return { emoji: "🥇", color: "#fbbf24" };
  if (rank === 2) return { emoji: "🥈", color: "#9ca3af" };
  if (rank === 3) return { emoji: "🥉", color: "#cd7f32" };
  return { emoji: `#${rank}`, color: "#6b7280" };
};

export function Leaderboard({ data, timeframe, onTimeframeChange }: LeaderboardProps) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: "16px",
        padding: "20px",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "16px",
        }}
      >
        <h3
          style={{
            fontSize: "16px",
            fontWeight: 600,
            color: "#1f2937",
            margin: 0,
          }}
        >
          Rep Leaderboard
        </h3>
        <div style={{ display: "flex", gap: "4px" }}>
          {(["today", "week", "month"] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => onTimeframeChange(tf)}
              style={{
                padding: "6px 12px",
                fontSize: "12px",
                fontWeight: 500,
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                background: timeframe === tf ? "#667eea" : "#f3f4f6",
                color: timeframe === tf ? "#fff" : "#6b7280",
                transition: "all 0.2s",
              }}
            >
              {tf.charAt(0).toUpperCase() + tf.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "32px",
            color: "#9ca3af",
          }}
        >
          No activity data yet
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {data.map((entry) => {
            const badge = getRankBadge(entry.rank);
            return (
              <div
                key={entry.rep}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "12px",
                  background: entry.rank <= 3 ? "#f9fafb" : "transparent",
                  borderRadius: "10px",
                  transition: "background 0.2s",
                }}
              >
                <span
                  style={{
                    fontSize: entry.rank <= 3 ? "20px" : "14px",
                    fontWeight: 600,
                    color: badge.color,
                    width: "40px",
                    textAlign: "center",
                  }}
                >
                  {badge.emoji}
                </span>
                <div style={{ flex: 1, marginLeft: "12px" }}>
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "#1f2937",
                    }}
                  >
                    {entry.rep}
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#9ca3af",
                    }}
                  >
                    {entry.leads_assigned} leads assigned
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: "16px",
                    alignItems: "center",
                  }}
                >
                  <div style={{ textAlign: "center" }}>
                    <div
                      style={{
                        fontSize: "16px",
                        fontWeight: 700,
                        color: "#667eea",
                      }}
                    >
                      {entry.activities}
                    </div>
                    <div style={{ fontSize: "10px", color: "#9ca3af" }}>Activities</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: 600,
                        color: "#10b981",
                      }}
                    >
                      {entry.calls}
                    </div>
                    <div style={{ fontSize: "10px", color: "#9ca3af" }}>Calls</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: 600,
                        color: "#8b5cf6",
                      }}
                    >
                      {entry.emails}
                    </div>
                    <div style={{ fontSize: "10px", color: "#9ca3af" }}>Emails</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: 600,
                        color: "#059669",
                      }}
                    >
                      {entry.conversions}
                    </div>
                    <div style={{ fontSize: "10px", color: "#9ca3af" }}>Converted</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Leaderboard;
