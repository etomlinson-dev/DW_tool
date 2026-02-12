import axios from "axios";
import type {
  Prospect,
  ProspectApiResponse,
  ProspectFilters,
  ProspectStage,
  ProspectStats,
  InvestorProfile,
  InvestorProfileApiResponse,
  InvestorGraph,
  WarmPath,
  GraphCluster,
  GraphHub,
  Warmth,
  OutreachChannel,
} from "../types/kyi";
import { mapProspectFromApi, mapInvestorProfileFromApi } from "../types/kyi";

// API base URL - uses /kyi prefix for KYI backend
const KYI_API_BASE = "/api/kyi";

const api = axios.create({
  baseURL: KYI_API_BASE,
  headers: {
    "Content-Type": "application/json",
  },
});

// ============================================================================
// PROSPECTS API (Pipeline)
// ============================================================================

export interface ProspectsListResponse {
  prospects: Prospect[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  stageCounts: Record<ProspectStage, number>;
}

export const prospectsApi = {
  /**
   * Get all prospects with optional filtering
   */
  getProspects: async (filters?: ProspectFilters): Promise<ProspectsListResponse> => {
    const params = new URLSearchParams();
    if (filters?.stage) params.append("stage", filters.stage);
    if (filters?.source) params.append("source", filters.source);
    if (filters?.warmth) params.append("warmth", filters.warmth);
    if (filters?.owner) params.append("owner", filters.owner);
    if (filters?.search) params.append("search", filters.search);
    if (filters?.page) params.append("page", filters.page.toString());
    if (filters?.perPage) params.append("per_page", filters.perPage.toString());

    try {
      const response = await api.get<{
        prospects: ProspectApiResponse[];
        total: number;
        page: number;
        per_page: number;
        total_pages: number;
        stage_counts: Record<ProspectStage, number>;
      }>(`/prospects?${params}`);

      return {
        prospects: response.data.prospects.map(mapProspectFromApi),
        total: response.data.total,
        page: response.data.page,
        perPage: response.data.per_page,
        totalPages: response.data.total_pages,
        stageCounts: response.data.stage_counts,
      };
    } catch (err) {
      // Return empty data if API not available
      console.error("Failed to fetch prospects:", err);
      return {
        prospects: [],
        total: 0,
        page: 1,
        perPage: 20,
        totalPages: 0,
        stageCounts: { discovered: 0, outreached: 0, connected: 0, interested: 0, investor: 0 },
      };
    }
  },

  /**
   * Get a single prospect by ID
   */
  getProspect: async (id: number): Promise<Prospect> => {
    const response = await api.get<ProspectApiResponse>(`/prospects/${id}`);
    return mapProspectFromApi(response.data);
  },

  /**
   * Create a new prospect (Stage 1: Discovery)
   */
  createProspect: async (data: {
    name: string;
    linkedinUrl?: string;
    email?: string;
    phone?: string;
    firmName?: string;
    location?: string;
    source?: string;
    sourceDetails?: Record<string, unknown>;
  }): Promise<Prospect> => {
    const response = await api.post<ProspectApiResponse>("/prospects", {
      name: data.name,
      linkedin_url: data.linkedinUrl,
      email: data.email,
      phone: data.phone,
      firm_name: data.firmName,
      location: data.location,
      source: data.source,
      source_details: data.sourceDetails,
    });
    return mapProspectFromApi(response.data);
  },

  /**
   * Update prospect details
   */
  updateProspect: async (
    id: number,
    data: Partial<{
      name: string;
      linkedinUrl: string;
      email: string;
      phone: string;
      firmName: string;
      location: string;
      outreachNotes: string;
      connectionNotes: string;
      interestNotes: string;
      warmth: Warmth;
      relationshipStrength: number;
      outreachChannel: OutreachChannel;
      outreachOwner: string;
      interestIndustries: string;
      interestStages: string;
      interestCheckMin: number;
      interestCheckMax: number;
      interestTrigger: string;
      timelineAppetite: string;
    }>
  ): Promise<Prospect> => {
    const response = await api.put<ProspectApiResponse>(`/prospects/${id}`, {
      name: data.name,
      linkedin_url: data.linkedinUrl,
      email: data.email,
      phone: data.phone,
      firm_name: data.firmName,
      location: data.location,
      outreach_notes: data.outreachNotes,
      connection_notes: data.connectionNotes,
      interest_notes: data.interestNotes,
      warmth: data.warmth,
      relationship_strength: data.relationshipStrength,
      outreach_channel: data.outreachChannel,
      outreach_owner: data.outreachOwner,
      interest_industries: data.interestIndustries,
      interest_stages: data.interestStages,
      interest_check_min: data.interestCheckMin,
      interest_check_max: data.interestCheckMax,
      interest_trigger: data.interestTrigger,
      timeline_appetite: data.timelineAppetite,
    });
    return mapProspectFromApi(response.data);
  },

  /**
   * Delete a prospect
   */
  deleteProspect: async (id: number): Promise<void> => {
    await api.delete(`/prospects/${id}`);
  },

  /**
   * Advance prospect to next stage with stage-specific data
   */
  advanceStage: async (
    id: number,
    stage: ProspectStage,
    data?: {
      // Outreach stage data
      outreachChannel?: OutreachChannel;
      outreachOwner?: string;
      outreachMessageVersion?: string;
      outreachNotes?: string;
      // Connection stage data
      warmth?: Warmth;
      relationshipStrength?: number;
      introducerId?: number;
      connectionNotes?: string;
      // Interest stage data
      interestIndustries?: string;
      interestStages?: string;
      interestCheckMin?: number;
      interestCheckMax?: number;
      interestTrigger?: string;
      timelineAppetite?: string;
      interestNotes?: string;
    }
  ): Promise<Prospect> => {
    const response = await api.put<ProspectApiResponse>(`/prospects/${id}/stage`, {
      stage,
      outreach_channel: data?.outreachChannel,
      outreach_owner: data?.outreachOwner,
      outreach_message_version: data?.outreachMessageVersion,
      outreach_notes: data?.outreachNotes,
      warmth: data?.warmth,
      relationship_strength: data?.relationshipStrength,
      introducer_id: data?.introducerId,
      connection_notes: data?.connectionNotes,
      interest_industries: data?.interestIndustries,
      interest_stages: data?.interestStages,
      interest_check_min: data?.interestCheckMin,
      interest_check_max: data?.interestCheckMax,
      interest_trigger: data?.interestTrigger,
      timeline_appetite: data?.timelineAppetite,
      interest_notes: data?.interestNotes,
    });
    return mapProspectFromApi(response.data);
  },

  /**
   * Convert prospect to full investor (Stage 5)
   */
  convertToInvestor: async (
    id: number,
    data?: {
      strategicValue?: string;
      lookingFor?: string;
      amountInvested?: number;
      amountCommitted?: number;
      investmentStructure?: string;
      riskScore?: number;
      strategicScore?: number;
      riskNotes?: string;
      strategicNotesExpanded?: string;
      preferredContactMethod?: string;
    }
  ): Promise<{ success: boolean; investorId: number; prospect: Prospect }> => {
    const response = await api.post<{
      success: boolean;
      investor_id: number;
      prospect: ProspectApiResponse;
      message: string;
    }>(`/prospects/${id}/convert`, {
      strategic_value: data?.strategicValue,
      looking_for: data?.lookingFor,
      amount_invested: data?.amountInvested,
      amount_committed: data?.amountCommitted,
      investment_structure: data?.investmentStructure,
      risk_score: data?.riskScore,
      strategic_score: data?.strategicScore,
      risk_notes: data?.riskNotes,
      strategic_notes_expanded: data?.strategicNotesExpanded,
      preferred_contact_method: data?.preferredContactMethod,
    });
    return {
      success: response.data.success,
      investorId: response.data.investor_id,
      prospect: mapProspectFromApi(response.data.prospect),
    };
  },

  /**
   * Import prospects from LinkedIn CSV
   */
  importLinkedInCSV: async (
    file: File
  ): Promise<{
    success: boolean;
    created: number;
    skipped: number;
    errors: string[];
    totalErrors: number;
  }> => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await api.post<{
      success: boolean;
      created: number;
      skipped: number;
      errors: string[];
      total_errors: number;
    }>("/prospects/import-csv", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    return {
      success: response.data.success,
      created: response.data.created,
      skipped: response.data.skipped,
      errors: response.data.errors,
      totalErrors: response.data.total_errors,
    };
  },

  /**
   * Get prospect pipeline statistics
   */
  getStats: async (): Promise<ProspectStats> => {
    try {
      const response = await api.get<{
        stage_counts: Record<ProspectStage, number>;
        warmth_counts: Record<Warmth, number>;
        source_counts: Record<string, number>;
        total: number;
        recent_created: number;
        recent_converted: number;
      }>("/prospects/stats");

      return {
        stageCounts: response.data.stage_counts,
        warmthCounts: response.data.warmth_counts,
        sourceCounts: response.data.source_counts,
        total: response.data.total,
        recentCreated: response.data.recent_created,
        recentConverted: response.data.recent_converted,
      };
    } catch (err) {
      // Return empty stats if API not available
      console.error("Failed to fetch prospect stats:", err);
      return {
        stageCounts: { discovered: 0, outreached: 0, connected: 0, interested: 0, investor: 0 },
        warmthCounts: { cold: 0, warm: 0, trusted: 0 },
        sourceCounts: {},
        total: 0,
        recentCreated: 0,
        recentConverted: 0,
      };
    }
  },
};

// ============================================================================
// INVESTORS API (Full Profiles)
// ============================================================================

export interface InvestorListItem {
  id: number;
  legalName: string;
  email: string;
  firmName?: string | null;
  warmth?: Warmth | null;
  relationshipStrength?: number | null;
  amountInvested?: number | null;
  amountCommitted?: number | null;
  strategicValue?: string | null;
  status?: string | null;
  lastContact?: string | null;
  createdAt?: string | null;
}

export interface InvestorsListResponse {
  investors: InvestorListItem[];
  total: number;
  page: number;
  perPage: number;
}

export const investorsApi = {
  /**
   * Get list of all investors
   */
  getInvestors: async (filters?: {
    search?: string;
    warmth?: Warmth;
    page?: number;
    perPage?: number;
  }): Promise<InvestorsListResponse> => {
    const params = new URLSearchParams();
    if (filters?.search) params.append("search", filters.search);
    if (filters?.warmth) params.append("warmth", filters.warmth);
    if (filters?.page) params.append("page", filters.page.toString());
    if (filters?.perPage) params.append("per_page", filters.perPage.toString());

    try {
      const response = await api.get<{
        investors: Array<{
          id: number;
          legal_name: string;
          email: string;
          firm_name?: string | null;
          warmth?: string | null;
          relationship_strength?: number | null;
          amount_invested?: number | null;
          amount_committed?: number | null;
          strategic_value?: string | null;
          status?: string | null;
          last_contact?: string | null;
          created_at?: string | null;
        }>;
        total: number;
        page: number;
        per_page: number;
      }>(`/investors?${params}`);

      return {
        investors: response.data.investors.map((inv) => ({
          id: inv.id,
          legalName: inv.legal_name,
          email: inv.email,
          firmName: inv.firm_name,
          warmth: inv.warmth as Warmth | null,
          relationshipStrength: inv.relationship_strength,
          amountInvested: inv.amount_invested,
          amountCommitted: inv.amount_committed,
          strategicValue: inv.strategic_value,
          status: inv.status,
          lastContact: inv.last_contact,
          createdAt: inv.created_at,
        })),
        total: response.data.total,
        page: response.data.page,
        perPage: response.data.per_page,
      };
    } catch (err) {
      // Return empty data if API not available
      console.error("Failed to fetch investors:", err);
      return {
        investors: [],
        total: 0,
        page: 1,
        perPage: 20,
      };
    }
  },

  /**
   * Get complete investor profile with all KYI data
   */
  getFullProfile: async (id: number): Promise<InvestorProfile> => {
    const response = await api.get<InvestorProfileApiResponse>(`/investors/${id}/full-profile`);
    return mapInvestorProfileFromApi(response.data);
  },

  /**
   * Update investor's strategic layer
   */
  updateStrategic: async (
    id: number,
    data: {
      strategicValue?: string;
      lookingFor?: string;
      amountInvested?: number;
      amountCommitted?: number;
      investmentStructure?: string;
      strategicNotes?: string;
      strategicNotesExpanded?: string;
    }
  ): Promise<{ success: boolean }> => {
    const response = await api.put<{ success: boolean }>(`/investors/${id}/strategic`, {
      strategic_value: data.strategicValue,
      looking_for: data.lookingFor,
      amount_invested: data.amountInvested,
      amount_committed: data.amountCommitted,
      investment_structure: data.investmentStructure,
      strategic_notes: data.strategicNotes,
      strategic_notes_expanded: data.strategicNotesExpanded,
    });
    return response.data;
  },

  /**
   * Update investor's risk and strategic scores
   */
  updateRiskAssessment: async (
    id: number,
    data: {
      riskScore?: number;
      strategicScore?: number;
      riskNotes?: string;
      strategicNotesExpanded?: string;
    }
  ): Promise<{ success: boolean; riskScore: number; strategicScore: number }> => {
    const response = await api.put<{
      success: boolean;
      risk_score: number;
      strategic_score: number;
    }>(`/investors/${id}/risk-assessment`, {
      risk_score: data.riskScore,
      strategic_score: data.strategicScore,
      risk_notes: data.riskNotes,
      strategic_notes_expanded: data.strategicNotesExpanded,
    });
    return {
      success: response.data.success,
      riskScore: response.data.risk_score,
      strategicScore: response.data.strategic_score,
    };
  },

  /**
   * Update investor's relationship warmth
   */
  updateWarmth: async (
    id: number,
    data: {
      warmth?: Warmth;
      relationshipStrength?: number;
      preferredContactMethod?: string;
    }
  ): Promise<{ success: boolean; warmth: Warmth; relationshipStrength: number }> => {
    const response = await api.put<{
      success: boolean;
      warmth: Warmth;
      relationship_strength: number;
    }>(`/investors/${id}/warmth`, {
      warmth: data.warmth,
      relationship_strength: data.relationshipStrength,
      preferred_contact_method: data.preferredContactMethod,
    });
    return {
      success: response.data.success,
      warmth: response.data.warmth,
      relationshipStrength: response.data.relationship_strength,
    };
  },
};

// ============================================================================
// GRAPH API (Relationship Intelligence)
// ============================================================================

export const graphApi = {
  /**
   * Get relationship graph for an investor
   */
  getInvestorGraph: async (investorId: number): Promise<InvestorGraph> => {
    const response = await api.get<InvestorGraph>(`/graph/investor/${investorId}`);
    return response.data;
  },

  /**
   * Find warm paths between two investors
   */
  findWarmPaths: async (fromId: number, toId: number): Promise<WarmPath[]> => {
    const response = await api.get<WarmPath[]>(`/graph/paths/${fromId}/${toId}`);
    return response.data;
  },

  /**
   * Get investor clusters by industry/geography
   */
  getClusters: async (): Promise<GraphCluster[]> => {
    const response = await api.get<GraphCluster[]>("/graph/clusters");
    return response.data;
  },

  /**
   * Get influence hubs (high connection count investors)
   */
  getHubs: async (): Promise<GraphHub[]> => {
    const response = await api.get<GraphHub[]>("/graph/hubs");
    return response.data;
  },

  /**
   * Import LinkedIn connections CSV to build graph
   */
  importLinkedInConnections: async (
    investorId: number,
    file: File
  ): Promise<{ success: boolean; edgesCreated: number }> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("investor_id", investorId.toString());

    const response = await api.post<{
      success: boolean;
      edges_created: number;
    }>("/graph/linkedin-import", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    return {
      success: response.data.success,
      edgesCreated: response.data.edges_created,
    };
  },
};

// Combined export for convenience
export const kyiApi = {
  prospects: prospectsApi,
  investors: investorsApi,
  graph: graphApi,
};

export default kyiApi;
