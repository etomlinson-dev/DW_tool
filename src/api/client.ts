import axios from "axios";
import type {
  Lead,
  Log,
  LeadFilters,
  PaginatedResponse,
  DashboardStats,
  EmailTemplate,
  GeneratedEmail,
  PipelineStage,
  StageHistory,
} from "../types";

// API base URL - uses Vite proxy in development
const API_BASE_URL = "/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach current user ID to every request so the backend
// knows which user's Microsoft token to use for sending emails, etc.
api.interceptors.request.use((config) => {
  const saved = localStorage.getItem("dw_user");
  if (saved) {
    try {
      const user = JSON.parse(saved);
      if (user?.id) {
        config.headers["X-User-Id"] = user.id;
      }
    } catch {
      // Ignore parse errors
    }
  }
  return config;
});

// ===========================================
// Type definitions for new entities
// ===========================================

export interface TeamMember {
  id: number;
  name: string;
  email: string;
  role: string;
  avatar_url?: string;
  phone?: string;
  is_active: boolean;
  created_at?: string;
}

export interface TeamPerformance {
  id: number;
  name: string;
  email: string;
  role: string;
  avatar_url?: string;
  activities: number;
  calls: number;
  emails: number;
  meetings: number;
  proposals: number;
  conversions: number;
  revenue: number;
  leads_assigned: number;
  rank: number;
  targets: {
    calls: number;
    emails: number;
    meetings: number;
    conversions: number;
  };
}

export interface Reminder {
  id: number;
  lead_id?: number;
  lead_name?: string;
  assigned_to: string;
  type: string;
  priority: string;
  title: string;
  description?: string;
  due_date?: string;
  completed_at?: string;
  snoozed_until?: string;
  created_at?: string;
}

export interface CalendarEvent {
  id: number;
  lead_id?: number;
  lead_name?: string;
  title: string;
  description?: string;
  event_type: string;
  start_time: string;
  end_time?: string;
  created_by?: string;
  created_at?: string;
}

export interface EmailSequence {
  id: number;
  name: string;
  description?: string;
  status: string;
  leads_enrolled: number;
  emails_sent: number;
  open_rate: number;
  reply_rate: number;
  steps: EmailSequenceStep[];
  created_at?: string;
}

export interface EmailSequenceStep {
  id: number;
  sequence_id: number;
  step_order: number;
  template_id?: number;
  template_name?: string;
  delay_days: number;
  subject_override?: string;
}

export interface PendingEmail {
  id: number;
  lead_id: number;
  lead_name?: string;
  lead_email?: string;
  template_id?: number;
  template_name?: string;
  subject: string;
  body: string;
  status: string;
  priority: string;
  generated_by?: string;
  reviewer?: string;
  review_notes?: string;
  generated_at?: string;
  sent_at?: string;
}

export interface Proposal {
  id: number;
  lead_id: number;
  lead_name?: string;
  title?: string;
  configuration?: Record<string, unknown>;
  proposal_html?: string;
  total_price?: number;
  discount?: number;
  validity_days?: number;
  status: string;
  version: number;
  created_at?: string;
  sent_at?: string;
  viewed_at?: string;
  notes?: string;
}

export interface CallScript {
  id: number;
  name: string;
  script_type: string;
  content: string;
  is_active: boolean;
  created_at?: string;
}

export interface Activity {
  id: number;
  lead_id: number;
  lead_name?: string;
  lead_contact?: string;
  assigned_rep?: string;
  activity_type: string;
  outcome?: string;
  timestamp?: string;
  notes?: string;
  call_duration?: number;
  call_outcome?: string;
  call_notes?: string;
  email_subject?: string;
  email_opened?: boolean;
  email_clicked?: boolean;
}

export interface NetworkGraph {
  clients: { id: string; name: string; color: string }[];
  entities: { id: string; label: string; type: string; depth?: number }[];
  edges: { from: string; to: string; strength: number; clients: string[] }[];
}

