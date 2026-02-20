import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { calendarApi, leadsApi, remindersApi, type CalendarEvent as APICalendarEvent, type Reminder as APIReminder } from "../api/client";

interface CalendarEvent {
  id: number;
  title: string;
  type: "meeting" | "follow-up" | "email" | "call";
  date: Date;
  time: string;
  endTime?: string;
  leadId?: number;
  leadName?: string;
  notes?: string;
  startIso: string;
  endIso?: string;
}

interface LeadOption {
  id: number;
  name: string;
}

interface CalendarReminder {
  id: number;
  title: string;
  priority: "High" | "Medium" | "Low";
  type: string;
  date: Date;
  dateStr: string;
  leadName: string;
  status: string;
}

const mapApiToReminder = (r: APIReminder): CalendarReminder => {
  const date = r.due_date ? new Date(r.due_date) : new Date();
  const dateStr = date.toISOString().split("T")[0];
  const priorityMap: Record<string, "High" | "Medium" | "Low"> = { high: "High", medium: "Medium", low: "Low" };
  let status = "Pending";
  if (r.completed_at) status = "Completed";
  else if (r.snoozed_until && new Date(r.snoozed_until) > new Date()) status = "Snoozed";
  else if (dateStr < new Date().toISOString().split("T")[0] && !r.completed_at) status = "Overdue";
  return {
    id: r.id,
    title: r.title,
    priority: priorityMap[r.priority?.toLowerCase() || "medium"] || "Medium",
    type: r.type || "other",
    date,
    dateStr,
    leadName: r.lead_name || "",
    status,
  };
};

const REMINDER_PRIORITY_COLORS: Record<string, { bg: string; color: string }> = {
  High: { bg: "#fee2e2", color: "#dc2626" },
  Medium: { bg: "#fef3c7", color: "#d97706" },
  Low: { bg: "#dcfce7", color: "#16a34a" },
};

interface EventForm {
  title: string;
  type: "meeting" | "follow-up" | "email" | "call";
  date: string;
  startTime: string;
  endTime: string;
  notes: string;
  leadId: string;
}

const EMPTY_FORM: EventForm = {
  title: "",
  type: "meeting",
  date: "",
  startTime: "09:00",
  endTime: "10:00",
  notes: "",
  leadId: "",
};

const mapApiToEvent = (e: APICalendarEvent): CalendarEvent => {
  const startDate = e.start_time ? new Date(e.start_time) : new Date();
  const endDate = e.end_time ? new Date(e.end_time) : undefined;
  return {
    id: e.id,
    title: e.title,
    type: (e.event_type as CalendarEvent["type"]) || "meeting",
    date: startDate,
    time: startDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
    endTime: endDate?.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
    leadId: e.lead_id,
    leadName: e.lead_name,
    notes: e.description,
    startIso: e.start_time,
    endIso: e.end_time,
  };
};

const toLocalDateString = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const EVENT_TYPE_STYLES: Record<CalendarEvent["type"], { bg: string; color: string; border: string }> = {
  meeting: { bg: "#667eea", color: "#fff", border: "#5a6fe0" },
  call: { bg: "#10b981", color: "#fff", border: "#0da877" },
  email: { bg: "#f59e0b", color: "#fff", border: "#e08e00" },
  "follow-up": { bg: "#8b5cf6", color: "#fff", border: "#7c4ee6" },
};

