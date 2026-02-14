import { useState, useCallback, useRef } from "react";
import { leadsApi } from "../api/client";
import type { Lead, LeadStatus, LeadSource, LEAD_STATUS_OPTIONS, LEAD_SOURCE_OPTIONS } from "../types";

interface ImportRow {
  id: number;
  business_name: string;
  contact_name: string;
  contact_title: string;
  email: string;
  phone: string;
  website: string;
  industry: string;
  location: string;
  source: string;
  service_category: string;
  assigned_rep: string;
  status: LeadStatus;
  tags: string;
  deal_value: string;
  notes: string;
  isValid: boolean;
  errors: string[];
}

interface ColumnMapping {
  csvColumn: string;
  appField: string;
}

type ImportStep = "upload" | "mapping" | "preview" | "importing" | "complete";

export function BulkImport() {
  const [step, setStep] = useState<ImportStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [previewData, setPreviewData] = useState<ImportRow[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<{
    success: number;
    failed: number;
    errors: string[];
  }>({ success: 0, failed: 0, errors: [] });
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const appFields = [
    { id: "business_name", label: "Business Name", required: true },
    { id: "contact_name", label: "Contact Name", required: false },
    { id: "contact_title", label: "Contact Title", required: false },
    { id: "email", label: "Email", required: false },
    { id: "phone", label: "Phone", required: false },
    { id: "website", label: "Website", required: false },
    { id: "industry", label: "Industry", required: false },
    { id: "location", label: "Location", required: false },
    { id: "source", label: "Lead Source", required: false },
    { id: "service_category", label: "Service Category", required: false },
    { id: "assigned_rep", label: "Assigned Rep", required: false },
    { id: "status", label: "Status", required: false },
    { id: "tags", label: "Tags", required: false },
    { id: "deal_value", label: "Deal Value", required: false },
    { id: "notes", label: "Notes", required: false },
    { id: "", label: "-- Skip Column --", required: false },
  ];

  const parseCSV = (text: string): { headers: string[]; data: string[][] } => {
    const lines = text.split("\n").filter((line) => line.trim());
    if (lines.length === 0) return { headers: [], data: [] };

    const parseRow = (row: string): string[] => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;

      for (let i = 0; i < row.length; i++) {
        const char = row[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          result.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseRow(lines[0]);
    const data = lines.slice(1).map(parseRow);

    return { headers, data };
  };

  const handleFile = useCallback((uploadedFile: File) => {
    if (!uploadedFile.name.endsWith(".csv")) {
      alert("Please upload a CSV file");
      return;
    }

    setFile(uploadedFile);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers, data } = parseCSV(text);
      setCsvHeaders(headers);
      setCsvData(data);

      // Auto-map columns based on header names
      const autoMappings: ColumnMapping[] = headers.map((header) => {
        const headerLower = header.toLowerCase().replace(/[_\s-]/g, "");
        let appField = "";

        if (headerLower.includes("business") || headerLower.includes("company")) {
          appField = "business_name";
        } else if (headerLower.includes("title") || headerLower.includes("role") || headerLower.includes("position")) {
          appField = "contact_title";
        } else if (headerLower.includes("contact") || headerLower === "name") {
          appField = "contact_name";
        } else if (headerLower.includes("email")) {
          appField = "email";
        } else if (headerLower.includes("phone") || headerLower.includes("tel")) {
          appField = "phone";
        } else if (headerLower.includes("website") || headerLower.includes("url")) {
          appField = "website";
        } else if (headerLower.includes("industry") || headerLower.includes("sector")) {
          appField = "industry";
        } else if (headerLower.includes("location") || headerLower.includes("city") || headerLower.includes("address") || headerLower.includes("state")) {
          appField = "location";
        } else if (headerLower.includes("source")) {
          appField = "source";
        } else if (headerLower.includes("service") || headerLower.includes("category")) {
          appField = "service_category";
        } else if (headerLower.includes("rep") || headerLower.includes("assigned") || headerLower.includes("owner")) {
          appField = "assigned_rep";
        } else if (headerLower.includes("status")) {
          appField = "status";
        } else if (headerLower.includes("tag") || headerLower.includes("label")) {
          appField = "tags";
        } else if (headerLower.includes("deal") || headerLower.includes("value") || headerLower.includes("amount")) {
          appField = "deal_value";
        } else if (headerLower.includes("note")) {
          appField = "notes";
        }

        return { csvColumn: header, appField };
      });

      setMappings(autoMappings);
      setStep("mapping");
    };
    reader.readAsText(uploadedFile);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) handleFile(droppedFile);
    },
    [handleFile]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const updateMapping = (csvColumn: string, appField: string) => {
    setMappings((prev) =>
      prev.map((m) => (m.csvColumn === csvColumn ? { ...m, appField } : m))
    );
  };

  const processPreview = () => {
    const processedData: ImportRow[] = csvData.map((row, index) => {
      const rowData: Record<string, string> = {};
      mappings.forEach((mapping, i) => {
        if (mapping.appField && row[i]) {
          rowData[mapping.appField] = row[i];
        }
      });

      const errors: string[] = [];

      // Validate required fields
      if (!rowData.business_name?.trim()) {
        errors.push("Business name is required");
      }

      // Validate email format
      if (rowData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rowData.email)) {
        errors.push("Invalid email format");
      }

      // Validate status
      const validStatuses = [
        "Not Contacted",
        "Attempted",
        "Connected",
        "Follow-up Needed",
        "Qualified Lead",
        "Proposal Sent",
        "Not Interested",
        "Converted",
      ];
      const status = (rowData.status || "Not Contacted") as LeadStatus;
      if (rowData.status && !validStatuses.includes(rowData.status)) {
        errors.push(`Invalid status: ${rowData.status}`);
      }

      return {
        id: index + 1,
        business_name: rowData.business_name || "",
        contact_name: rowData.contact_name || "",
        contact_title: rowData.contact_title || "",
        email: rowData.email || "",
        phone: rowData.phone || "",
        website: rowData.website || "",
        industry: rowData.industry || "",
        location: rowData.location || "",
        source: rowData.source || "",
        service_category: rowData.service_category || "",
        assigned_rep: rowData.assigned_rep || "",
        status: validStatuses.includes(status) ? status : "Not Contacted",
        tags: rowData.tags || "",
        deal_value: rowData.deal_value || "",
        notes: rowData.notes || "",
        isValid: errors.length === 0,
        errors,
      };
    });

    setPreviewData(processedData);
    setStep("preview");
  };

  const startImport = async () => {
    setStep("importing");
    setImportProgress(0);

    const validRows = previewData.filter((row) => row.isValid);
    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      try {
        const leadData: Partial<Lead> = {
          business_name: row.business_name,
          contact_name: row.contact_name || null,
          contact_title: row.contact_title || null,
          email: row.email || null,
          phone: row.phone || null,
          website: row.website || null,
          industry: row.industry || null,
          location: row.location || null,
          source: row.source || null,
          service_category: row.service_category as Lead["service_category"] || null,
          assigned_rep: row.assigned_rep || null,
          status: row.status,
          tags: row.tags ? row.tags.split(",").map(t => t.trim()) : [],
          deal_value: row.deal_value ? parseFloat(row.deal_value.replace(/[,$]/g, "")) : null,
          notes: row.notes || null,
        };

        await leadsApi.createLead(leadData);
        successCount++;
      } catch (error) {
        failedCount++;
        errors.push(`Row ${row.id}: Failed to import "${row.business_name}"`);
      }

      setImportProgress(((i + 1) / validRows.length) * 100);
    }

    setImportResults({
      success: successCount,
      failed: failedCount,
      errors,
    });
    setStep("complete");
  };

  const resetImport = () => {
    setStep("upload");
    setFile(null);
    setCsvHeaders([]);
    setCsvData([]);
    setMappings([]);
    setPreviewData([]);
    setImportProgress(0);
    setImportResults({ success: 0, failed: 0, errors: [] });
  };

  const downloadTemplate = () => {
    const template = `business_name,contact_name,contact_title,email,phone,website,industry,location,source,service_category,assigned_rep,status,tags,deal_value,notes
"Acme Corporation","John Smith","CEO","john@acme.com","555-123-4567","https://acme.com","Technology","New York, NY","LinkedIn","Consulting","Thomas Lin","Not Contacted","enterprise,priority","50000","Initial outreach pending"
"Global Industries","Jane Doe","VP Sales","jane@global.com","555-987-6543","https://global.com","Manufacturing","Los Angeles, CA","Referral","Marketing","Sarah Johnson","Attempted","warm","25000","Left voicemail"`;

    const blob = new Blob([template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lead_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Bulk Import</h1>
          <p style={styles.subtitle}>Import leads from CSV files</p>
        </div>
        <button onClick={downloadTemplate} style={styles.templateBtn}>
          📥 Download Template
        </button>
      </div>

      {/* Progress Steps */}
      <div style={styles.stepsContainer}>
        {["upload", "mapping", "preview", "complete"].map((s, index) => (
          <div
            key={s}
            style={{
              ...styles.stepItem,
              ...(step === s || ["importing", "complete"].includes(step) && s === "complete"
                ? styles.stepActive
                : {}),
              ...(index < ["upload", "mapping", "preview", "complete"].indexOf(step)
                ? styles.stepCompleted
                : {}),
            }}
          >
            <div style={styles.stepNumber}>
              {index < ["upload", "mapping", "preview", "complete"].indexOf(step) ? "✓" : index + 1}
            </div>
            <span style={styles.stepLabel}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </span>
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div style={styles.content}>
        {/* Upload Step */}
        {step === "upload" && (
          <div style={styles.uploadSection}>
            <div
              style={{
                ...styles.dropzone,
                ...(isDragging ? styles.dropzoneActive : {}),
              }}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                style={{ display: "none" }}
              />
              <div style={styles.dropzoneIcon}>📂</div>
              <h3 style={styles.dropzoneTitle}>
                Drop your CSV file here, or click to browse
              </h3>
              <p style={styles.dropzoneText}>
                Supports CSV files with up to 10,000 rows
              </p>
            </div>

            <div style={styles.infoCard}>
              <h3 style={styles.infoTitle}>📋 CSV Format Requirements</h3>
              <ul style={styles.infoList}>
                <li>First row must contain column headers</li>
                <li>Business name is required for each row</li>
                <li>Use UTF-8 encoding for special characters</li>
                <li>Wrap text with commas in double quotes</li>
              </ul>
            </div>
          </div>
        )}

        {/* Mapping Step */}
        {step === "mapping" && (
          <div style={styles.mappingSection}>
            <div style={styles.mappingHeader}>
              <div>
                <h2 style={styles.sectionTitle}>Map Your Columns</h2>
                <p style={styles.sectionDesc}>
                  Match your CSV columns to the corresponding fields
                </p>
              </div>
              <div style={styles.fileInfo}>
                <span style={styles.fileName}>📄 {file?.name}</span>
                <span style={styles.rowCount}>{csvData.length} rows</span>
              </div>
            </div>

            <div style={styles.mappingGrid}>
              {mappings.map((mapping) => (
                <div key={mapping.csvColumn} style={styles.mappingRow}>
                  <div style={styles.csvColumnBox}>
                    <span style={styles.csvColumnLabel}>CSV Column</span>
                    <span style={styles.csvColumnName}>{mapping.csvColumn}</span>
                    <span style={styles.csvColumnPreview}>
                      {csvData[0]?.[csvHeaders.indexOf(mapping.csvColumn)] || "-"}
                    </span>
                  </div>
                  <div style={styles.mappingArrow}>→</div>
                  <select
                    value={mapping.appField}
                    onChange={(e) => updateMapping(mapping.csvColumn, e.target.value)}
                    style={{
                      ...styles.mappingSelect,
                      ...(mapping.appField === "business_name"
                        ? styles.mappingSelectRequired
                        : {}),
                    }}
                  >
                    <option value="">-- Select Field --</option>
                    {appFields.map((field) => (
                      <option key={field.id} value={field.id}>
                        {field.label}
                        {field.required ? " *" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div style={styles.mappingActions}>
              <button onClick={() => setStep("upload")} style={styles.backBtn}>
                ← Back
              </button>
              <button
                onClick={processPreview}
                style={styles.continueBtn}
                disabled={!mappings.some((m) => m.appField === "business_name")}
              >
                Preview Import →
              </button>
            </div>
          </div>
        )}

        {/* Preview Step */}
        {step === "preview" && (
          <div style={styles.previewSection}>
            <div style={styles.previewHeader}>
              <div>
                <h2 style={styles.sectionTitle}>Review Import Data</h2>
                <p style={styles.sectionDesc}>
                  Verify the data before importing
                </p>
              </div>
              <div style={styles.previewStats}>
                <div style={styles.statBox}>
                  <span style={styles.statValue}>{previewData.length}</span>
                  <span style={styles.statLabel}>Total Rows</span>
                </div>
                <div style={{ ...styles.statBox, ...styles.statBoxGreen }}>
                  <span style={styles.statValue}>
                    {previewData.filter((r) => r.isValid).length}
                  </span>
                  <span style={styles.statLabel}>Valid</span>
                </div>
                <div style={{ ...styles.statBox, ...styles.statBoxRed }}>
                  <span style={styles.statValue}>
                    {previewData.filter((r) => !r.isValid).length}
                  </span>
                  <span style={styles.statLabel}>Errors</span>
                </div>
              </div>
            </div>

            <div style={styles.previewTable}>
              <div style={styles.tableHeader}>
                <span style={{ width: "40px" }}>#</span>
                <span style={{ flex: 2 }}>Business Name</span>
                <span style={{ flex: 1.5 }}>Contact</span>
                <span style={{ flex: 1.5 }}>Email</span>
                <span style={{ flex: 1 }}>Industry</span>
                <span style={{ flex: 1 }}>Status</span>
                <span style={{ width: "100px", textAlign: "center" }}>Valid</span>
              </div>
              <div style={styles.tableBody}>
                {previewData.slice(0, 100).map((row) => (
                  <div
                    key={row.id}
                    style={{
                      ...styles.tableRow,
                      ...(row.isValid ? {} : styles.tableRowError),
                    }}
                  >
                    <span style={{ width: "40px", color: "#9ca3af" }}>
                      {row.id}
                    </span>
                    <span style={{ flex: 2, fontWeight: 500 }}>
                      {row.business_name || "-"}
                    </span>
                    <span style={{ flex: 1.5 }}>{row.contact_name || "-"}</span>
                    <span style={{ flex: 1.5, color: "#6b7280" }}>
                      {row.email || "-"}
                    </span>
                    <span style={{ flex: 1 }}>{row.industry || "-"}</span>
                    <span style={{ flex: 1 }}>
                      <span style={styles.statusBadge}>{row.status}</span>
                    </span>
                    <span
                      style={{
                        width: "100px",
                        textAlign: "center",
                        color: row.isValid ? "#10b981" : "#ef4444",
                      }}
                    >
                      {row.isValid ? "✓" : "✗"}
                    </span>
                  </div>
                ))}
              </div>
              {previewData.length > 100 && (
                <div style={styles.tableMore}>
                  + {previewData.length - 100} more rows
                </div>
              )}
            </div>

            {/* Error Summary */}
            {previewData.some((r) => !r.isValid) && (
              <div style={styles.errorSummary}>
                <h4 style={styles.errorTitle}>⚠️ Validation Errors</h4>
                <div style={styles.errorList}>
                  {previewData
                    .filter((r) => !r.isValid)
                    .slice(0, 10)
                    .map((row) => (
                      <div key={row.id} style={styles.errorItem}>
                        <span style={styles.errorRow}>Row {row.id}:</span>
                        {row.errors.join(", ")}
                      </div>
                    ))}
                  {previewData.filter((r) => !r.isValid).length > 10 && (
                    <div style={styles.errorMore}>
                      + {previewData.filter((r) => !r.isValid).length - 10} more
                      errors
                    </div>
                  )}
                </div>
              </div>
            )}

            <div style={styles.previewActions}>
              <button onClick={() => setStep("mapping")} style={styles.backBtn}>
                ← Back
              </button>
              <button
                onClick={startImport}
                style={styles.importBtn}
                disabled={previewData.filter((r) => r.isValid).length === 0}
              >
                Import {previewData.filter((r) => r.isValid).length} Leads
              </button>
            </div>
          </div>
        )}

        {/* Importing Step */}
        {step === "importing" && (
          <div style={styles.importingSection}>
            <div style={styles.importingIcon}>⏳</div>
            <h2 style={styles.importingTitle}>Importing Leads...</h2>
            <p style={styles.importingText}>
              Please wait while we process your data
            </p>
            <div style={styles.progressBar}>
              <div
                style={{
                  ...styles.progressFill,
                  width: `${importProgress}%`,
                }}
              />
            </div>
            <span style={styles.progressText}>
              {Math.round(importProgress)}% complete
            </span>
          </div>
        )}

        {/* Complete Step */}
        {step === "complete" && (
          <div style={styles.completeSection}>
            <div
              style={{
                ...styles.completeIcon,
                background: importResults.failed === 0 ? "#dcfce7" : "#fef3c7",
              }}
            >
              {importResults.failed === 0 ? "✓" : "⚠️"}
            </div>
            <h2 style={styles.completeTitle}>Import Complete!</h2>
            <p style={styles.completeText}>
              Successfully imported {importResults.success} lead
              {importResults.success !== 1 ? "s" : ""}
              {importResults.failed > 0 &&
                `, ${importResults.failed} failed`}
            </p>

            <div style={styles.completeStats}>
              <div style={{ ...styles.completeStatBox, ...styles.statBoxGreen }}>
                <span style={styles.completeStatValue}>
                  {importResults.success}
                </span>
                <span style={styles.completeStatLabel}>Imported</span>
              </div>
              <div style={{ ...styles.completeStatBox, ...styles.statBoxRed }}>
                <span style={styles.completeStatValue}>
                  {importResults.failed}
                </span>
                <span style={styles.completeStatLabel}>Failed</span>
              </div>
            </div>

            {importResults.errors.length > 0 && (
              <div style={styles.errorSummary}>
                <h4 style={styles.errorTitle}>Import Errors</h4>
                <div style={styles.errorList}>
                  {importResults.errors.map((error, index) => (
                    <div key={index} style={styles.errorItem}>
                      {error}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={styles.completeActions}>
              <button onClick={resetImport} style={styles.newImportBtn}>
                Start New Import
              </button>
              <a href="/" style={styles.viewLeadsBtn}>
                View All Leads →
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: "24px",
    maxWidth: "1344px",
    margin: "0 auto",
    minHeight: "calc(100vh - 80px)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "32px",
  },
  title: {
    fontSize: "28px",
    fontWeight: 700,
    color: "#1f2937",
    margin: 0,
  },
  subtitle: {
    fontSize: "14px",
    color: "#6b7280",
    margin: "4px 0 0",
  },
  templateBtn: {
    padding: "10px 20px",
    borderRadius: "10px",
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#374151",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
  },
  stepsContainer: {
    display: "flex",
    justifyContent: "center",
    gap: "24px",
    marginBottom: "32px",
  },
  stepItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: "#9ca3af",
  },
  stepActive: {
    color: "#667eea",
  },
  stepCompleted: {
    color: "#10b981",
  },
  stepNumber: {
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    background: "currentColor",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "13px",
    fontWeight: 600,
  },
  stepLabel: {
    fontSize: "14px",
    fontWeight: 500,
  },
  content: {
    background: "#fff",
    borderRadius: "16px",
    padding: "32px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.06)",
  },
  uploadSection: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  dropzone: {
    border: "2px dashed #e5e7eb",
    borderRadius: "16px",
    padding: "64px 24px",
    textAlign: "center",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  dropzoneActive: {
    border: "2px dashed #667eea",
    background: "#f8fafc",
  },
  dropzoneIcon: {
    fontSize: "48px",
    marginBottom: "16px",
  },
  dropzoneTitle: {
    fontSize: "18px",
    fontWeight: 600,
    color: "#1f2937",
    margin: "0 0 8px",
  },
  dropzoneText: {
    fontSize: "14px",
    color: "#6b7280",
    margin: 0,
  },
  infoCard: {
    background: "#f9fafb",
    borderRadius: "12px",
    padding: "20px 24px",
  },
  infoTitle: {
    fontSize: "15px",
    fontWeight: 600,
    color: "#1f2937",
    margin: "0 0 12px",
  },
  infoList: {
    margin: 0,
    paddingLeft: "20px",
    fontSize: "14px",
    color: "#4b5563",
    lineHeight: 1.8,
  },
  mappingSection: {},
  mappingHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "24px",
  },
  sectionTitle: {
    fontSize: "20px",
    fontWeight: 600,
    color: "#1f2937",
    margin: "0 0 4px",
  },
  sectionDesc: {
    fontSize: "14px",
    color: "#6b7280",
    margin: 0,
  },
  fileInfo: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  fileName: {
    fontSize: "14px",
    color: "#374151",
    fontWeight: 500,
  },
  rowCount: {
    fontSize: "13px",
    color: "#6b7280",
    padding: "4px 10px",
    background: "#f3f4f6",
    borderRadius: "12px",
  },
  mappingGrid: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    marginBottom: "24px",
  },
  mappingRow: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    padding: "16px",
    background: "#f9fafb",
    borderRadius: "12px",
  },
  csvColumnBox: {
    flex: 1,
  },
  csvColumnLabel: {
    display: "block",
    fontSize: "11px",
    color: "#9ca3af",
    textTransform: "uppercase",
    marginBottom: "4px",
  },
  csvColumnName: {
    display: "block",
    fontSize: "15px",
    fontWeight: 600,
    color: "#1f2937",
  },
  csvColumnPreview: {
    display: "block",
    fontSize: "12px",
    color: "#6b7280",
    marginTop: "4px",
    fontStyle: "italic",
  },
  mappingArrow: {
    fontSize: "18px",
    color: "#9ca3af",
  },
  mappingSelect: {
    flex: 1,
    padding: "12px 16px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    fontSize: "14px",
    background: "#fff",
  },
  mappingSelectRequired: {
    borderColor: "#667eea",
  },
  mappingActions: {
    display: "flex",
    justifyContent: "space-between",
    paddingTop: "24px",
    borderTop: "1px solid #e5e7eb",
  },
  backBtn: {
    padding: "12px 24px",
    borderRadius: "10px",
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#374151",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
  },
  continueBtn: {
    padding: "12px 24px",
    borderRadius: "10px",
    border: "none",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  },
  previewSection: {},
  previewHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "24px",
  },
  previewStats: {
    display: "flex",
    gap: "16px",
  },
  statBox: {
    padding: "12px 20px",
    borderRadius: "12px",
    background: "#f3f4f6",
    textAlign: "center",
  },
  statBoxGreen: {
    background: "#dcfce7",
  },
  statBoxRed: {
    background: "#fee2e2",
  },
  statValue: {
    display: "block",
    fontSize: "24px",
    fontWeight: 700,
    color: "#1f2937",
  },
  statLabel: {
    fontSize: "12px",
    color: "#6b7280",
  },
  previewTable: {
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    overflow: "hidden",
    marginBottom: "24px",
  },
  tableHeader: {
    display: "flex",
    padding: "12px 16px",
    background: "#f9fafb",
    fontSize: "12px",
    fontWeight: 600,
    color: "#6b7280",
    textTransform: "uppercase",
  },
  tableBody: {
    maxHeight: "400px",
    overflowY: "auto",
  },
  tableRow: {
    display: "flex",
    padding: "12px 16px",
    borderBottom: "1px solid #f3f4f6",
    fontSize: "14px",
    color: "#1f2937",
    alignItems: "center",
  },
  tableRowError: {
    background: "#fef2f2",
  },
  tableMore: {
    padding: "12px 16px",
    textAlign: "center",
    fontSize: "13px",
    color: "#6b7280",
    background: "#f9fafb",
  },
  statusBadge: {
    display: "inline-block",
    padding: "3px 10px",
    borderRadius: "12px",
    background: "#f3f4f6",
    fontSize: "12px",
    fontWeight: 500,
  },
  errorSummary: {
    background: "#fef2f2",
    borderRadius: "12px",
    padding: "16px 20px",
    marginBottom: "24px",
  },
  errorTitle: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#991b1b",
    margin: "0 0 12px",
  },
  errorList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  errorItem: {
    fontSize: "13px",
    color: "#7f1d1d",
  },
  errorRow: {
    fontWeight: 600,
    marginRight: "8px",
  },
  errorMore: {
    fontSize: "13px",
    color: "#991b1b",
    fontStyle: "italic",
  },
  previewActions: {
    display: "flex",
    justifyContent: "space-between",
    paddingTop: "24px",
    borderTop: "1px solid #e5e7eb",
  },
  importBtn: {
    padding: "14px 32px",
    borderRadius: "10px",
    border: "none",
    background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    color: "#fff",
    fontSize: "15px",
    fontWeight: 600,
    cursor: "pointer",
  },
  importingSection: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "80px 24px",
    textAlign: "center",
  },
  importingIcon: {
    fontSize: "48px",
    marginBottom: "24px",
  },
  importingTitle: {
    fontSize: "24px",
    fontWeight: 600,
    color: "#1f2937",
    margin: "0 0 8px",
  },
  importingText: {
    fontSize: "14px",
    color: "#6b7280",
    margin: "0 0 32px",
  },
  progressBar: {
    width: "300px",
    height: "8px",
    borderRadius: "4px",
    background: "#e5e7eb",
    overflow: "hidden",
    marginBottom: "12px",
  },
  progressFill: {
    height: "100%",
    borderRadius: "4px",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    transition: "width 0.3s",
  },
  progressText: {
    fontSize: "14px",
    color: "#6b7280",
  },
  completeSection: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "60px 24px",
    textAlign: "center",
  },
  completeIcon: {
    width: "80px",
    height: "80px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "36px",
    marginBottom: "24px",
  },
  completeTitle: {
    fontSize: "24px",
    fontWeight: 600,
    color: "#1f2937",
    margin: "0 0 8px",
  },
  completeText: {
    fontSize: "14px",
    color: "#6b7280",
    margin: "0 0 32px",
  },
  completeStats: {
    display: "flex",
    gap: "24px",
    marginBottom: "32px",
  },
  completeStatBox: {
    padding: "20px 40px",
    borderRadius: "16px",
    textAlign: "center",
  },
  completeStatValue: {
    display: "block",
    fontSize: "32px",
    fontWeight: 700,
    color: "#1f2937",
  },
  completeStatLabel: {
    fontSize: "14px",
    color: "#6b7280",
  },
  completeActions: {
    display: "flex",
    gap: "16px",
    marginTop: "24px",
  },
  newImportBtn: {
    padding: "12px 24px",
    borderRadius: "10px",
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#374151",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
  },
  viewLeadsBtn: {
    padding: "12px 24px",
    borderRadius: "10px",
    border: "none",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    textDecoration: "none",
  },
};

export default BulkImport;