export interface SearchResults {
  leads: Lead[];
  activities: Activity[];
  emails: PendingEmail[];
  proposals: Proposal[];
}

// Leads API
export const leadsApi = {
  // Get all leads with optional filters
  getLeads: async (filters?: LeadFilters): Promise<PaginatedResponse<Lead>> => {
    const params = new URLSearchParams();
    if (filters?.status) params.append("status", filters.status);
    if (filters?.rep) params.append("rep", filters.rep);
    if (filters?.industry) params.append("industry", filters.industry);
    if (filters?.timeframe) params.append("timeframe", filters.timeframe);
    if (filters?.page) params.append("page", filters.page.toString());
    if (filters?.per_page) params.append("per_page", filters.per_page.toString());

    const response = await api.get<PaginatedResponse<Lead>>(`/leads?${params}`);
    return response.data;
  },

  // Get single lead by ID
  getLead: async (id: number): Promise<Lead> => {
    const response = await api.get<Lead>(`/leads/${id}`);
    return response.data;
  },

  // Create new lead
  createLead: async (lead: Partial<Lead>): Promise<Lead> => {
    const response = await api.post<Lead>("/leads", lead);
    return response.data;
  },

  // Update lead
  updateLead: async (id: number, lead: Partial<Lead>): Promise<Lead> => {
    const response = await api.put<Lead>(`/leads/${id}`, lead);
    return response.data;
  },

  // Quick status update
  updateLeadStatus: async (id: number, status: string): Promise<Lead> => {
    const response = await api.post<Lead>(`/leads/${id}/quick-status`, { status });
    return response.data;
  },

  // Delete lead
  deleteLead: async (id: number): Promise<void> => {
    await api.delete(`/leads/${id}`);
  },

  // Bulk update leads
  bulkUpdate: async (
    leadIds: number[],
    updates: { status?: string; assigned_rep?: string }
  ): Promise<void> => {
    await api.post("/leads/bulk-update", { lead_ids: leadIds, ...updates });
  },
};

// Logs API
export const logsApi = {
  // Get logs for a lead
  getLogsForLead: async (leadId: number): Promise<Log[]> => {
    const response = await api.get<Log[]>(`/leads/${leadId}/logs`);
    return response.data;
  },

  // Quick log activity
  quickLog: async (
    leadId: number,
    activityType: string,
    outcome: string
  ): Promise<Log> => {
    const response = await api.post<Log>(`/leads/${leadId}/quick-log`, {
      activity_type: activityType,
      outcome,
    });
    return response.data;
  },

  // Create log
  createLog: async (leadId: number, log: Partial<Log>): Promise<Log> => {
    const response = await api.post<Log>(`/leads/${leadId}/logs`, log);
    return response.data;
  },
};

// Dashboard API
export const dashboardApi = {
  // Get dashboard stats
  getStats: async (): Promise<DashboardStats> => {
    const response = await api.get<DashboardStats>("/dashboard/stats");
    return response.data;
  },

  // Get filter options (reps, industries)
  getFilterOptions: async (): Promise<{
    reps: string[];
    industries: string[];
    statuses: string[];
  }> => {
    const response = await api.get("/dashboard/filter-options");
    return response.data;
  },

  // Get leaderboard
  getLeaderboard: async (timeframe: "today" | "week" | "month" = "week") => {
    const response = await api.get(`/dashboard/leaderboard?timeframe=${timeframe}`);
    return response.data;
  },

  // Get activity trends
  getTrends: async (days: number = 7) => {
    const response = await api.get(`/dashboard/trends?days=${days}`);
    return response.data;
  },

  // Get conversion funnel
  getConversionFunnel: async () => {
    const response = await api.get("/dashboard/conversion-funnel");
    return response.data;
  },
};