const EVENT_TYPE_ICONS: Record<CalendarEvent["type"], string> = {
  meeting: "👥",
  call: "📞",
  email: "📧",
  "follow-up": "🔄",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [reminders, setReminders] = useState<CalendarReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<LeadOption[]>([]);

  // Hover state for day cells
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  // Modal state
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [form, setForm] = useState<EventForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState("");

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const startOfMonth = new Date(year, month, 1).toISOString();
      const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
      const data = await calendarApi.getEvents(startOfMonth, endOfMonth);
      setEvents(data.map(mapApiToEvent));
    } catch (err) {
      console.error("Failed to fetch calendar events:", err);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const fetchReminders = useCallback(async () => {
    try {
      const data = await remindersApi.getReminders();
      setReminders(data.map(mapApiToReminder));
    } catch (err) {
      console.error("Failed to fetch reminders for calendar:", err);
    }
  }, []);

  useEffect(() => {
    fetchReminders();
    leadsApi.getLeads({ per_page: 200 }).then((res) => {
      setLeads(res.leads.map((l) => ({ id: l.id, name: l.name })));
    }).catch(() => {});
  }, [fetchReminders]);

  // Calendar grid calculations
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startingDayOfWeek = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();

  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < startingDayOfWeek; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  const isToday = (day: number) => {
    const today = new Date();
    return day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  };

  const getEventsForDay = (day: number) =>
    events.filter((e) => {
      const d = new Date(e.date);
      return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
    });

  const getSelectedDayEvents = () => {
    return events.filter((e) => {
      const d = new Date(e.date);
      return d.getDate() === selectedDate.getDate() &&
        d.getMonth() === selectedDate.getMonth() &&
        d.getFullYear() === selectedDate.getFullYear();
    });
  };

  const getRemindersForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return reminders.filter((r) => r.dateStr === dateStr);
  };

  const getSelectedDayReminders = () => {
    const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`;
    return reminders.filter((r) => r.dateStr === dateStr);
  };

  // Open create modal
  const openCreate = (date: Date) => {
    setForm({ ...EMPTY_FORM, date: toLocalDateString(date) });
    setEditingEvent(null);
    setFormError("");
    setModalMode("create");
  };

  // Open edit modal
  const openEdit = (event: CalendarEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    const d = new Date(event.date);
    const startH = String(d.getHours()).padStart(2, "0");
    const startM = String(d.getMinutes()).padStart(2, "0");
    let endH = "10", endM = "00";
    if (event.endIso) {
      const endD = new Date(event.endIso);
      endH = String(endD.getHours()).padStart(2, "0");
      endM = String(endD.getMinutes()).padStart(2, "0");
    }
    setForm({
      title: event.title,
      type: event.type,
      date: toLocalDateString(d),
      startTime: `${startH}:${startM}`,
      endTime: `${endH}:${endM}`,
      notes: event.notes || "",
      leadId: event.leadId ? String(event.leadId) : "",
    });
    setEditingEvent(event);
    setFormError("");
    setModalMode("edit");
  };

  const closeModal = () => {
    setModalMode(null);
    setEditingEvent(null);
    setFormError("");
  };

  const buildIso = (date: string, time: string): string => {
    return new Date(`${date}T${time}:00`).toISOString();
  };

  const handleSave = async () => {
    if (!form.title.trim()) { setFormError("Title is required."); return; }
    if (!form.date) { setFormError("Date is required."); return; }
    setSaving(true);
    setFormError("");
    try {
      const payload: Partial<APICalendarEvent> = {
        title: form.title.trim(),
        event_type: form.type,
        start_time: buildIso(form.date, form.startTime),
        end_time: form.endTime ? buildIso(form.date, form.endTime) : undefined,
        description: form.notes || undefined,
        lead_id: form.leadId ? Number(form.leadId) : undefined,
      };
      if (modalMode === "create") {
        await calendarApi.createEvent(payload);
      } else if (modalMode === "edit" && editingEvent) {
        await calendarApi.updateEvent(editingEvent.id, payload);
      }
      await Promise.all([fetchEvents(), fetchReminders()]);
      closeModal();
    } catch (err) {
      console.error("Failed to save event:", err);
      setFormError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingEvent) return;
    if (!confirm(`Delete "${editingEvent.title}"?`)) return;
    setDeleting(true);
    try {
      await calendarApi.deleteEvent(editingEvent.id);
      await Promise.all([fetchEvents(), fetchReminders()]);
      closeModal();
    } catch (err) {
      console.error("Failed to delete event:", err);
      setFormError("Failed to delete. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const upcomingEvents = [...events]
    .filter((e) => new Date(e.date) >= new Date(new Date().setHours(0,0,0,0)))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 6);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Calendar</h1>
          <p style={styles.subtitle}>Click any date to add an event</p>
        </div>
        <button style={styles.newEventBtn} onClick={() => openCreate(selectedDate)}>
          + New Event
        </button>
      </div>

      <div style={styles.content}>
        {/* Calendar Grid */}
        <div style={styles.calendarSection}>
          <div style={styles.monthNav}>
            <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} style={styles.navBtn}>←</button>
            <h2 style={styles.monthTitle}>{MONTHS[month]} {year}</h2>
            <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} style={styles.navBtn}>→</button>
          </div>

          <div style={styles.weekdayHeader}>
            {WEEKDAYS.map((d) => (
              <div key={d} style={styles.weekdayCell}>{d}</div>
            ))}
          </div>

          {loading ? (
            <div style={styles.loadingState}>Loading events...</div>
          ) : (
            <div style={styles.calendarGrid}>
              {calendarDays.map((day, index) => {
                const dayEvents = day ? getEventsForDay(day) : [];
                const dayReminders = day ? getRemindersForDay(day) : [];
                const today = day ? isToday(day) : false;
                const hovered = day !== null && hoveredDay === day;
                return (
                  <div
                    key={index}
                    onClick={() => {
                      if (!day) return;
                      const clicked = new Date(year, month, day);
                      setSelectedDate(clicked);
                      openCreate(clicked);
                    }}
                    onMouseEnter={() => day && setHoveredDay(day)}
                    onMouseLeave={() => setHoveredDay(null)}
                    style={{
                      ...styles.dayCell,
                      ...(day === null ? styles.dayCellEmpty : {}),
                      ...(today ? styles.dayCellToday : {}),
                      ...(hovered ? styles.dayCellHover : {}),
                    }}
                  >
                    {day && (
                      <>
                        <span style={{
                          ...styles.dayNumber,
                          ...(today ? { color: "#667eea" } : {}),
                        }}>
                          {day}
                        </span>
                        <div style={styles.dayEvents}>
                          {dayEvents.slice(0, 2).map((event) => {
                            const style = EVENT_TYPE_STYLES[event.type];
                            return (
                              <div
                                key={`evt-${event.id}`}
                                onClick={(e) => openEdit(event, e)}
                                style={{
                                  ...styles.eventPill,
                                  background: style.bg,
                                  color: style.color,
                                }}
                                title={`${event.title} — ${event.time}`}
                              >
                                {EVENT_TYPE_ICONS[event.type]} {event.title.length > 11 ? event.title.substring(0, 11) + "…" : event.title}
                              </div>
                            );
                          })}
                          {dayReminders.slice(0, 2).map((r) => {
                            const pc = REMINDER_PRIORITY_COLORS[r.priority];
                            return (
                              <div
                                key={`rem-${r.id}`}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  ...styles.reminderPill,
                                  background: pc.bg,
                                  color: pc.color,
                                  opacity: r.status === "Completed" ? 0.5 : 1,
                                }}
                                title={`🔔 ${r.title}${r.leadName ? ` — ${r.leadName}` : ""}`}
                              >
                                🔔 {r.title.length > 10 ? r.title.substring(0, 10) + "…" : r.title}
                              </div>
                            );
                          })}
                          {(dayEvents.length + dayReminders.length) > 4 && (
                            <span style={styles.moreEvents}>+{dayEvents.length + dayReminders.length - 4} more</span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div style={styles.sidebar}>
          <div style={styles.sidebarHeader}>
            <h3 style={styles.sidebarTitle}>
              {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </h3>
            <button
              style={styles.addEventBtnHeader}
              onClick={() => openCreate(selectedDate)}
            >
              + Add
            </button>
          </div>

          <div style={styles.eventList}>
            {getSelectedDayEvents().length === 0 && getSelectedDayReminders().length === 0 ? (
              <div style={styles.noEvents}>
                <div style={styles.noEventsIcon}>📅</div>
                <p style={styles.noEventsText}>No events or reminders</p>
                <button style={styles.addEventBtn} onClick={() => openCreate(selectedDate)}>
                  + Add Event
                </button>
              </div>
            ) : (
              <>
                {getSelectedDayEvents()
                  .sort((a, b) => new Date(a.startIso).getTime() - new Date(b.startIso).getTime())
                  .map((event) => {
                    const style = EVENT_TYPE_STYLES[event.type];
                    return (
                      <div
                        key={`evt-${event.id}`}
                        style={styles.eventCard}
                        onClick={(e) => openEdit(event, e)}
                      >
                        <div style={{ ...styles.eventAccent, background: style.bg }} />
                        <div style={styles.eventCardBody}>
                          <div style={styles.eventCardHeader}>
                            <span style={{ ...styles.eventTypeBadge, background: style.bg + "22", color: style.bg }}>
                              {EVENT_TYPE_ICONS[event.type]} {event.type}
                            </span>
                            <span style={styles.eventTime}>{event.time}</span>
                          </div>
                          <h4 style={styles.eventTitle}>{event.title}</h4>
                          {event.leadName && <p style={styles.eventLead}>👤 {event.leadName}</p>}
                          {event.notes && <p style={styles.eventNotes}>{event.notes}</p>}
                        </div>
                      </div>
                    );
                  })}
                {getSelectedDayReminders().map((r) => {
                  const pc = REMINDER_PRIORITY_COLORS[r.priority];
                  return (
                    <div key={`rem-${r.id}`} style={styles.eventCard}>
                      <div style={{ ...styles.eventAccent, background: pc.color }} />
                      <div style={styles.eventCardBody}>
                        <div style={styles.eventCardHeader}>
                          <span style={{ ...styles.eventTypeBadge, background: pc.bg, color: pc.color }}>
                            🔔 Reminder
                          </span>
                          <span style={{ ...styles.eventTime, color: pc.color, fontWeight: 600 }}>{r.priority}</span>
                        </div>
                        <h4 style={{ ...styles.eventTitle, opacity: r.status === "Completed" ? 0.5 : 1, textDecoration: r.status === "Completed" ? "line-through" : "none" }}>
                          {r.title}
                        </h4>
                        {r.leadName && <p style={styles.eventLead}>👤 {r.leadName}</p>}
                        {r.status === "Completed" && <p style={{ ...styles.eventNotes, color: "#16a34a" }}>✓ Completed</p>}
                        {r.status === "Overdue" && <p style={{ ...styles.eventNotes, color: "#dc2626" }}>⚠ Overdue</p>}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>

          <div style={styles.upcomingSection}>
            <h4 style={styles.upcomingTitle}>Upcoming Events</h4>
            {upcomingEvents.length === 0 ? (
              <p style={{ fontSize: "13px", color: "#9ca3af" }}>No upcoming events</p>
            ) : (
              upcomingEvents.map((event) => {
                const style = EVENT_TYPE_STYLES[event.type];
                return (
                  <div
                    key={event.id}
                    style={styles.upcomingItem}
                    onClick={(e) => {
                      setSelectedDate(new Date(event.date));
                      openEdit(event, e);
                    }}
                  >
                    <span style={{ ...styles.upcomingDot, background: style.bg }} />
                    <div style={styles.upcomingDetails}>
                      <span style={styles.upcomingName}>{event.title}</span>
                      <span style={styles.upcomingDate}>
                        {new Date(event.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · {event.time}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Create / Edit Modal */}
      <AnimatePresence>
        {modalMode && (
          <motion.div
            style={styles.modalOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeModal}
          >
            <motion.div
              style={styles.modal}
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div style={styles.modalHeader}>
                <h3 style={styles.modalTitle}>
                  {modalMode === "create" ? "New Event" : "Edit Event"}
                </h3>
                <button style={styles.modalCloseBtn} onClick={closeModal}>✕</button>
              </div>

              {/* Modal Body */}
              <div style={styles.modalBody}>
                {formError && <div style={styles.errorBanner}>{formError}</div>}

                <div style={styles.formGroup}>
                  <label style={styles.label}>Title <span style={{ color: "#ef4444" }}>*</span></label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. Discovery Call with Acme Corp"
                    style={styles.input}
                    autoFocus
                  />
                </div>

                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Event Type</label>
                    <select
                      value={form.type}
                      onChange={(e) => setForm({ ...form, type: e.target.value as EventForm["type"] })}
                      style={styles.select}
                    >
                      <option value="meeting">👥 Meeting</option>
                      <option value="call">📞 Call</option>
                      <option value="email">📧 Email</option>
                      <option value="follow-up">🔄 Follow-up</option>
                    </select>
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Date <span style={{ color: "#ef4444" }}>*</span></label>
                    <input
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                      style={styles.input}
                    />
                  </div>
                </div>

                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Start Time</label>
                    <input
                      type="time"
                      value={form.startTime}
                      onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                      style={styles.input}
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>End Time</label>
                    <input
                      type="time"
                      value={form.endTime}
                      onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                      style={styles.input}
                    />
                  </div>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Associated Lead (optional)</label>
                  <select
                    value={form.leadId}
                    onChange={(e) => setForm({ ...form, leadId: e.target.value })}
                    style={styles.select}
                  >
                    <option value="">— No lead —</option>
                    {leads.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Any additional notes..."
                    style={styles.textarea}
                    rows={3}
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div style={styles.modalFooter}>
                {modalMode === "edit" && (
                  <button
                    style={styles.deleteBtn}
                    onClick={handleDelete}
                    disabled={deleting || saving}
                  >
                    {deleting ? "Deleting…" : "Delete"}
                  </button>
                )}
                <div style={{ flex: 1 }} />
                <button style={styles.cancelBtn} onClick={closeModal} disabled={saving}>
                  Cancel
                </button>
                <button
                  style={{ ...styles.saveBtn, opacity: saving ? 0.7 : 1 }}
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? "Saving…" : modalMode === "create" ? "Create Event" : "Save Changes"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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
    marginBottom: "24px",
  },
  title: {
    fontSize: "28px",
    fontWeight: 700,
    color: "var(--text-color, #1f2937)",
    margin: 0,
  },
  subtitle: {
    fontSize: "13px",
    color: "#9ca3af",
    margin: "4px 0 0",
  },
  newEventBtn: {
    padding: "10px 20px",
    borderRadius: "8px",
    border: "none",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  },
  content: {
    display: "flex",
    gap: "24px",
    alignItems: "flex-start",
  },
  calendarSection: {
    flex: 1,
    background: "#fff",
    borderRadius: "16px",
    padding: "24px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  },
  monthNav: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
  },
  navBtn: {
    width: "40px",
    height: "40px",
    border: "1px solid #e5e7eb",
    background: "#fff",
    borderRadius: "8px",
    fontSize: "18px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  monthTitle: {
    fontSize: "20px",
    fontWeight: 600,
    color: "#1f2937",
    margin: 0,
  },
  weekdayHeader: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    marginBottom: "8px",
  },
  weekdayCell: {
    textAlign: "center" as const,
    padding: "8px",
    fontSize: "11px",
    fontWeight: 700,
    color: "#9ca3af",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  },
  calendarGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: "4px",
  },
  dayCell: {
    minHeight: "110px",
    padding: "8px",
    background: "#f3f4f6",
    borderRadius: "10px",
    cursor: "pointer",
    transition: "background 0.15s, box-shadow 0.15s, transform 0.15s, border 0.15s",
    position: "relative" as const,
    border: "1.5px solid transparent",
  },
  dayCellEmpty: {
    background: "transparent",
    cursor: "default",
    pointerEvents: "none" as const,
  },
  dayCellToday: {
    background: "#eef2ff",
    border: "2px solid #667eea",
  },
  dayCellHover: {
    background: "#dde3ff",
    boxShadow: "0 4px 12px rgba(102, 126, 234, 0.3)",
    transform: "translateY(-2px)",
    border: "1.5px solid #667eea",
  },
  dayNumber: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#374151",
    display: "block",
    marginBottom: "4px",
  },
  dayEvents: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "2px",
  },
  eventPill: {
    fontSize: "10px",
    padding: "2px 5px",
    borderRadius: "4px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
    cursor: "pointer",
    fontWeight: 500,
  },
  reminderPill: {
    fontSize: "10px",
    padding: "2px 5px",
    borderRadius: "4px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
    cursor: "default",
    fontWeight: 500,
    border: "1px dashed currentColor",
  },
  moreEvents: {
    fontSize: "10px",
    color: "#9ca3af",
    paddingLeft: "2px",
  },
  loadingState: {
    textAlign: "center" as const,
    padding: "48px",
    color: "#9ca3af",
    fontSize: "14px",
  },
  sidebar: {
    width: "300px",
    flexShrink: 0,
    background: "#fff",
    borderRadius: "16px",
    padding: "20px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    maxHeight: "calc(100vh - 140px)",
    overflowY: "auto" as const,
  },
  sidebarHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
    paddingBottom: "16px",
    borderBottom: "1px solid #e5e7eb",
  },
  sidebarTitle: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#1f2937",
    margin: 0,
    lineHeight: "1.3",
  },
  addEventBtnHeader: {
    padding: "5px 10px",
    borderRadius: "6px",
    border: "none",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "#fff",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
    flexShrink: 0,
    marginLeft: "8px",
  },
  eventList: {
    marginBottom: "20px",
  },
  noEvents: {
    textAlign: "center" as const,
    padding: "28px 16px",
    color: "#9ca3af",
  },
  noEventsIcon: {
    fontSize: "32px",
    marginBottom: "8px",
  },
  noEventsText: {
    margin: "0 0 12px",
    fontSize: "13px",
  },
  addEventBtn: {
    padding: "8px 16px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#374151",
    fontSize: "13px",
    cursor: "pointer",
  },
  eventCard: {
    display: "flex",
    borderRadius: "10px",
    overflow: "hidden",
    marginBottom: "8px",
    border: "1px solid #e5e7eb",
    cursor: "pointer",
    transition: "box-shadow 0.15s",
  },
  eventAccent: {
    width: "4px",
    flexShrink: 0,
  },
  eventCardBody: {
    flex: 1,
    padding: "10px 12px",
  },
  eventCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "6px",
  },
  eventTypeBadge: {
    fontSize: "10px",
    padding: "2px 7px",
    borderRadius: "4px",
    fontWeight: 600,
    textTransform: "capitalize" as const,
  },
  eventTime: {
    fontSize: "11px",
    color: "#6b7280",
  },
  eventTitle: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#1f2937",
    margin: "0 0 4px",
  },
  eventLead: {
    fontSize: "11px",
    color: "#6b7280",
    margin: "0 0 2px",
  },
  eventNotes: {
    fontSize: "11px",
    color: "#9ca3af",
    margin: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  upcomingSection: {
    borderTop: "1px solid #e5e7eb",
    paddingTop: "16px",
  },
  upcomingTitle: {
    fontSize: "13px",
    fontWeight: 700,
    color: "#374151",
    margin: "0 0 10px",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  },
  upcomingItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    padding: "8px 0",
    borderBottom: "1px solid #f3f4f6",
    cursor: "pointer",
  },
  upcomingDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    flexShrink: 0,
    marginTop: "4px",
  },
  upcomingDetails: {
    flex: 1,
    overflow: "hidden",
  },
  upcomingName: {
    display: "block",
    fontSize: "12px",
    fontWeight: 500,
    color: "#374151",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  upcomingDate: {
    display: "block",
    fontSize: "11px",
    color: "#9ca3af",
  },
  // Modal
  modalOverlay: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: "24px",
  },
  modal: {
    background: "#fff",
    borderRadius: "16px",
    width: "100%",
    maxWidth: "520px",
    boxShadow: "0 24px 64px rgba(0,0,0,0.2)",
    overflow: "hidden",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 24px",
    borderBottom: "1px solid #f3f4f6",
  },
  modalTitle: {
    fontSize: "18px",
    fontWeight: 700,
    color: "#1f2937",
    margin: 0,
  },
  modalCloseBtn: {
    width: "32px",
    height: "32px",
    borderRadius: "8px",
    border: "none",
    background: "#f3f4f6",
    color: "#6b7280",
    fontSize: "16px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  modalBody: {
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "16px",
    maxHeight: "65vh",
    overflowY: "auto" as const,
  },
  modalFooter: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "16px 24px",
    borderTop: "1px solid #f3f4f6",
    background: "#f9fafb",
  },
  errorBanner: {
    padding: "10px 14px",
    borderRadius: "8px",
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#dc2626",
    fontSize: "13px",
  },
  formGroup: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "6px",
    flex: 1,
  },
  formRow: {
    display: "flex",
    gap: "12px",
  },
  label: {
    fontSize: "12px",
    fontWeight: 600,
    color: "#374151",
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
  },
  input: {
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    fontSize: "14px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box" as const,
  },
  select: {
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    fontSize: "14px",
    background: "#fff",
    width: "100%",
    boxSizing: "border-box" as const,
  },
  textarea: {
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    fontSize: "14px",
    resize: "vertical" as const,
    fontFamily: "inherit",
    width: "100%",
    boxSizing: "border-box" as const,
  },
  deleteBtn: {
    padding: "10px 18px",
    borderRadius: "8px",
    border: "none",
    background: "#fee2e2",
    color: "#dc2626",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  },
  cancelBtn: {
    padding: "10px 18px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#374151",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
  },
  saveBtn: {
    padding: "10px 20px",
    borderRadius: "8px",
    border: "none",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  },
};

export default Calendar;
