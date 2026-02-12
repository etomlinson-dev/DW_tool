// KYI (Know Your Investor) Types

// Pipeline stages in order
export type ProspectStage = "discovered" | "outreached" | "connected" | "interested" | "investor";

export const PROSPECT_STAGES: ProspectStage[] = [
  "discovered",
  "outreached", 
  "connected",
  "interested",
  "investor"
];

export const STAGE_LABELS: Record<ProspectStage, string> = {
  discovered: "Discovered",
  outreached: "Outreached",
  connected: "Connected",
  interested: "Interested",
  investor: "Investor",
};

export const STAGE_COLORS: Record<ProspectStage, { bg: string; text: string; border: string }> = {
  discovered: { bg: "#f3f4f6", text: "#6b7280", border: "#d1d5db" },
  outreached: { bg: "#dbeafe", text: "#1d4ed8", border: "#93c5fd" },
  connected: { bg: "#dcfce7", text: "#166534", border: "#86efac" },
  interested: { bg: "#fef3c7", text: "#92400e", border: "#fcd34d" },
  investor: { bg: "#f3e8ff", text: "#7c3aed", border: "#c4b5fd" },
};

// Warmth levels
export type Warmth = "cold" | "warm" | "trusted";

export const WARMTH_OPTIONS: Warmth[] = ["cold", "warm", "trusted"];

export const WARMTH_LABELS: Record<Warmth, string> = {
  cold: "Cold",
  warm: "Warm",
  trusted: "Trusted",
};

export const WARMTH_COLORS: Record<Warmth, { bg: string; text: string }> = {
  cold: { bg: "#e0f2fe", text: "#0369a1" },
  warm: { bg: "#fed7aa", text: "#c2410c" },
  trusted: { bg: "#bbf7d0", text: "#15803d" },
};

// Strategic value types
export type StrategicValue = "capital_only" | "operator" | "advisor" | "network_connector";

export const STRATEGIC_VALUE_OPTIONS: StrategicValue[] = [
  "capital_only",
  "operator",
  "advisor",
  "network_connector"
];

export const STRATEGIC_VALUE_LABELS: Record<StrategicValue, string> = {
  capital_only: "Capital Only",
  operator: "Operator",
  advisor: "Advisor",
  network_connector: "Network Connector",
};

// Looking for types
export type LookingFor = "cash_flow" | "long_term_equity" | "board_seat" | "hands_on";

export const LOOKING_FOR_OPTIONS: LookingFor[] = [
  "cash_flow",
  "long_term_equity",
  "board_seat",
  "hands_on"
];

export const LOOKING_FOR_LABELS: Record<LookingFor, string> = {
  cash_flow: "Cash Flow",
  long_term_equity: "Long-term Equity",
  board_seat: "Board Seat",
  hands_on: "Hands-on Involvement",
};

// Investment structure types
export type InvestmentStructure = "equity" | "convertible" | "revenue_share" | "hybrid";

export const INVESTMENT_STRUCTURE_OPTIONS: InvestmentStructure[] = [
  "equity",
  "convertible",
  "revenue_share",
  "hybrid"
];

export const INVESTMENT_STRUCTURE_LABELS: Record<InvestmentStructure, string> = {
  equity: "Equity",
  convertible: "Convertible Note",
  revenue_share: "Revenue Share",
  hybrid: "Hybrid",
};

// Outreach channels
export type OutreachChannel = "linkedin_dm" | "email" | "intro" | "cold_call" | "event" | "referral";

export const OUTREACH_CHANNEL_OPTIONS: OutreachChannel[] = [
  "linkedin_dm",
  "email",
  "intro",
  "cold_call",
  "event",
  "referral"
];

export const OUTREACH_CHANNEL_LABELS: Record<OutreachChannel, string> = {
  linkedin_dm: "LinkedIn DM",
  email: "Email",
  intro: "Introduction",
  cold_call: "Cold Call",
  event: "Event",
  referral: "Referral",
};

// Source types
export type ProspectSource = "linkedin" | "csv" | "referral" | "manual" | "event";

export const PROSPECT_SOURCE_OPTIONS: ProspectSource[] = [
  "linkedin",
  "csv",
  "referral",
  "manual",
  "event"
];

// Prospect interface (pipeline entity)
export interface Prospect {
  id: number;
  name: string;
  linkedinUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  firmName?: string | null;
  location?: string | null;
  source: string;
  sourceDetails?: string | null;
  stage: ProspectStage;
  
  // Outreach (Stage 2)
  outreachDate?: string | null;
  outreachChannel?: OutreachChannel | null;
  outreachOwner?: string | null;
  outreachMessageVersion?: string | null;
  outreachNotes?: string | null;
  
  // Connection (Stage 3)
  connectedDate?: string | null;
  warmth?: Warmth | null;
  relationshipStrength?: number | null; // 1-5
  introducerId?: number | null;
  connectionNotes?: string | null;
  
  // Interest (Stage 4)
  interestDate?: string | null;
  interestIndustries?: string | null;
  interestStages?: string | null;
  interestCheckMin?: number | null;
  interestCheckMax?: number | null;
  interestTrigger?: string | null;
  timelineAppetite?: string | null;
  interestNotes?: string | null;
  