// Email Templates API
export const templatesApi = {
  getTemplates: async (): Promise<EmailTemplate[]> => {
    const response = await api.get<EmailTemplate[]>("/templates");
    return response.data;
  },

  getTemplate: async (id: number): Promise<EmailTemplate> => {
    const response = await api.get<EmailTemplate>(`/templates/${id}`);
    return response.data;
  },

  createTemplate: async (template: Partial<EmailTemplate>): Promise<EmailTemplate> => {
    const response = await api.post<EmailTemplate>("/templates", template);
    return response.data;
  },

  updateTemplate: async (
    id: number,
    template: Partial<EmailTemplate>
  ): Promise<EmailTemplate> => {
    const response = await api.put<EmailTemplate>(`/templates/${id}`, template);
    return response.data;
  },
};

// Email Generation API
export const emailsApi = {
  generateEmail: async (leadId: number, templateId?: number): Promise<GeneratedEmail> => {
    const response = await api.post<GeneratedEmail>(`/leads/${leadId}/generate-email`, {
      template_id: templateId,
    });
    return response.data;
  },

  bulkGenerateEmails: async (leadIds: number[]): Promise<GeneratedEmail[]> => {
    const response = await api.post<GeneratedEmail[]>("/emails/bulk-generate", {
      lead_ids: leadIds,
    });
    return response.data;
  },

  // Pending emails
  getPendingEmails: async (status?: string): Promise<PendingEmail[]> => {
    const params = status ? `?status=${status}` : "";
    const response = await api.get<PendingEmail[]>(`/emails/pending${params}`);
    return response.data;
  },

  approveEmail: async (id: number, reviewer?: string, notes?: string): Promise<PendingEmail> => {
    const response = await api.put<PendingEmail>(`/emails/${id}/approve`, { reviewer, notes });
    return response.data;
  },

  rejectEmail: async (id: number, reviewer?: string, notes?: string): Promise<PendingEmail> => {
    const response = await api.put<PendingEmail>(`/emails/${id}/reject`, { reviewer, notes });
    return response.data;
  },

  sendEmail: async (id: number): Promise<PendingEmail> => {
    const response = await api.post<PendingEmail>(`/emails/${id}/send`);
    return response.data;
  },

  // Tracking
  getTracking: async (filters?: { template_id?: string; category?: string; reply_status?: string }): Promise<{
    emails: (PendingEmail & { reply_status: string; replied_at: string | null; reply_snippet: string | null; template_category: string | null })[];
    templates: { id: number; name: string; category: string }[];
    stats: { total_sent: number; replied: number; no_reply: number; bounced: number; reply_rate: number };
  }> => {
    const params = new URLSearchParams();
    if (filters?.template_id) params.append("template_id", filters.template_id);
    if (filters?.category) params.append("category", filters.category);
    if (filters?.reply_status) params.append("reply_status", filters.reply_status);
    const response = await api.get(`/emails/tracking?${params}`);
    return response.data;
  },

  checkReplies: async (): Promise<{ message: string; updated: number; checked: number }> => {
    const response = await api.post("/emails/check-replies");
    return response.data;
  },
};

// Team Members API
export const teamApi = {
  getTeam: async (): Promise<TeamMember[]> => {
    const response = await api.get<TeamMember[]>("/team");
    return response.data;
  },

  getMember: async (id: number): Promise<TeamMember> => {
    const response = await api.get<TeamMember>(`/team/${id}`);
    return response.data;
  },

  createMember: async (member: Partial<TeamMember>): Promise<TeamMember> => {
    const response = await api.post<TeamMember>("/team", member);
    return response.data;
  },

  updateMember: async (id: number, member: Partial<TeamMember>): Promise<TeamMember> => {
    const response = await api.put<TeamMember>(`/team/${id}`, member);
    return response.data;
  },

  deleteMember: async (id: number): Promise<void> => {
    await api.delete(`/team/${id}`);
  },

  getPerformance: async (timeframe?: string): Promise<{ members: TeamPerformance[]; team_stats: Record<string, number> }> => {
    const params = timeframe ? `?timeframe=${timeframe}` : "";
    const response = await api.get(`/team/performance${params}`);
    return response.data;
  },
};

