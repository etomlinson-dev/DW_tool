import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import type { TrendDataPoint, FunnelStage } from "../types";

// Color palette
const COLORS = {
  primary: "#667eea",
  secondary: "#5568d3",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  purple: "#8b5cf6",
  gray: "#6b7280",
};

const STATUS_COLORS: Record<string, string> = {
  "Not Contacted": "#9ca3af",
  Attempted: "#fbbf24",
  Connected: "#34d399",
  "Follow-up Needed": "#f97316",
  "Qualified Lead": "#667eea",
  "Proposal Sent": "#8b5cf6",
  "Not Interested": "#ef4444",
  Converted: "#10b981",
};

interface ActivityTrendChartProps {
  data: TrendDataPoint[];
  days?: number;
  onDaysChange?: (days: number) => void;
}

const RANGE_OPTIONS = [
  { label: "7D", value: 7 },
  { label: "14D", value: 14 },
  { label: "30D", value: 30 },
  { label: "60D", value: 60 },
  { label: "90D", value: 90 },
];

export function ActivityTrendChart({ data, days = 7, onDaysChange }: ActivityTrendChartProps) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: "16px",
        padding: "20px",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h3
          style={{
            fontSize: "16px",
            fontWeight: 600,
            color: "#1f2937",
            margin: 0,
          }}
        >
          Activity Trend (Last {days} Days)
        </h3>
        {onDaysChange && (
          <div style={{ display: "flex", gap: "4px" }}>
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onDaysChange(opt.value)}
                style={{
                  padding: "4px 10px",
                  fontSize: "12px",
                  fontWeight: days === opt.value ? 600 : 400,
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  background: days === opt.value ? "#667eea" : "#f3f4f6",
                  color: days === opt.value ? "#fff" : "#6b7280",
                  transition: "all 0.15s",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 12, fill: "#6b7280" }}
            axisLine={{ stroke: "#e5e7eb" }}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "#6b7280" }}
            axisLine={{ stroke: "#e5e7eb" }}
          />
          <Tooltip
            contentStyle={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="activities"
            stroke={COLORS.primary}
            strokeWidth={2}
            dot={{ fill: COLORS.primary, strokeWidth: 2 }}
            name="Total"
          />
          <Line
            type="monotone"
            dataKey="calls"
            stroke={COLORS.success}
            strokeWidth={2}
            dot={{ fill: COLORS.success, strokeWidth: 2 }}
            name="Calls"
          />
          <Line
            type="monotone"
            dataKey="emails"
            stroke={COLORS.purple}
            strokeWidth={2}
            dot={{ fill: COLORS.purple, strokeWidth: 2 }}
            name="Emails"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface StatusDistributionChartProps {
  data: Record<string, number>;
}

export function StatusDistributionChart({ data }: StatusDistributionChartProps) {
  const chartData = Object.entries(data)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => ({
      name: status,
      value: count,
      color: STATUS_COLORS[status] || COLORS.gray,
    }));

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: "16px",
        padding: "20px",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
      }}
    >
      <h3
        style={{
          fontSize: "16px",
          fontWeight: 600,
          color: "#1f2937",
          marginBottom: "16px",
        }}
      >
        Lead Status Distribution
      </h3>
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
            label={({ name, percent }) =>
              `${name.length > 12 ? name.slice(0, 12) + "..." : name} ${(percent * 100).toFixed(0)}%`
            }
            labelLine={{ stroke: "#9ca3af", strokeWidth: 1 }}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

interface ActivityBreakdownChartProps {
  data: Record<string, number>;
}

export function ActivityBreakdownChart({ data }: ActivityBreakdownChartProps) {
  const chartData = Object.entries(data).map(([type, count]) => ({
    name: type,
    count,
  }));

  const barColors = [
    COLORS.primary,
    COLORS.success,
    COLORS.purple,
    COLORS.warning,
    COLORS.danger,
    COLORS.gray,
  ];

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: "16px",
        padding: "20px",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
      }}
    >
      <h3
        style={{
          fontSize: "16px",
          fontWeight: 600,
          color: "#1f2937",
          marginBottom: "16px",
        }}
      >
        Activity Breakdown (This Week)
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis type="number" tick={{ fontSize: 12, fill: "#6b7280" }} />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 12, fill: "#6b7280" }}
            width={80}
          />
          <Tooltip
            contentStyle={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
            }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {chartData.map((_, index) => (
              <Cell key={`cell-${index}`} fill={barColors[index % barColors.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface ConversionFunnelChartProps {
  data: FunnelStage[];
}

export function ConversionFunnelChart({ data }: ConversionFunnelChartProps) {
  const funnelColors = ["#667eea", "#8b5cf6", "#10b981", "#059669", "#ef4444"];

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: "16px",
        padding: "20px",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
      }}
    >
      <h3
        style={{
          fontSize: "16px",
          fontWeight: 600,
          color: "#1f2937",
          marginBottom: "16px",
        }}
      >
        Conversion Funnel
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {data.map((stage, index) => (
          <div
            key={stage.stage}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div
              style={{
                width: `${Math.max(20, stage.percentage)}%`,
                height: "32px",
                background: funnelColors[index % funnelColors.length],
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: "13px",
                fontWeight: 600,
                transition: "width 0.5s ease",
                minWidth: "80px",
              }}
            >
              {stage.count}
            </div>
            <span
              style={{
                fontSize: "13px",
                color: "#6b7280",
                whiteSpace: "nowrap",
              }}
            >
              {stage.stage} ({stage.percentage}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default {
  ActivityTrendChart,
  StatusDistributionChart,
  ActivityBreakdownChart,
  ConversionFunnelChart,
};