  // Conversion (Stage 5)
  convertedToInvestorId?: number | null;
  convertedAt?: string | null;
  
  // Timestamps
  createdAt?: string | null;
  updatedAt?: string | null;
}

// API response format (snake_case from backend)
export interface ProspectApiResponse {
  id: number;
  name: string;
  linkedin_url?: string | null;
  email?: string | null;
  phone?: string | null;
  firm_name?: string | null;
  location?: string | null;
  source: string;
  source_details?: string | null;
  stage: ProspectStage;
  
  outreach_date?: string | null;
  outreach_channel?: string | null;
  outreach_owner?: string | null;
  outreach_message_version?: string | null;
  outreach_notes?: string | null;
  
  connected_date?: string | null;
  warmth?: string | null;
  relationship_strength?: number | null;
  introducer_id?: number | null;
  connection_notes?: string | null;
  
  interest_date?: string | null;
  interest_industries?: string | null;
  interest_stages?: string | null;
  interest_check_min?: number | null;
  interest_check_max?: number | null;
  interest_trigger?: string | null;
  timeline_appetite?: string | null;
  interest_notes?: string | null;
  
  converted_to_investor_id?: number | null;
  converted_at?: string | null;
  
  created_at?: string | null;
  updated_at?: string | null;
}

// Convert API response to frontend format
export function mapProspectFromApi(api: ProspectApiResponse): Prospect {
  return {
    id: api.id,
    name: api.name,
    linkedinUrl: api.linkedin_url,
    email: api.email,
    phone: api.phone,
    firmName: api.firm_name,
    location: api.location,
    source: api.source,
    sourceDetails: api.source_details,
    stage: api.stage,
    outreachDate: api.outreach_date,
    outreachChannel: api.outreach_channel as OutreachChannel | null,
    outreachOwner: api.outreach_owner,
    outreachMessageVersion: api.outreach_message_version,
    outreachNotes: api.outreach_notes,
    connectedDate: api.connected_date,
    warmth: api.warmth as Warmth | null,
    relationshipStrength: api.relationship_strength,
    introducerId: api.introducer_id,
    connectionNotes: api.connection_notes,
    interestDate: api.interest_date,
    interestIndustries: api.interest_industries,
    interestStages: api.interest_stages,
    interestCheckMin: api.interest_check_min,
    interestCheckMax: api.interest_check_max,
    interestTrigger: api.interest_trigger,
    timelineAppetite: api.timeline_appetite,
    interestNotes: api.interest_notes,
    convertedToInvestorId: api.converted_to_investor_id,
    convertedAt: api.converted_at,
    createdAt: api.created_at,
    updatedAt: api.updated_at,
  };
}

// Investment record
export interface Investment {
  id: number;
  company: string;
  round?: string | null;
  amountUsd?: number | null;
  date?: string | null;
  notes?: string | null;
}

// Social profile
export interface SocialProfile {
  id: number;
  platform: string;
  url?: string | null;
  handle?: string | null;
}

// Interaction record
export interface InvestorInteraction {
  id: number;
  when?: string | null;
  channel?: string | null;
  summary?: string | null;
}

// Full investor profile (extended from basic investor)
export interface InvestorProfile {
  id: number;
  legalName: string;
  email: string;
  phone?: string | null;
  country?: string | null;
  jurisdiction?: string | null;
  entityType?: string | null;
  createdAt?: string | null;
  
  // Firm
  firmId?: number | null;
  firmName?: string | null;
  
  // Preferences
  sectors?: string | null;
  stages?: string | null;
  checkMin?: number | null;
  checkMax?: number | null;
  structures?: string | null;
  horizon?: string | null;
  involvement?: string | null;
  
  // Strategic Layer
  strategicValue?: StrategicValue | null;
  lookingFor?: string | null;
  amountInvested?: number | null;
  amountCommitted?: number | null;
  investmentStructure?: InvestmentStructure | null;
  
  // Risk & Strategic Scores (1-10)
  riskScore?: number | null;
  strategicScore?: number | null;
  riskNotes?: string | null;
  strategicNotes?: string | null;
  strategicNotesExpanded?: string | null;
  
  // Relationship
  warmth?: Warmth | null;
  relationshipStrength?: number | null; // 1-5
  preferredContactMethod?: string | null;
  trustScore?: number | null;
  status?: string | null;
  lastContact?: string | null;
  
  // Bios
  publicBio?: string | null;
  adminNotes?: string | null;
  
  // Related data
  investments: Investment[];
  socialProfiles: SocialProfile[];
  recentInteractions: InvestorInteraction[];
  connectionCount: number;
}

// API response format for investor profile
export interface InvestorProfileApiResponse {
  id: number;
  legal_name: string;
  email: string;
  phone?: string | null;
  country?: string | null;
  jurisdiction?: string | null;
  entity_type?: string | null;
  created_at?: string | null;
  
  firm_id?: number | null;
  firm_name?: string | null;
  