// My Performance types
export interface MyPerformanceStats {
  total_activities: number;
  calls: number;
  emails_sent: number;
  emails_total: number;
  meetings: number;
  notes: number;
  tasks: number;
  proposals: number;
  conversions: number;
  revenue: number;
  leads_assigned: number;
}

export interface EmailPipeline {
  pending_review: number;
  approved: number;
  rejected: number;
  sent: number;
  total_composed: number;
}

export interface TimelineItem {
  type: string;
  activity_type: string;
  outcome: string;
  notes: string | null;
  lead_name: string | null;
  lead_id: number | null;
  timestamp: string | null;
}

export interface MyPerformanceData {
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
    avatar_url: string | null;
  };
  stats: MyPerformanceStats;
  email_pipeline: EmailPipeline;
  targets: {
    calls: number;
    emails: number;
    meetings: number;
    conversions: number;
  };
  timeline: TimelineItem[];
}

// User API
export const userApi = {
  getCurrentUser: async (): Promise<TeamMember> => {
    const response = await api.get<TeamMember>("/user/me");
    return response.data;
  },

  updateCurrentUser: async (data: Partial<TeamMember>): Promise<TeamMember> => {
    const response = await api.put<TeamMember>("/user/me", data);
    return response.data;
  },
};

// Performance API
export const performanceApi = {
  getMyPerformance: async (timeframe?: string): Promise<MyPerformanceData> => {
    const params = timeframe ? `?timeframe=${timeframe}` : "";
    const response = await api.get<MyPerformanceData>(`/my-performance${params}`);
    return response.data;
  },

  getTeamPerformance: async (timeframe?: string): Promise<{ members: TeamPerformance[]; team_stats: Record<string, number> }> => {
    const params = timeframe ? `?timeframe=${timeframe}` : "";
    const response = await api.get(`/team/performance${params}`);
    return response.data;
  },
};

// Reminders API
export const remindersApi = {
  getReminders: async (filters?: { priority?: string; type?: string; status?: string; assigned_to?: string }): Promise<Reminder[]> => {
    const params = new URLSearchParams();
    if (filters?.priority) params.append("priority", filters.priority);
    if (filters?.type) params.append("type", filters.type);
    if (filters?.status) params.append("status", filters.status);
    if (filters?.assigned_to) params.append("assigned_to", filters.assigned_to);
    const response = await api.get<Reminder[]>(`/reminders?${params}`);
    return response.data;
  },

  getReminder: async (id: number): Promise<Reminder> => {
    const response = await api.get<Reminder>(`/reminders/${id}`);
    return response.data;
  },

  createReminder: async (reminder: Partial<Reminder>): Promise<Reminder> => {
    const response = await api.post<Reminder>("/reminders", reminder);
    return response.data;
  },

  updateReminder: async (id: number, reminder: Partial<Reminder>): Promise<Reminder> => {
    const response = await api.put<Reminder>(`/reminders/${id}`, reminder);
    return response.data;
  },

  deleteReminder: async (id: number): Promise<void> => {
    await api.delete(`/reminders/${id}`);
  },

  completeReminder: async (id: number): Promise<Reminder> => {
    const response = await api.put<Reminder>(`/reminders/${id}/complete`);
    return response.data;
  },

  snoozeReminder: async (id: number, hours: number): Promise<Reminder> => {
    const response = await api.put<Reminder>(`/reminders/${id}/snooze`, { hours });
    return response.data;
  },
};

