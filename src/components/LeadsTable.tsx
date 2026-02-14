import { Link } from "react-router-dom";
import type { Lead, LeadStatus } from "../types";
import { LEAD_STATUS_OPTIONS } from "../types";

interface LeadsTableProps {
  leads: Lead[];
  selectedIds: number[];
  onSelectionChange: (ids: number[]) => void;
  onStatusChange: (leadId: number, status: LeadStatus) => void;
  onQuickLog: (leadId: number) => void;
}

export function LeadsTable({
  leads,
  selectedIds,
  onSelectionChange,
  onStatusChange,
  onQuickLog,
}: LeadsTableProps) {
  const allSelected = leads.length > 0 && selectedIds.length === leads.length;

  const toggleAll = () => {
    if (allSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(leads.map((l) => l.id));
    }
  };

  const toggleOne = (id: number) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((i) => i !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th style={{ width: 50 }}>
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
              />
            </th>
            <th>Business</th>
            <th>Industry</th>
            <th>Rep</th>
            <th>Status</th>
            <th>Source</th>
            <th style={{ textAlign: "center" }}>Activities</th>
            <th>Last Activity</th>
            <th>Quick Actions</th>
          </tr>
        </thead>
        <tbody>
          {leads.length === 0 ? (
            <tr>
              <td colSpan={9} className="empty-state">
                <div className="empty-icon">📋</div>
                <p className="empty-title">No leads found</p>
                <p className="empty-text">
                  Try adjusting your filters or add a new lead to get started.
                </p>
              </td>
            </tr>
          ) : (
            leads.map((lead, idx) => (
              <tr key={lead.id} className={idx % 2 === 0 ? "even" : "odd"}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(lead.id)}
                    onChange={() => toggleOne(lead.id)}
                  />
                </td>
                <td className="business-name">
                  <Link to={`/lead/${lead.id}`} style={{ color: "inherit", textDecoration: "none", fontWeight: 600 }}>
                    {lead.business_name || "N/A"}
                  </Link>
                </td>
                <td>{lead.industry || "-"}</td>
                <td>{lead.assigned_rep || "Unassigned"}</td>
                <td>
                  <select
                    value={lead.status}
                    onChange={(e) =>
                      onStatusChange(lead.id, e.target.value as LeadStatus)
                    }
                    className="status-select"
                  >
                    {LEAD_STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{lead.source || "-"}</td>
                <td style={{ textAlign: "center" }}>{lead.activity_count}</td>
                <td>{formatDate(lead.last_activity)}</td>
                <td>
                  <div className="action-buttons">
                    <Link
                      to={`/dialer?lead_id=${lead.id}`}
                      className="action-btn call"
                      title="Call"
                    >
                      📞
                    </Link>
                    <Link
                      to={`/lead/${lead.id}`}
                      className="action-btn view"
                      title="View"
                    >
                      👁️
                    </Link>
                    {lead.email && (
                      <Link
                        to={`/lead/${lead.id}#email`}
                        className="action-btn email"
                        title="Email"
                      >
                        📧
                      </Link>
                    )}
                    <button
                      onClick={() => onQuickLog(lead.id)}
                      className="action-btn log"
                      title="Quick Log"
                    >
                      ✓
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default LeadsTable;
