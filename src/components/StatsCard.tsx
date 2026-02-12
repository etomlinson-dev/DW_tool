import React from "react";

interface StatsCardProps {
  title: string;
  value: number | string;
  target?: number;
  change?: number;
  icon?: string;
  color?: "blue" | "green" | "orange" | "purple" | "red";
  showProgress?: boolean;
}

const colorStyles = {
  blue: {
    background: "linear-gradient(135deg, #667eea 0%, #5568d3 100%)",
    shadow: "rgba(102, 126, 234, 0.3)",
  },
  green: {
    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    shadow: "rgba(16, 185, 129, 0.3)",
  },
  orange: {
    background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
    shadow: "rgba(245, 158, 11, 0.3)",
  },
  purple: {
    background: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
    shadow: "rgba(139, 92, 246, 0.3)",
  },
  red: {
    background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
    shadow: "rgba(239, 68, 68, 0.3)",
  },
};

export function StatsCard({
  title,
  value,
  target,
  change,
  icon,
  color = "blue",
  showProgress = true,
}: StatsCardProps) {
  const styles = colorStyles[color];
  const progressPercent = target ? Math.min((Number(value) / target) * 100, 100) : 0;
  const isOnTrack = target ? Number(value) >= target : true;

  return (
    <div
      className="stats-card"
      style={{
        background: "#fff",
        borderRadius: "16px",
        padding: "20px",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
        transition: "transform 0.2s, box-shadow 0.2s",
        cursor: "default",
        minWidth: "200px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "12px",
        }}
      >
        <span
          style={{
            fontSize: "14px",
            color: "#6b7280",
            fontWeight: 500,
          }}
        >
          {title}
        </span>
        {icon && (
          <span
            style={{
              fontSize: "24px",
              width: "40px",
              height: "40px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "10px",
              background: styles.background,
              boxShadow: `0 4px 12px ${styles.shadow}`,
            }}
          >
            {icon}
          </span>
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "8px",
          marginBottom: "8px",
        }}
      >
        <span
          style={{
            fontSize: "32px",
            fontWeight: 700,
            color: "#1f2937",
          }}
        >
          {typeof value === "number" ? value.toLocaleString() : value}
        </span>
        {target !== undefined && (
          <span
            style={{
              fontSize: "14px",
              color: "#9ca3af",
            }}
          >
            / {target.toLocaleString()}
          </span>
        )}
      </div>

      {change !== undefined && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            marginBottom: "8px",
          }}
        >
          <span
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: change >= 0 ? "#10b981" : "#ef4444",
            }}
          >
            {change >= 0 ? "+" : ""}
            {change}%
          </span>
          <span
            style={{
              fontSize: "12px",
              color: "#9ca3af",
            }}
          >
            vs last period
          </span>
        </div>
      )}

      {showProgress && target !== undefined && (
        <div
          style={{
            width: "100%",
            height: "6px",
            background: "#e5e7eb",
            borderRadius: "3px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${progressPercent}%`,
              height: "100%",
              background: isOnTrack ? "#10b981" : "#f59e0b",
              borderRadius: "3px",
              transition: "width 0.5s ease",
            }}
          />
        </div>
      )}
    </div>
  );
}

export default StatsCard;
