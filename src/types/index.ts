// Contact Info Types
export interface EmailEntry {
  label: string;
  email: string;
}

export interface PhoneEntry {
  label: string;
  phone: string;
}

// Lead Types
export interface Lead {
  id: number;
  business_name: string;
  industry: string | null;
  contact_name: string | null;
  contact_title: string | null;
  email: string | null;
  emails: EmailEntry[];
  phone: string | null;
  phones: PhoneEntry[];
  website: string | null;
  source: string | null;
  assigned_rep: string | null;
  status: LeadStatus;
  last_activity: string | null;
  activity_count: number;
  notes: string | null;
  tags: string[];
  location: string | null;
  
  // Service category
  service_category: ServiceCategory | null;
  
  // Campaign
  campaign_id: number | null;
  
  // Outreach tracking
  first_outreach_date: string | null;
  first_outreach_method: OutreachMethod | null;
  follow_up_count: number;
  next_follow_up_date: string | null;
  next_follow_up_reminder: boolean;
  
  // Response tracking
  response_status: ResponseStatus;
  response_date: string | null;
  response_summary: string | null;
  objections: string[];
  decision_timeline: string | null;
  
  // Deal tracking
  deal_value: number | null;
  expected_close_date: string | null;
  
  // Pipeline
  pipeline_stage_id: number | null;
  
  // KYI
  kyi_investor_id: number | null;
  kyi_firm_id: number | null;
  
  // Timestamps
  created_at: string | null;
  updated_at: string | null;
}

export type LeadStatus =
  | "Not Contacted"
  | "Attempted"
  | "Connected"
  | "Follow-up Needed"
  | "Qualified Lead"
  | "Proposal Sent"
  | "Not Interested"
  | "Converted";

export const LEAD_STATUS_OPTIONS: LeadStatus[] = [
  "Not Contacted",
  "Attempted",
  "Connected",
  "Follow-up Needed",
  "Qualified Lead",
  "Proposal Sent",
  "Not Interested",
  "Converted",
];

export const LEAD_SOURCE_OPTIONS = [
  "List",
  "Scraping",
  "Referral",
  "Event",
  "Website",
  "Social Media",
  "Cold Outreach",
  "Other",
] as const;

export type LeadSource = (typeof LEAD_SOURCE_OPTIONS)[number];

// Service Categories
export type ServiceCategory = "Marketing" | "Consulting" | "Web Development" | "Other";

export const SERVICE_CATEGORY_OPTIONS: ServiceCategory[] = [
  "Marketing",
  "Consulting",
  "Web Development",
  "Other",
];

// Outreach Methods
export type OutreachMethod = "email" | "linkedin" | "call" | "text" | "other";

export const OUTREACH_METHOD_OPTIONS: OutreachMethod[] = [
  "email",
  "linkedin",
  "call",
  "text",
  "other",
];

// Response Statuses
export type ResponseStatus = "no_response" | "opened" | "replied" | "interested" | "not_interested";

export const RESPONSE_STATUS_OPTIONS: ResponseStatus[] = [
  "no_response",
  "opened",
  "replied",
  "interested",
  "not_interested",
];

export const RESPONSE_STATUS_LABELS: Record<ResponseStatus, string> = {
  no_response: "No Response",
  opened: "Opened",
  replied: "Replied",
  interested: "Interested",
  not_interested: "Not Interested",
};

// Campaign Types
export interface Campaign {
  id: number;
  name: string;
  description: string | null;
  status: "draft" | "active" | "paused" | "completed";
  target_industry: string | null;
  target_service: string | null;
  start_date: string | null;
  end_date: string | null;
  leads_count: number;
  emails_sent: number;
  responses_count: number;
  conversions_count: number;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

// Pipeline Stage Types
export interface PipelineStage {
  id: number;
  name: string;
  description: string | null;
  order: number;
  color: string;
  service_category: string | null;
  is_active: boolean;
  is_won_stage: boolean;
  is_lost_stage: boolean;
  sla_days: number | null;
}

// Stage History Types
export interface StageHistory {
  id: number;
  lead_id: number;
  from_stage_id: number | null;
  from_stage_name: string | null;
  to_stage_id: number;
  to_stage_name: string | null;
  changed_by: string | null;
  reason: string | null;
  duration_seconds: number | null;
  duration_days: number | null;
  changed_at: string | null;
}

// Log Types
export interface Log {
  id: number;
  lead_id: number;
  activity_type: string;
  outcome: string | null;
  timestamp: string;
  notes: string | null;
  call_duration: number | null;
  call_outcome: string | null;
  call_notes: string | null;
  email_subject: string | null;
  email_opened: boolean;
  email_clicked: boolean;
}

// Email Template Types
export interface EmailTemplate {
  id: number;
  name: string;
  category: string | null;
  subject: string;
  body: string;
  is_default: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

// Generated Email Types
export interface GeneratedEmail {
  id: number;
  lead_id: number;
  template_id: number | null;
  subject: string;
  body: string;
  status: "draft" | "pending_review" | "approved" | "sent" | "rejected";
  generated_by: string | null;
  generated_at: string;
  sent_at: string | null;
}

// Proposal Types
export interface Proposal {
  id: number;
  lead_id: number;
  title: string | null;
  configuration_json: string | null;
  proposal_html: string | null;
  total_price: string | null;
  status: "draft" | "sent" | "accepted" | "rejected";
  created_at: string;
  sent_at: string | null;
  notes: string | null;
}

// API Response Types
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface DashboardStats {
  daily_completed: number;
  daily_target: number;
  weekly_completed: number;
  weekly_target: number;
  weekly_change: number;
  monthly_completed: number;
  monthly_target: number;
  monthly_change: number;
  yearly_completed: number;
  yearly_target: number;
  total_leads: number;
  unique_businesses: number;
  conversion_rate: number;
  status_distribution: Record<string, number>;
  activity_breakdown: Record<string, number>;
}

export interface LeaderboardEntry {
  rank: number;
  rep: string;
  activities: number;
  calls: number;
  emails: number;
  conversions: number;
  leads_assigned: number;
}

export interface TrendDataPoint {
  date: string;
  day: string;
  activities: number;
  calls: number;
  emails: number;
}

export interface FunnelStage {
  stage: string;
  count: number;
  percentage: number;
}

// Filter Types
export interface LeadFilters {
  status?: string;
  rep?: string;
  industry?: string;
  timeframe?: "today" | "week" | "month" | "";
  page?: number;
  per_page?: number;
}
