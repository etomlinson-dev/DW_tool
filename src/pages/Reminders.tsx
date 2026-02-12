import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { remindersApi, teamApi, type Reminder as APIReminder } from "../api/client";

// Reminder types for UI (mapped from API)
interface Reminder {
  id: number;
  leadId: number;
  leadName: string;
  title: string;
  description: string;
  dueDate: string;
  dueTime: string;
  priority: "High" | "Medium" | "Low";
  type: "Follow-up" | "Call Back" | "Send Email" | "Meeting Prep" | "Proposal" | "Other";
  assignedTo: string;
  status: "Pending" | "Completed" | "Snoozed" | "Overdue";
  createdAt: string;
}

// Map API reminder to UI reminder format
const mapApiToReminder = (r: APIReminder): Reminder => {
  const dueDateTime = r.due_date ? new Date(r.due_date) : new Date();
  const today = new Date().toISOString().split("T")[0];
  const dueDateStr = r.due_date ? r.due_date.split("T")[0] : today;
  
  // Determine status
  let status: Reminder["status"] = "Pending";
  if (r.completed_at) {
    status = "Completed";
  } else if (r.snoozed_until && new Date(r.snoozed_until) > new Date()) {
    status = "Snoozed";
  } else if (dueDateStr < today && !r.completed_at) {
    status = "Overdue";
  }

  // Map type
  const typeMap: Record<string, Reminder["type"]> = {
    "follow-up": "Follow-up",
    "callback": "Call Back",
    "send-email": "Send Email",
    "meeting-prep": "Meeting Prep",
    "proposal": "Proposal",
    "other": "Other",
  };

  // Map priority
  const priorityMap: Record<string, Reminder["priority"]> = {
    "high": "High",
    "medium": "Medium",
    "low": "Low",
  };

  return {
    id: r.id,
    leadId: r.lead_id || 0,
    leadName: r.lead_name || "Unknown",
    title: r.title || "",
    description: r.description || "",
    dueDate: dueDateStr,
    dueTime: dueDateTime.toTimeString().substring(0, 5),
    priority: priorityMap[r.priority?.toLowerCase() || "medium"] || "Medium",
    type: typeMap[r.type?.toLowerCase() || "other"] || "Other",
    assignedTo: r.assigned_to || "",
    status,
    createdAt: r.created_at?.split("T")[0] || today,
  };
};

const PRIORITY_OPTIONS = ["All", "High", "Medium", "Low"];
const TYPE_OPTIONS = ["All", "Follow-up", "Call Back", "Send Email", "Meeting Prep", "Proposal", "Other"];
const STATUS_OPTIONS = ["All", "Pending", "Overdue", "Completed", "Snoozed"];