  sectors?: string | null;
  stages?: string | null;
  check_min?: number | null;
  check_max?: number | null;
  structures?: string | null;
  horizon?: string | null;
  involvement?: string | null;
  
  strategic_value?: string | null;
  looking_for?: string | null;
  amount_invested?: number | null;
  amount_committed?: number | null;
  investment_structure?: string | null;
  
  risk_score?: number | null;
  strategic_score?: number | null;
  risk_notes?: string | null;
  strategic_notes?: string | null;
  strategic_notes_expanded?: string | null;
  
  warmth?: string | null;
  relationship_strength?: number | null;
  preferred_contact_method?: string | null;
  trust_score?: number | null;
  status?: string | null;
  last_contact?: string | null;
  
  public_bio?: string | null;
  admin_notes?: string | null;
  
  investments: Array<{
    id: number;
    company: string;
    round?: string | null;
    amount_usd?: number | null;
    date?: string | null;
    notes?: string | null;
  }>;
  social_profiles: Array<{
    id: number;
    platform: string;
    url?: string | null;
    handle?: string | null;
  }>;
  recent_interactions: Array<{
    id: number;
    when?: string | null;
    channel?: string | null;
    summary?: string | null;
  }>;
  connection_count: number;
}

// Convert API response to frontend format
export function mapInvestorProfileFromApi(api: InvestorProfileApiResponse): InvestorProfile {
  return {
    id: api.id,
    legalName: api.legal_name,
    email: api.email,
    phone: api.phone,
    country: api.country,
    jurisdiction: api.jurisdiction,
    entityType: api.entity_type,
    createdAt: api.created_at,
    firmId: api.firm_id,
    firmName: api.firm_name,
    sectors: api.sectors,
    stages: api.stages,
    checkMin: api.check_min,
    checkMax: api.check_max,
    structures: api.structures,
    horizon: api.horizon,
    involvement: api.involvement,
    strategicValue: api.strategic_value as StrategicValue | null,
    lookingFor: api.looking_for,
    amountInvested: api.amount_invested,
    amountCommitted: api.amount_committed,
    investmentStructure: api.investment_structure as InvestmentStructure | null,
    riskScore: api.risk_score,
    strategicScore: api.strategic_score,
    riskNotes: api.risk_notes,
    strategicNotes: api.strategic_notes,
    strategicNotesExpanded: api.strategic_notes_expanded,
    warmth: api.warmth as Warmth | null,
    relationshipStrength: api.relationship_strength,
    preferredContactMethod: api.preferred_contact_method,
    trustScore: api.trust_score,
    status: api.status,
    lastContact: api.last_contact,
    publicBio: api.public_bio,
    adminNotes: api.admin_notes,
    investments: api.investments.map(inv => ({
      id: inv.id,
      company: inv.company,
      round: inv.round,
      amountUsd: inv.amount_usd,
      date: inv.date,
      notes: inv.notes,
    })),
    socialProfiles: api.social_profiles.map(sp => ({
      id: sp.id,
      platform: sp.platform,
      url: sp.url,
      handle: sp.handle,
    })),
    recentInteractions: api.recent_interactions.map(i => ({
      id: i.id,
      when: i.when,
      channel: i.channel,
      summary: i.summary,
    })),
    connectionCount: api.connection_count,
  };
}

// Graph types for relationship visualization
export interface GraphNode {
  id: string;
  type: "investor" | "prospect" | "company";
  name: string;
  label?: string;
  connections: number;
  // Visual properties
  size?: number;
  color?: string;
  // Additional data
  warmth?: Warmth;
  stage?: ProspectStage;
  riskScore?: number;
  strategicScore?: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  kind: string; // connection | co-invest | advisor | board | employer | intro
  weight: number;
  label?: string;
  relationshipType?: "direct" | "mutual" | "inferred";
  mutualConnectionCount?: number;
  lastInteractionDate?: string | null;
}

export interface InvestorGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  // Computed properties
  clusters?: GraphCluster[];
  hubs?: GraphHub[];
}

export interface GraphCluster {
  id: string;
  name: string;
  type: "industry" | "geography" | "firm";
  nodeIds: string[];
  size: number;
}

export interface GraphHub {
  nodeId: string;
  name: string;
  connectionCount: number;
  influenceScore: number;
}

export interface WarmPath {
  from: GraphNode;
  to: GraphNode;
  path: GraphNode[];
  edges: GraphEdge[];
  totalWeight: number;
  hops: number;
}

// Prospect stats
export interface ProspectStats {
  stageCounts: Record<ProspectStage, number>;
  warmthCounts: Record<Warmth, number>;
  sourceCounts: Record<string, number>;
  total: number;
  recentCreated: number;
  recentConverted: number;
}

// Paginated response
export interface PaginatedProspects {
  prospects: Prospect[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  stageCounts: Record<ProspectStage, number>;
}

// Filter options
export interface ProspectFilters {
  stage?: ProspectStage;
  source?: string;
  warmth?: Warmth;
  owner?: string;
  search?: string;
  page?: number;
  perPage?: number;
}
