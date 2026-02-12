
interface FilterButton {
  label: string;
  value: string;
  paramType: "status" | "timeframe";
  colors: {
    bg1: string;
    bg2: string;
    text: string;
  };
}

const FILTER_BUTTONS: FilterButton[] = [
  {
    label: "Not Contacted",
    value: "Not Contacted",
    paramType: "status",
    colors: { bg1: "#ed8936", bg2: "#dd6b20", text: "white" },
  },
  {
    label: "Attempted",
    value: "Attempted",
    paramType: "status",
    colors: { bg1: "#f6ad55", bg2: "#ed8936", text: "white" },
  },
  {
    label: "Follow-up",
    value: "Follow-up Needed",
    paramType: "status",
    colors: { bg1: "#fef5e7", bg2: "#fef3c7", text: "#744210" },
  },
  {
    label: "Qualified",
    value: "Qualified Lead",
    paramType: "status",
    colors: { bg1: "#48bb78", bg2: "#38a169", text: "white" },
  },
  {
    label: "Today",
    value: "today",
    paramType: "timeframe",
    colors: { bg1: "#4299e1", bg2: "#3182ce", text: "white" },
  },
];

interface FilterButtonsProps {
  activeStatus: string;
  activeTimeframe: string;
  onFilterChange: (paramType: "status" | "timeframe", value: string) => void;
}

export function FilterButtons({
  activeStatus,
  activeTimeframe,
  onFilterChange,
}: FilterButtonsProps) {
  const isActive = (btn: FilterButton) => {
    if (btn.paramType === "status") {
      return activeStatus === btn.value;
    }
    return activeTimeframe === btn.value;
  };

  return (
    <div className="filter-buttons">
      {FILTER_BUTTONS.map((btn) => {
        const active = isActive(btn);
        return (
          <button
            key={btn.value}
            onClick={() => {
              // Toggle off if already active, otherwise set the filter
              if (active) {
                onFilterChange(btn.paramType, "");
              } else {
                onFilterChange(btn.paramType, btn.value);
              }
            }}
            className={`filter-btn ${active ? "active" : ""}`}
            style={{
              background: `linear-gradient(135deg, ${btn.colors.bg1} 0%, ${btn.colors.bg2} 100%)`,
              color: btn.colors.text,
              boxShadow: active
                ? "0 0 0 3px #122c21, 0 2px 8px rgba(0,0,0,0.2)"
                : "0 2px 8px rgba(0,0,0,0.1)",
              transform: active ? "scale(1.05)" : "scale(1)",
            }}
          >
            {active && "✓ "}
            {btn.label}
          </button>
        );
      })}
    </div>
  );
}

export default FilterButtons;