// Calendar Events API
export const calendarApi = {
  getEvents: async (start?: string, end?: string): Promise<CalendarEvent[]> => {
    const params = new URLSearchParams();
    if (start) params.append("start", start);
    if (end) params.append("end", end);
    const response = await api.get<CalendarEvent[]>(`/calendar/events?${params}`);
    return response.data;
  },

  createEvent: async (event: Partial<CalendarEvent>): Promise<CalendarEvent> => {
    const response = await api.post<CalendarEvent>("/calendar/events", event);
    return response.data;
  },

  updateEvent: async (id: number, event: Partial<CalendarEvent>): Promise<CalendarEvent> => {
    const response = await api.put<CalendarEvent>(`/calendar/events/${id}`, event);
    return response.data;
  },

  deleteEvent: async (id: number): Promise<void> => {
    await api.delete(`/calendar/events/${id}`);
  },
};

// Email Sequences API
export const sequencesApi = {
  getSequences: async (): Promise<EmailSequence[]> => {
    const response = await api.get<EmailSequence[]>("/email-sequences");
    return response.data;
  },

  getSequence: async (id: number): Promise<EmailSequence> => {
    const response = await api.get<EmailSequence>(`/email-sequences/${id}`);
    return response.data;
  },

  createSequence: async (sequence: Partial<EmailSequence>): Promise<EmailSequence> => {
    const response = await api.post<EmailSequence>("/email-sequences", sequence);
    return response.data;
  },

  updateSequence: async (id: number, sequence: Partial<EmailSequence>): Promise<EmailSequence> => {
    const response = await api.put<EmailSequence>(`/email-sequences/${id}`, sequence);
    return response.data;
  },

  deleteSequence: async (id: number): Promise<void> => {
    await api.delete(`/email-sequences/${id}`);
  },
};

// Proposals API
export const proposalsApi = {
  getProposals: async (): Promise<Proposal[]> => {
    const response = await api.get<Proposal[]>("/proposals");
    return response.data;
  },

  getProposal: async (id: number): Promise<Proposal> => {
    const response = await api.get<Proposal>(`/proposals/${id}`);
    return response.data;
  },

  createProposal: async (proposal: Partial<Proposal>): Promise<Proposal> => {
    const response = await api.post<Proposal>("/proposals", proposal);
    return response.data;
  },

  updateProposal: async (id: number, proposal: Partial<Proposal>): Promise<Proposal> => {
    const response = await api.put<Proposal>(`/proposals/${id}`, proposal);
    return response.data;
  },

  deleteProposal: async (id: number): Promise<void> => {
    await api.delete(`/proposals/${id}`);
  },

  queueProposalEmail: async (id: number): Promise<{ message: string; proposal: Proposal; email_id: number }> => {
    const response = await api.post(`/proposals/${id}/queue-email`);
    return response.data;
  },
};

// Call Scripts API
export const callScriptsApi = {
  getScripts: async (): Promise<CallScript[]> => {
    const response = await api.get<CallScript[]>("/call-scripts");
    return response.data;
  },

  createScript: async (script: Partial<CallScript>): Promise<CallScript> => {
    const response = await api.post<CallScript>("/call-scripts", script);
    return response.data;
  },

  updateScript: async (id: number, script: Partial<CallScript>): Promise<CallScript> => {
    const response = await api.put<CallScript>(`/call-scripts/${id}`, script);
    return response.data;
  },
};

// Activities API
export const activitiesApi = {
  getActivities: async (filters?: { rep?: string; type?: string; date?: string }): Promise<Activity[]> => {
    const params = new URLSearchParams();
    if (filters?.rep) params.append("rep", filters.rep);
    if (filters?.type) params.append("type", filters.type);
    if (filters?.date) params.append("date", filters.date);
    const response = await api.get<Activity[]>(`/activities?${params}`);
    return response.data;
  },
  createActivity: async (activity: {
    lead_id: number;
    activity_type: string;
    outcome: string;
    notes?: string;
    call_duration?: number;
    email_subject?: string;
  }): Promise<Activity> => {
    const response = await api.post<Activity>("/activities", activity);
    return response.data;
  },
  deleteActivity: async (id: number): Promise<void> => {
    await api.delete(`/activities/${id}`);
  },
};