export function Reminders() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<string[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // New reminder form
  const [newReminder, setNewReminder] = useState({
    leadName: "",
    title: "",
    description: "",
    dueDate: new Date().toISOString().split("T")[0],
    dueTime: "09:00",
    priority: "Medium" as "High" | "Medium" | "Low",
    type: "Follow-up" as Reminder["type"],
    assignedTo: "",
  });

  // Fetch reminders from API
  const fetchReminders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await remindersApi.getReminders();
      setReminders(data.map(mapApiToReminder));
    } catch (err) {
      console.error("Failed to fetch reminders:", err);
      setError("Failed to load reminders. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch team members for assignment dropdown
  const fetchTeamMembers = useCallback(async () => {
    try {
      const team = await teamApi.getTeam();
      setTeamMembers(team.map(m => m.name));
      if (team.length > 0) {
        setNewReminder(prev => ({ ...prev, assignedTo: team[0].name }));
      }
    } catch (err) {
      console.error("Failed to fetch team members:", err);
      // Fallback to empty array
    }
  }, []);

  useEffect(() => {
    fetchReminders();
    fetchTeamMembers();
  }, [fetchReminders, fetchTeamMembers]);

  // Get unique reps from reminders (fallback) + team members
  const reps = [...new Set([...reminders.map((r) => r.assignedTo), ...teamMembers].filter(Boolean))];

  // Filtered reminders
  const filteredReminders = reminders.filter((reminder) => {
    const matchesSearch =
      reminder.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reminder.leadName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reminder.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPriority = priorityFilter === "All" || reminder.priority === priorityFilter;
    const matchesType = typeFilter === "All" || reminder.type === typeFilter;
    const matchesStatus = statusFilter === "All" || reminder.status === statusFilter;
    return matchesSearch && matchesPriority && matchesType && matchesStatus;
  });

  // Group by date
  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const overdueReminders = filteredReminders.filter((r) => r.status === "Overdue" || (r.status === "Pending" && r.dueDate < today));
  const todayReminders = filteredReminders.filter((r) => r.dueDate === today && r.status !== "Overdue");
  const tomorrowReminders = filteredReminders.filter((r) => r.dueDate === tomorrow);
  const upcomingReminders = filteredReminders.filter((r) => r.dueDate > tomorrow);

  // Stats
  const stats = {
    total: reminders.filter((r) => r.status === "Pending" || r.status === "Overdue").length,
    overdue: reminders.filter((r) => r.status === "Overdue" || (r.status === "Pending" && r.dueDate < today)).length,
    today: reminders.filter((r) => r.dueDate === today && r.status === "Pending").length,
    highPriority: reminders.filter((r) => r.priority === "High" && r.status === "Pending").length,
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "High": return { bg: "#fee2e2", color: "#dc2626", border: "#fecaca" };
      case "Medium": return { bg: "#fef3c7", color: "#d97706", border: "#fde68a" };
      case "Low": return { bg: "#dcfce7", color: "#16a34a", border: "#bbf7d0" };
      default: return { bg: "#f3f4f6", color: "#6b7280", border: "#e5e7eb" };
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "Follow-up": return "🔄";
      case "Call Back": return "📞";
      case "Send Email": return "✉️";
      case "Meeting Prep": return "📋";
      case "Proposal": return "📄";
      default: return "📌";
    }
  };

  const handleComplete = async (id: number) => {
    try {
      await remindersApi.completeReminder(id);
      setReminders(reminders.map((r) =>
        r.id === id ? { ...r, status: "Completed" as const } : r
      ));
    } catch (err) {
      console.error("Failed to complete reminder:", err);
    }
  };

  const handleSnooze = async (id: number) => {
    try {
      await remindersApi.snoozeReminder(id, 24); // Snooze for 24 hours
      setReminders(reminders.map((r) =>
        r.id === id
          ? {
              ...r,
              status: "Snoozed" as const,
              dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0],
            }
          : r
      ));
    } catch (err) {
      console.error("Failed to snooze reminder:", err);
    }
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  // Calendar helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    return { daysInMonth, startingDay };
  };

  const getRemindersForDate = (date: string) => {
    return filteredReminders.filter((r) => r.dueDate === date);
  };

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  // Handle clicking on a calendar day to add a reminder
  const handleCalendarDayClick = (dateStr: string) => {
    setEditingReminder(null);
    setNewReminder({
      ...newReminder,
      dueDate: dateStr,
      title: "",
      description: "",
      leadName: "",
    });
    setShowAddModal(true);
  };

  // Handle clicking on a reminder in the calendar to edit it
  const handleReminderClick = (reminder: Reminder, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent day click
    setEditingReminder(reminder);
    setNewReminder({
      leadName: reminder.leadName,
      title: reminder.title,
      description: reminder.description,
      dueDate: reminder.dueDate,
      dueTime: reminder.dueTime,
      priority: reminder.priority,
      type: reminder.type,
      assignedTo: reminder.assignedTo,
    });
    setShowAddModal(true);
  };

  // Handle saving (create or update)
  const handleSaveReminder = async () => {
    if (!newReminder.title.trim()) {
      alert("Please fill in the title");
      return;
    }

    try {
      // Map type to API format
      const typeMap: Record<string, string> = {
        "Follow-up": "follow-up",
        "Call Back": "callback",
        "Send Email": "send-email",
        "Meeting Prep": "meeting-prep",
        "Proposal": "proposal",
        "Other": "other",
      };

      const dueDateTime = `${newReminder.dueDate}T${newReminder.dueTime}:00`;
      
      if (editingReminder) {
        // Update existing reminder
        const updated = await remindersApi.updateReminder(editingReminder.id, {
          title: newReminder.title,
          description: newReminder.description,
          due_date: dueDateTime,
          priority: newReminder.priority.toLowerCase(),
          type: typeMap[newReminder.type] || "other",
          assigned_to: newReminder.assignedTo,
        });

        const mappedReminder = mapApiToReminder(updated);
        mappedReminder.leadName = newReminder.leadName || editingReminder.leadName;
        
        setReminders(reminders.map(r => r.id === editingReminder.id ? mappedReminder : r));
      } else {
        // Create new reminder
        const created = await remindersApi.createReminder({
          title: newReminder.title,
          description: newReminder.description,
          due_date: dueDateTime,
          priority: newReminder.priority.toLowerCase(),
          type: typeMap[newReminder.type] || "other",
          assigned_to: newReminder.assignedTo,
        });

        const reminder = mapApiToReminder(created);
        reminder.leadName = newReminder.leadName || "No Lead";
        
        setReminders([reminder, ...reminders]);
      }
      
      setShowAddModal(false);
      setEditingReminder(null);
      setNewReminder({
        leadName: "",
        title: "",
        description: "",
        dueDate: new Date().toISOString().split("T")[0],
        dueTime: "09:00",
        priority: "Medium",
        type: "Follow-up",
        assignedTo: reps[0] || "",
      });
    } catch (err) {
      console.error("Failed to save reminder:", err);
      alert("Failed to save reminder. Please try again.");
    }
  };

  // Handle deleting a reminder
  const handleDeleteReminder = async () => {
    if (!editingReminder) return;
    
    if (!confirm("Are you sure you want to delete this reminder?")) return;
    
    try {
      await remindersApi.deleteReminder(editingReminder.id);
      setReminders(reminders.filter(r => r.id !== editingReminder.id));
      setShowAddModal(false);
      setEditingReminder(null);
    } catch (err) {
      console.error("Failed to delete reminder:", err);
      alert("Failed to delete reminder. Please try again.");
    }
  };

  const handleAddReminder = async () => {
    if (!newReminder.title.trim()) {
      alert("Please fill in the title");
      return;
    }

    try {
      // Map type to API format
      const typeMap: Record<string, string> = {
        "Follow-up": "follow-up",
        "Call Back": "callback",
        "Send Email": "send-email",
        "Meeting Prep": "meeting-prep",
        "Proposal": "proposal",
        "Other": "other",
      };

      const dueDateTime = `${newReminder.dueDate}T${newReminder.dueTime}:00`;
      
      const created = await remindersApi.createReminder({
        title: newReminder.title,
        description: newReminder.description,
        due_date: dueDateTime,
        priority: newReminder.priority.toLowerCase(),
        type: typeMap[newReminder.type] || "other",
        assigned_to: newReminder.assignedTo,
      });

      // Map and add to local state
      const reminder = mapApiToReminder(created);
      // Override lead name since we don't have lead_id
      reminder.leadName = newReminder.leadName || "No Lead";
      
      setReminders([reminder, ...reminders]);
      setShowAddModal(false);
      setNewReminder({
        leadName: "",
        title: "",
        description: "",
        dueDate: new Date().toISOString().split("T")[0],
        dueTime: "09:00",
        priority: "Medium",
        type: "Follow-up",
        assignedTo: reps[0] || "",
      });
    } catch (err) {
      console.error("Failed to create reminder:", err);
      alert("Failed to create reminder. Please try again.");
    }
  };

  // Calendar View Component
  const CalendarView = () => {
    const { daysInMonth, startingDay } = getDaysInMonth(currentMonth);
    const days = [];
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    // Empty cells for days before the first of the month
    for (let i = 0; i < startingDay; i++) {
      days.push(<div key={`empty-${i}`} style={styles.calendarDay}></div>);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dayReminders = getRemindersForDate(dateStr);
      const isToday = dateStr === today;

      days.push(
        <motion.div
          key={day}
          onClick={() => handleCalendarDayClick(dateStr)}
          style={{
            ...styles.calendarDay,
            ...styles.calendarDayClickable,
            ...(isToday ? styles.calendarDayToday : {}),
          }}
          whileHover={{ scale: 1.02, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
        >
          <span style={{
            ...styles.dayNumber,
            ...(isToday ? styles.dayNumberToday : {}),
          }}>{day}</span>
          <div style={styles.dayReminders}>
            {dayReminders.slice(0, 3).map((r) => (
              <motion.div
                key={r.id}
                onClick={(e) => handleReminderClick(r, e)}
                style={{
                  ...styles.calendarReminder,
                  ...(r.status === "Completed" 
                    ? styles.calendarReminderCompleted 
                    : { background: getPriorityColor(r.priority).bg, color: getPriorityColor(r.priority).color }
                  ),
                }}
                title={`Click to edit: ${r.title} - ${r.leadName}${r.status === "Completed" ? " (Completed)" : ""}`}
                whileHover={{ scale: 1.05 }}
              >
                {r.status === "Completed" ? "✓" : getTypeIcon(r.type)} {r.title.length > 10 ? r.title.substring(0, 10) + "..." : r.title}
              </motion.div>
            ))}
            {dayReminders.length > 3 && (
              <span style={styles.moreReminders}>+{dayReminders.length - 3} more</span>
            )}
          </div>
        </motion.div>
      );
    }

    return (
      <div style={styles.calendarContainer}>
        <div style={styles.calendarHeader}>
          <button onClick={handlePrevMonth} style={styles.calendarNavBtn}>←</button>
          <span style={styles.calendarMonth}>{formatMonthYear(currentMonth)}</span>
          <button onClick={handleNextMonth} style={styles.calendarNavBtn}>→</button>
        </div>
        <div style={styles.calendarWeekdays}>
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} style={styles.weekday}>{day}</div>
          ))}
        </div>
        <div style={styles.calendarGrid}>{days}</div>
        <div style={styles.calendarHint}>
          💡 Click on any day to add a reminder, or click an existing reminder to edit it
        </div>
      </div>
    );
  };

  const ReminderCard = ({ reminder }: { reminder: Reminder }) => (
    <motion.div 
      style={{
        ...styles.reminderCard,
        borderLeft: `4px solid ${getPriorityColor(reminder.priority).border}`,
        opacity: reminder.status === "Completed" ? 0.6 : 1,
      }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01, boxShadow: "0 4px 20px rgba(0, 0, 0, 0.08)" }}
    >
      <div style={styles.cardHeader}>
        <div style={styles.cardLeft}>
          <span style={styles.typeIcon}>{getTypeIcon(reminder.type)}</span>
          <div>
            <span style={styles.reminderTitle}>{reminder.title}</span>
            <Link to={`/lead/${reminder.leadId}`} style={styles.leadLink}>
              {reminder.leadName}
            </Link>
          </div>
        </div>
        <div style={styles.cardRight}>
          <span style={{
            ...styles.priorityBadge,
            background: getPriorityColor(reminder.priority).bg,
            color: getPriorityColor(reminder.priority).color,
          }}>
            {reminder.priority}
          </span>
          <span style={styles.dueTime}>{formatTime(reminder.dueTime)}</span>
        </div>
      </div>
      
      <p style={styles.description}>{reminder.description}</p>
      
      <div style={styles.cardFooter}>
        <div style={styles.footerLeft}>
          <span style={styles.assignee}>👤 {reminder.assignedTo}</span>
          <span style={styles.typeBadge}>{reminder.type}</span>
        </div>
        <div style={styles.cardActions}>
          {reminder.status !== "Completed" && (
            <>
              <motion.button 
                onClick={() => handleSnooze(reminder.id)} 
                style={styles.snoozeBtn}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                ⏰ Snooze
              </motion.button>
              <motion.button 
                onClick={() => handleComplete(reminder.id)} 
                style={styles.completeBtn}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                ✓ Complete
              </motion.button>
            </>
          )}
          {reminder.status === "Completed" && (
            <span style={styles.completedBadge}>✓ Completed</span>
          )}
        </div>
      </div>
    </motion.div>
  );

  // Loading state
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingState}>
          <span style={styles.loadingSpinner}>⏳</span>
          <p>Loading reminders...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.errorState}>
          <span style={styles.errorIcon}>⚠️</span>
          <p>{error}</p>
          <button onClick={fetchReminders} style={styles.retryBtn}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      style={styles.container}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <motion.div 
        style={styles.header}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div>
          <h1 style={styles.title}>Reminders</h1>
          <p style={styles.subtitle}>Manage your follow-ups and scheduled tasks</p>
        </div>
        <div style={styles.headerActions}>
          <div style={styles.viewToggle}>
            <motion.button
              onClick={() => setViewMode("list")}
              style={{
                ...styles.viewBtn,
                ...(viewMode === "list" ? styles.viewBtnActive : {}),
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              📋 List
            </motion.button>
            <motion.button
              onClick={() => setViewMode("calendar")}
              style={{
                ...styles.viewBtn,
                ...(viewMode === "calendar" ? styles.viewBtnActive : {}),
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              📅 Calendar
            </motion.button>
          </div>
          <motion.button 
            onClick={() => setShowAddModal(true)} 
            style={styles.primaryBtn}
            whileHover={{ scale: 1.05, boxShadow: "0 4px 15px rgba(102, 126, 234, 0.4)" }}
            whileTap={{ scale: 0.95 }}
          >
            + New Reminder
          </motion.button>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div 
        style={styles.statsRow}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {[
          { value: stats.total, label: "Active Reminders", borderColor: "#667eea", textColor: "#1f2937" },
          { value: stats.overdue, label: "Overdue", borderColor: "#dc2626", textColor: stats.overdue > 0 ? "#dc2626" : "#1f2937" },
          { value: stats.today, label: "Due Today", borderColor: "#16a34a", textColor: "#1f2937" },
          { value: stats.highPriority, label: "High Priority", borderColor: "#d97706", textColor: "#1f2937" },
        ].map((stat, index) => (
          <motion.div 
            key={stat.label}
            style={{ ...styles.statCard, borderTop: `3px solid ${stat.borderColor}` }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + index * 0.1 }}
            whileHover={{ scale: 1.02, boxShadow: "0 8px 25px rgba(0, 0, 0, 0.1)" }}
          >
            <span style={{ ...styles.statValue, color: stat.textColor }}>{stat.value}</span>
            <span style={styles.statLabel}>{stat.label}</span>
          </motion.div>
        ))}
      </motion.div>

      {/* Filters */}
      <motion.div 
        style={styles.filtersCard}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <input
          type="text"
          placeholder="Search reminders..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={styles.searchInput}
        />
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          style={styles.filterSelect}
        >
          {PRIORITY_OPTIONS.map((p) => (
            <option key={p} value={p}>{p === "All" ? "All Priorities" : p}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          style={styles.filterSelect}
        >
          {TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>{t === "All" ? "All Types" : t}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={styles.filterSelect}
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s === "All" ? "All Status" : s}</option>
          ))}
        </select>
      </motion.div>

      {/* View Content */}
      {viewMode === "list" ? (
        <div style={styles.remindersList}>
          {/* Overdue Section */}
          {overdueReminders.length > 0 && (
            <div style={styles.section}>
              <div style={styles.sectionHeader}>
                <span style={styles.sectionTitle}>⚠️ Overdue</span>
                <span style={styles.sectionCount}>{overdueReminders.length}</span>
              </div>
              {overdueReminders.map((reminder) => (
                <ReminderCard key={reminder.id} reminder={reminder} />
              ))}
            </div>
          )}

          {/* Today Section */}
          {todayReminders.length > 0 && (
            <div style={styles.section}>
              <div style={styles.sectionHeader}>
                <span style={styles.sectionTitle}>📅 Today</span>
                <span style={styles.sectionCount}>{todayReminders.length}</span>
              </div>
              {todayReminders.map((reminder) => (
                <ReminderCard key={reminder.id} reminder={reminder} />
              ))}
            </div>
          )}

          {/* Tomorrow Section */}
          {tomorrowReminders.length > 0 && (
            <div style={styles.section}>
              <div style={styles.sectionHeader}>
                <span style={styles.sectionTitle}>📆 Tomorrow</span>
                <span style={styles.sectionCount}>{tomorrowReminders.length}</span>
              </div>
              {tomorrowReminders.map((reminder) => (
                <ReminderCard key={reminder.id} reminder={reminder} />
              ))}
            </div>
          )}

          {/* Upcoming Section */}
          {upcomingReminders.length > 0 && (
            <div style={styles.section}>
              <div style={styles.sectionHeader}>
                <span style={styles.sectionTitle}>🗓️ Upcoming</span>
                <span style={styles.sectionCount}>{upcomingReminders.length}</span>
              </div>
              {upcomingReminders.map((reminder) => (
                <ReminderCard key={reminder.id} reminder={reminder} />
              ))}
            </div>
          )}

          {filteredReminders.length === 0 && (
            <div style={styles.emptyState}>
              <span style={styles.emptyIcon}>🔔</span>
              <h3 style={styles.emptyTitle}>No reminders found</h3>
              <p style={styles.emptyText}>Create a new reminder to stay on top of your follow-ups</p>
            </div>
          )}
        </div>
      ) : (
        <CalendarView />
      )}

      {/* Add/Edit Reminder Modal */}
      {showAddModal && (
        <div
          style={styles.modalOverlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddModal(false);
              setEditingReminder(null);
            }
          }}
        >
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>{editingReminder ? "Edit Reminder" : "New Reminder"}</h2>
              <button onClick={() => { setShowAddModal(false); setEditingReminder(null); }} style={styles.modalClose}>✕</button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Lead / Company Name *</label>
                <input
                  type="text"
                  value={newReminder.leadName}
                  onChange={(e) => setNewReminder({ ...newReminder, leadName: e.target.value })}
                  placeholder="Enter lead or company name"
                  style={styles.formInput}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Reminder Title *</label>
                <input
                  type="text"
                  value={newReminder.title}
                  onChange={(e) => setNewReminder({ ...newReminder, title: e.target.value })}
                  placeholder="What do you need to remember?"
                  style={styles.formInput}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Description</label>
                <textarea
                  value={newReminder.description}
                  onChange={(e) => setNewReminder({ ...newReminder, description: e.target.value })}
                  placeholder="Add any additional details..."
                  rows={3}
                  style={styles.formTextarea}
                />
              </div>
              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Due Date</label>
                  <input
                    type="date"
                    value={newReminder.dueDate}
                    onChange={(e) => setNewReminder({ ...newReminder, dueDate: e.target.value })}
                    style={styles.formInput}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Due Time</label>
                  <input
                    type="time"
                    value={newReminder.dueTime}
                    onChange={(e) => setNewReminder({ ...newReminder, dueTime: e.target.value })}
                    style={styles.formInput}
                  />
                </div>
              </div>
              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Type</label>
                  <select
                    value={newReminder.type}
                    onChange={(e) => setNewReminder({ ...newReminder, type: e.target.value as Reminder["type"] })}
                    style={styles.formSelect}
                  >
                    <option value="Follow-up">Follow-up</option>
                    <option value="Call Back">Call Back</option>
                    <option value="Send Email">Send Email</option>
                    <option value="Meeting Prep">Meeting Prep</option>
                    <option value="Proposal">Proposal</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Priority</label>
                  <select
                    value={newReminder.priority}
                    onChange={(e) => setNewReminder({ ...newReminder, priority: e.target.value as "High" | "Medium" | "Low" })}
                    style={styles.formSelect}
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Assign To</label>
                <select
                  value={newReminder.assignedTo}
                  onChange={(e) => setNewReminder({ ...newReminder, assignedTo: e.target.value })}
                  style={styles.formSelect}
                >
                  {reps.map((rep) => (
                    <option key={rep} value={rep}>{rep}</option>
                  ))}
                  <option value="Thomas Lin">Thomas Lin</option>
                </select>
              </div>
            </div>
            <div style={styles.modalFooter}>
              <div style={styles.modalFooterLeft}>
                {editingReminder && (
                  <motion.button 
                    onClick={handleDeleteReminder} 
                    style={styles.deleteBtn}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    🗑️ Delete
                  </motion.button>
                )}
              </div>
              <div style={styles.modalFooterRight}>
                <motion.button 
                  onClick={() => { setShowAddModal(false); setEditingReminder(null); }} 
                  style={styles.cancelBtn}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Cancel
                </motion.button>
                <motion.button 
                  onClick={handleSaveReminder} 
                  style={styles.submitBtn}
                  whileHover={{ scale: 1.02, boxShadow: "0 4px 15px rgba(102, 126, 234, 0.4)" }}
                  whileTap={{ scale: 0.98 }}
                >
                  {editingReminder ? "Save Changes" : "Add Reminder"}
                </motion.button>
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
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
    color: "#1f2937",
    margin: 0,
  },
  subtitle: {
    fontSize: "14px",
    color: "#6b7280",
    margin: "4px 0 0",
  },
  headerActions: {
    display: "flex",
    gap: "12px",
  },
  viewToggle: {
    display: "flex",
    gap: "4px",
    background: "#f3f4f6",
    padding: "4px",
    borderRadius: "8px",
  },
  viewBtn: {
    padding: "8px 14px",
    borderRadius: "6px",
    border: "none",
    background: "transparent",
    color: "#6b7280",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
  },
  viewBtnActive: {
    background: "#fff",
    color: "#1f2937",
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.1)",
  },
  primaryBtn: {
    padding: "10px 20px",
    borderRadius: "8px",
    border: "none",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  },
  statsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "16px",
    marginBottom: "24px",
  },
  statCard: {
    background: "#fff",
    borderRadius: "12px",
    padding: "20px",
    textAlign: "center",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
  },
  statValue: {
    display: "block",
    fontSize: "28px",
    fontWeight: 700,
    color: "#1f2937",
  },
  statLabel: {
    fontSize: "13px",
    color: "#6b7280",
  },
  filtersCard: {
    display: "flex",
    gap: "12px",
    background: "#fff",
    borderRadius: "12px",
    padding: "16px 20px",
    marginBottom: "24px",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
  },
  searchInput: {
    flex: 1,
    padding: "10px 16px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    fontSize: "14px",
  },
  filterSelect: {
    padding: "10px 16px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    fontSize: "14px",
    minWidth: "140px",
  },
  remindersList: {},
  section: {
    marginBottom: "28px",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "12px",
  },
  sectionTitle: {
    fontSize: "16px",
    fontWeight: 600,
    color: "#1f2937",
  },
  sectionCount: {
    fontSize: "12px",
    fontWeight: 600,
    color: "#6b7280",
    background: "#f3f4f6",
    padding: "4px 10px",
    borderRadius: "10px",
  },
  reminderCard: {
    background: "#fff",
    borderRadius: "12px",
    padding: "18px 20px",
    marginBottom: "10px",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "10px",
  },
  cardLeft: {
    display: "flex",
    gap: "12px",
    alignItems: "flex-start",
  },
  typeIcon: {
    fontSize: "20px",
  },
  reminderTitle: {
    display: "block",
    fontSize: "15px",
    fontWeight: 600,
    color: "#1f2937",
  },
  leadLink: {
    fontSize: "13px",
    color: "#667eea",
    textDecoration: "none",
  },
  cardRight: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  priorityBadge: {
    padding: "4px 10px",
    borderRadius: "12px",
    fontSize: "11px",
    fontWeight: 600,
  },
  dueTime: {
    fontSize: "13px",
    fontWeight: 500,
    color: "#374151",
  },
  description: {
    fontSize: "14px",
    color: "#4b5563",
    margin: "0 0 14px",
    lineHeight: 1.5,
    paddingLeft: "32px",
  },
  cardFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: "12px",
    paddingLeft: "32px",
    borderTop: "1px solid #f3f4f6",
  },
  footerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  assignee: {
    fontSize: "13px",
    color: "#6b7280",
  },
  typeBadge: {
    fontSize: "11px",
    padding: "3px 8px",
    background: "#f3f4f6",
    borderRadius: "4px",
    color: "#6b7280",
  },
  cardActions: {
    display: "flex",
    gap: "8px",
  },
  snoozeBtn: {
    padding: "6px 12px",
    borderRadius: "6px",
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#374151",
    fontSize: "12px",
    cursor: "pointer",
  },
  completeBtn: {
    padding: "6px 12px",
    borderRadius: "6px",
    border: "none",
    background: "#10b981",
    color: "#fff",
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer",
  },
  completedBadge: {
    fontSize: "12px",
    color: "#16a34a",
    fontWeight: 500,
  },
  emptyState: {
    textAlign: "center",
    padding: "60px 20px",
    background: "#fff",
    borderRadius: "12px",
  },
  emptyIcon: {
    fontSize: "48px",
  },
  emptyTitle: {
    fontSize: "18px",
    fontWeight: 600,
    color: "#1f2937",
    margin: "16px 0 8px",
  },
  emptyText: {
    fontSize: "14px",
    color: "#6b7280",
    margin: 0,
  },
  // Calendar styles
  calendarContainer: {
    background: "#fff",
    borderRadius: "16px",
    padding: "24px",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
  },
  calendarHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
  },
  calendarNavBtn: {
    width: "36px",
    height: "36px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    background: "#fff",
    fontSize: "16px",
    cursor: "pointer",
  },
  calendarMonth: {
    fontSize: "18px",
    fontWeight: 600,
    color: "#1f2937",
  },
  calendarWeekdays: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: "4px",
    marginBottom: "8px",
  },
  weekday: {
    textAlign: "center" as const,
    fontSize: "12px",
    fontWeight: 600,
    color: "#6b7280",
    padding: "8px",
  },
  calendarGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: "4px",
  },
  calendarDay: {
    minHeight: "100px",
    padding: "8px",
    background: "#f9fafb",
    borderRadius: "8px",
    overflow: "hidden",
  },
  calendarDayClickable: {
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  dayHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "4px",
  },
  addIcon: {
    fontSize: "16px",
    fontWeight: 600,
    width: "20px",
    height: "20px",
    borderRadius: "4px",
    background: "#e5e7eb",
    color: "#6b7280",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s",
  },
  calendarHint: {
    marginTop: "16px",
    padding: "12px 16px",
    background: "#f0fdf4",
    borderRadius: "8px",
    fontSize: "13px",
    color: "#166534",
    textAlign: "center" as const,
  },
  calendarDayToday: {
    background: "#eef2ff",
    border: "2px solid #667eea",
  },
  dayNumber: {
    display: "block",
    fontSize: "14px",
    fontWeight: 500,
    color: "#374151",
    marginBottom: "6px",
  },
  dayNumberToday: {
    color: "#667eea",
    fontWeight: 700,
  },
  dayReminders: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "4px",
  },
  calendarReminder: {
    fontSize: "10px",
    padding: "3px 6px",
    borderRadius: "4px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
    cursor: "pointer",
  },
  calendarReminderCompleted: {
    background: "#d1fae5",
    color: "#059669",
    textDecoration: "line-through",
    opacity: 0.8,
  },
  moreReminders: {
    fontSize: "10px",
    color: "#6b7280",
    fontWeight: 500,
  },
  // Modal styles
  modalOverlay: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(0, 0, 0, 0.5)",
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
    maxWidth: "500px",
    maxHeight: "90vh",
    overflow: "auto",
    boxShadow: "0 20px 40px rgba(0, 0, 0, 0.2)",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 24px",
    borderBottom: "1px solid #e5e7eb",
  },
  modalTitle: {
    fontSize: "18px",
    fontWeight: 600,
    color: "#1f2937",
    margin: 0,
  },
  modalClose: {
    width: "32px",
    height: "32px",
    borderRadius: "8px",
    border: "none",
    background: "#f3f4f6",
    fontSize: "14px",
    cursor: "pointer",
    color: "#6b7280",
  },
  modalBody: {
    padding: "24px",
  },
  modalFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 24px",
    borderTop: "1px solid #e5e7eb",
    background: "#f9fafb",
    borderRadius: "0 0 16px 16px",
  },
  modalFooterLeft: {
    display: "flex",
    gap: "12px",
  },
  modalFooterRight: {
    display: "flex",
    gap: "12px",
  },
  deleteBtn: {
    padding: "10px 16px",
    borderRadius: "8px",
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#dc2626",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
  },
  formGroup: {
    marginBottom: "16px",
    flex: 1,
  },
  formRow: {
    display: "flex",
    gap: "16px",
  },
  formLabel: {
    display: "block",
    fontSize: "13px",
    fontWeight: 500,
    color: "#374151",
    marginBottom: "6px",
  },
  formInput: {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    fontSize: "14px",
    boxSizing: "border-box" as const,
  },
  formSelect: {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    fontSize: "14px",
    background: "#fff",
  },
  formTextarea: {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    fontSize: "14px",
    resize: "vertical" as const,
    fontFamily: "inherit",
    boxSizing: "border-box" as const,
  },
  cancelBtn: {
    padding: "10px 20px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#374151",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
  },
  submitBtn: {
    padding: "10px 20px",
    borderRadius: "8px",
    border: "none",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  },
  loadingState: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    padding: "80px 20px",
    textAlign: "center" as const,
  },
  loadingSpinner: {
    fontSize: "48px",
    marginBottom: "16px",
  },
  errorState: {
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    padding: "80px 20px",
    textAlign: "center" as const,
  },
  errorIcon: {
    fontSize: "48px",
    marginBottom: "16px",
  },
  retryBtn: {
    marginTop: "16px",
    padding: "10px 20px",
    borderRadius: "8px",
    border: "none",
    background: "#667eea",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
  },
};

export default Reminders;
