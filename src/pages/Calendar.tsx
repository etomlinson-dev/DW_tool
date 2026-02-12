import { useState, useEffect, useCallback } from "react";
import { calendarApi, type CalendarEvent as APICalendarEvent } from "../api/client";

interface CalendarEvent {
  id: number;
  title: string;
  type: "meeting" | "follow-up" | "email" | "call";
  date: Date;
  time: string;
  leadId?: number;
  leadName?: string;
  notes?: string;
}

// Map API event to UI format
const mapApiToEvent = (e: APICalendarEvent): CalendarEvent => {
  const startDate = e.start_time ? new Date(e.start_time) : new Date();
  return {
    id: e.id,
    title: e.title,
    type: (e.event_type as CalendarEvent["type"]) || "meeting",
    date: startDate,
    time: startDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
    leadId: e.lead_id,
    leadName: e.lead_name,
    notes: e.description,
  };
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [view, setView] = useState<"month" | "week" | "day">("month");
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch events from API
  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get events for the current month view
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const startOfMonth = new Date(year, month, 1).toISOString();
      const endOfMonth = new Date(year, month + 1, 0).toISOString();
      
      const data = await calendarApi.getEvents(startOfMonth, endOfMonth);
      setEvents(data.map(mapApiToEvent));
    } catch (err) {
      console.error("Failed to fetch calendar events:", err);
      setError("Failed to load events.");
    } finally {
      setLoading(false);
    }
  }, [currentDate]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Generate calendar days
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startingDayOfWeek = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();

  const calendarDays: (number | null)[] = [];

  // Add empty cells for days before the first day of the month
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(null);
  }

  // Add days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  const navigateMonth = (delta: number) => {
    setCurrentDate(new Date(year, month + delta, 1));
  };

  const isToday = (day: number): boolean => {
    const today = new Date();
    return (
      day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
    );
  };

  const isSelected = (day: number): boolean => {
    if (!selectedDate) return false;
    return (
      day === selectedDate.getDate() &&
      month === selectedDate.getMonth() &&
      year === selectedDate.getFullYear()
    );
  };

  const getEventsForDay = (day: number): CalendarEvent[] => {
    return events.filter((event) => {
      const eventDate = new Date(event.date);
      return (
        eventDate.getDate() === day &&
        eventDate.getMonth() === month &&
        eventDate.getFullYear() === year
      );
    });
  };

  const getSelectedDayEvents = (): CalendarEvent[] => {
    if (!selectedDate) return [];
    return events.filter((event) => {
      const eventDate = new Date(event.date);
      return (
        eventDate.getDate() === selectedDate.getDate() &&
        eventDate.getMonth() === selectedDate.getMonth() &&
        eventDate.getFullYear() === selectedDate.getFullYear()
      );
    });
  };

  const getEventTypeStyle = (type: CalendarEvent["type"]) => {
    switch (type) {
      case "meeting":
        return { background: "#667eea", color: "#fff" };
      case "call":
        return { background: "#10b981", color: "#fff" };
      case "email":
        return { background: "#f59e0b", color: "#fff" };
      case "follow-up":
        return { background: "#8b5cf6", color: "#fff" };
      default:
        return { background: "#6b7280", color: "#fff" };
    }
  };

  const getEventTypeIcon = (type: CalendarEvent["type"]) => {
    switch (type) {
      case "meeting":
        return "👥";
      case "call":
        return "📞";
      case "email":
        return "📧";
      case "follow-up":
        return "🔄";
      default:
        return "📌";
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Calendar</h1>
        <div style={styles.headerActions}>
          <div style={styles.viewToggle}>
            {(["month", "week", "day"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  ...styles.viewBtn,
                  ...(view === v ? styles.viewBtnActive : {}),
                }}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          <button style={styles.newEventBtn}>+ New Event</button>
        </div>
      </div>

      <div style={styles.content}>
        {/* Calendar Grid */}
        <div style={styles.calendarSection}>
          {/* Month Navigation */}
          <div style={styles.monthNav}>
            <button onClick={() => navigateMonth(-1)} style={styles.navBtn}>
              ←
            </button>
            <h2 style={styles.monthTitle}>
              {MONTHS[month]} {year}
            </h2>
            <button onClick={() => navigateMonth(1)} style={styles.navBtn}>
              →
            </button>
          </div>

          {/* Weekday Headers */}
          <div style={styles.weekdayHeader}>
            {WEEKDAYS.map((day) => (
              <div key={day} style={styles.weekdayCell}>
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div style={styles.calendarGrid}>
            {calendarDays.map((day, index) => {
              const dayEvents = day ? getEventsForDay(day) : [];
              return (
                <div
                  key={index}
                  onClick={() => day && setSelectedDate(new Date(year, month, day))}
                  style={{
                    ...styles.dayCell,
                    ...(day === null ? styles.dayCellEmpty : {}),
                    ...(day && isToday(day) ? styles.dayCellToday : {}),
                    ...(day && isSelected(day) ? styles.dayCellSelected : {}),
                  }}
                >
                  {day && (
                    <>
                      <span style={styles.dayNumber}>{day}</span>
                      <div style={styles.dayEvents}>
                        {dayEvents.slice(0, 2).map((event) => (
                          <div
                            key={event.id}
                            style={{
                              ...styles.eventDot,
                              ...getEventTypeStyle(event.type),
                            }}
                          >
                            {event.title.substring(0, 12)}...
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <span style={styles.moreEvents}>
                            +{dayEvents.length - 2} more
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar - Selected Day Details */}
        <div style={styles.sidebar}>
          <div style={styles.sidebarHeader}>
            <h3 style={styles.sidebarTitle}>
              {selectedDate
                ? selectedDate.toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })
                : "Select a date"}
            </h3>
          </div>

          <div style={styles.eventList}>
            {getSelectedDayEvents().length === 0 ? (
              <div style={styles.noEvents}>
                <p>No events scheduled</p>
                <button style={styles.addEventBtn}>+ Add Event</button>
              </div>
            ) : (
              getSelectedDayEvents().map((event) => (
                <div key={event.id} style={styles.eventCard}>
                  <div style={styles.eventHeader}>
                    <span
                      style={{
                        ...styles.eventType,
                        ...getEventTypeStyle(event.type),
                      }}
                    >
                      {getEventTypeIcon(event.type)} {event.type}
                    </span>
                    <span style={styles.eventTime}>{event.time}</span>
                  </div>
                  <h4 style={styles.eventTitle}>{event.title}</h4>
                  {event.leadName && (
                    <p style={styles.eventLead}>👤 {event.leadName}</p>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Upcoming Events */}
          <div style={styles.upcomingSection}>
            <h4 style={styles.upcomingTitle}>Upcoming This Week</h4>
            {events.slice(0, 5).map((event) => (
              <div key={event.id} style={styles.upcomingItem}>
                <span style={styles.upcomingIcon}>{getEventTypeIcon(event.type)}</span>
                <div style={styles.upcomingDetails}>
                  <span style={styles.upcomingName}>{event.title}</span>
                  <span style={styles.upcomingDate}>
                    {new Date(event.date).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    at {event.time}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
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
    alignItems: "center",
    marginBottom: "24px",
  },
  title: {
    fontSize: "28px",
    fontWeight: 700,
    color: "#1f2937",
    margin: 0,
  },
  headerActions: {
    display: "flex",
    gap: "16px",
    alignItems: "center",
  },
  viewToggle: {
    display: "flex",
    background: "#f3f4f6",
    borderRadius: "8px",
    padding: "4px",
  },
  viewBtn: {
    padding: "8px 16px",
    border: "none",
    background: "transparent",
    borderRadius: "6px",
    fontSize: "14px",
    color: "#6b7280",
    cursor: "pointer",
  },
  viewBtnActive: {
    background: "#fff",
    color: "#1f2937",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  newEventBtn: {
    padding: "10px 20px",
    borderRadius: "8px",
    border: "none",
    background: "#667eea",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
  },
  content: {
    display: "flex",
    gap: "24px",
  },
  calendarSection: {
    flex: 1,
    background: "#fff",
    borderRadius: "16px",
    padding: "24px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
  },
  monthNav: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "24px",
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
    fontSize: "12px",
    fontWeight: 600,
    color: "#9ca3af",
    textTransform: "uppercase" as const,
  },
  calendarGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: "4px",
  },
  dayCell: {
    minHeight: "100px",
    padding: "8px",
    background: "#f9fafb",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  dayCellEmpty: {
    background: "transparent",
    cursor: "default",
  },
  dayCellToday: {
    background: "#eef2ff",
    border: "2px solid #667eea",
  },
  dayCellSelected: {
    background: "#667eea",
    color: "#fff",
  },
  dayNumber: {
    fontSize: "14px",
    fontWeight: 500,
  },
  dayEvents: {
    marginTop: "4px",
  },
  eventDot: {
    fontSize: "10px",
    padding: "2px 4px",
    borderRadius: "4px",
    marginBottom: "2px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  moreEvents: {
    fontSize: "10px",
    color: "#6b7280",
  },
  sidebar: {
    width: "320px",
    background: "#fff",
    borderRadius: "16px",
    padding: "20px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
  },
  sidebarHeader: {
    marginBottom: "20px",
    paddingBottom: "16px",
    borderBottom: "1px solid #e5e7eb",
  },
  sidebarTitle: {
    fontSize: "16px",
    fontWeight: 600,
    color: "#1f2937",
    margin: 0,
  },
  eventList: {
    marginBottom: "24px",
  },
  noEvents: {
    textAlign: "center" as const,
    padding: "24px",
    color: "#9ca3af",
  },
  addEventBtn: {
    marginTop: "12px",
    padding: "8px 16px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#374151",
    fontSize: "13px",
    cursor: "pointer",
  },
  eventCard: {
    padding: "12px",
    background: "#f9fafb",
    borderRadius: "8px",
    marginBottom: "8px",
  },
  eventHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "8px",
  },
  eventType: {
    fontSize: "11px",
    padding: "2px 8px",
    borderRadius: "4px",
    textTransform: "capitalize" as const,
  },
  eventTime: {
    fontSize: "12px",
    color: "#6b7280",
  },
  eventTitle: {
    fontSize: "14px",
    fontWeight: 500,
    color: "#1f2937",
    margin: "0 0 4px",
  },
  eventLead: {
    fontSize: "12px",
    color: "#6b7280",
    margin: 0,
  },
  upcomingSection: {
    borderTop: "1px solid #e5e7eb",
    paddingTop: "16px",
  },
  upcomingTitle: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#1f2937",
    margin: "0 0 12px",
  },
  upcomingItem: {
    display: "flex",
    gap: "12px",
    padding: "8px 0",
    borderBottom: "1px solid #f3f4f6",
  },
  upcomingIcon: {
    fontSize: "16px",
  },
  upcomingDetails: {
    flex: 1,
  },
  upcomingName: {
    display: "block",
    fontSize: "13px",
    fontWeight: 500,
    color: "#374151",
  },
  upcomingDate: {
    fontSize: "11px",
    color: "#9ca3af",
  },
};

export default Calendar;