// Search API
export const searchApi = {
  search: async (query: string, category?: string): Promise<SearchResults> => {
    const params = new URLSearchParams();
    params.append("q", query);
    if (category) params.append("category", category);
    const response = await api.get<SearchResults>(`/search?${params}`);
    return response.data;
  },

  getRecentSearches: async (): Promise<string[]> => {
    const response = await api.get<string[]>("/search/recent");
    return response.data;
  },

  saveSearch: async (query: string, category?: string): Promise<void> => {
    await api.post("/search/recent", { query, category });
  },
};

// Pipeline API
export const pipelineApi = {
  getStages: async (serviceCategory?: string): Promise<PipelineStage[]> => {
    const params = new URLSearchParams();
    if (serviceCategory) params.append("service_category", serviceCategory);
    const response = await api.get<PipelineStage[]>(`/pipeline/stages?${params}`);
    return response.data;
  },

  createStage: async (stage: Partial<PipelineStage>): Promise<PipelineStage> => {
    const response = await api.post<PipelineStage>("/pipeline/stages", stage);
    return response.data;
  },

  updateStage: async (id: number, stage: Partial<PipelineStage>): Promise<PipelineStage> => {
    const response = await api.put<PipelineStage>(`/pipeline/stages/${id}`, stage);
    return response.data;
  },

  deleteStage: async (id: number): Promise<void> => {
    await api.delete(`/pipeline/stages/${id}`);
  },

  reorderStages: async (stageOrders: Array<{ id: number; order: number }>): Promise<void> => {
    await api.post("/pipeline/stages/reorder", { stage_orders: stageOrders });
  },

  getLeads: async (): Promise<Record<string, { stage: PipelineStage; leads: Lead[]; count: number; total_value: number }>> => {
    const response = await api.get("/pipeline/leads");
    return response.data;
  },

  moveLead: async (leadId: number, stageId: number | null, changedBy?: string, reason?: string): Promise<{ lead: Lead; history: StageHistory }> => {
    const response = await api.post(`/pipeline/leads/${leadId}/move`, { stage_id: stageId, changed_by: changedBy, reason });
    return response.data;
  },

  getLeadHistory: async (leadId: number): Promise<StageHistory[]> => {
    const response = await api.get<StageHistory[]>(`/pipeline/leads/${leadId}/history`);
    return response.data;
  },

  getBottlenecks: async (): Promise<Array<{ stage: PipelineStage; sla_days: number; overdue_count: number; leads: Lead[] }>> => {
    const response = await api.get("/pipeline/bottlenecks");
    return response.data;
  },

  getMetrics: async (): Promise<{
    stages: Array<{ stage: PipelineStage; leads_count: number; total_value: number; avg_duration_days: number | null }>;
    total_leads: number;
    won_leads: number;
    conversion_rate: number;
    total_pipeline_value: number;
  }> => {
    const response = await api.get("/pipeline/metrics");
    return response.data;
  },
};

// Network Graph API
export const networkApi = {
  getGraph: async (): Promise<NetworkGraph> => {
    const response = await api.get<NetworkGraph>("/network/graph");
    return response.data;
  },

  createClient: async (name: string, color?: string): Promise<{ id: string; name: string; color: string }> => {
    const response = await api.post("/network/clients", { name, color });
    return response.data;
  },

  createEntity: async (label: string, type: string, depth?: number): Promise<{ id: string; label: string; type: string; depth?: number }> => {
    const response = await api.post("/network/entities", { label, type, depth });
    return response.data;
  },

  createEdge: async (from: string, to: string, strength?: number, clients?: string[]): Promise<{ from: string; to: string; strength: number; clients: string[] }> => {
    const response = await api.post("/network/edges", { from, to, strength, clients });
    return response.data;
  },
};

export default api;
