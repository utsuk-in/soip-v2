declare global {
  interface Window {
    __SOIP_CONFIG__?: {
      API_BASE?: string;
    };
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

const runtimeApiBase =
  typeof window !== "undefined" ? window.__SOIP_CONFIG__?.API_BASE : undefined;

const API_BASE = normalizeBaseUrl(
  runtimeApiBase ||
    (import.meta as any).env?.VITE_API_BASE ||
    "http://localhost:8000"
);

function getToken(): string | null {
  return localStorage.getItem("soip_token");
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem("soip_token");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }

  return res.json();
}

// --- Auth ---

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface RegisterData {
  email: string;
  password: string;
  first_name: string;
  academic_background: string;
  year_of_study: string;
  state: string;
  skills: string[];
  interests: string[];
  aspirations: string[];
  university_id?: string | null;
}

export async function register(data: RegisterData): Promise<TokenResponse> {
  return request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function login(email: string, password: string): Promise<TokenResponse> {
  return request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export interface User {
  id: string;
  email: string;
  first_name: string | null;
  academic_background: string | null;
  year_of_study: string | null;
  state: string | null;
  skills: string[];
  interests: string[];
  aspirations: string[];
  university_id: string | null;
  is_onboarded: boolean;
}

export async function getMe(): Promise<User> {
  return request("/api/auth/me");
}

// --- Profile ---

export interface ProfileUpdate {
  first_name?: string;
  academic_background?: string;
  year_of_study?: string;
  state?: string;
  skills?: string[];
  interests?: string[];
  aspirations?: string[];
}

export async function updateProfile(data: ProfileUpdate): Promise<User> {
  return request("/api/users/profile", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// --- Opportunities ---

export interface Opportunity {
  id: string;
  title: string;
  description: string;
  category: string;
  domain_tags: string[];
  eligibility: string | null;
  benefits: string | null;
  deadline: string | null;
  url: string;
  application_url?: string;
  application_link?: string;
  source_url: string;
  confidence: number | null;
  is_active: boolean;
  created_at: string | null;
}

export interface BrowseParams {
  category?: string | string[];
  domain?: string | string[];
  location?: string | string[];
  mode?: string;
  search?: string;
  deadline_before?: string;
  deadline_after?: string;
  sort?: string;
  page?: number;
  page_size?: number;
}

export interface OpportunityListResponse {
  items: Opportunity[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

function normalizeOpportunity(raw: any): Opportunity {
  const applicationUrl =
    raw.application_url || raw.application_link || raw.url || "";
  return {
    ...raw,
    url: applicationUrl,
    application_url: raw.application_url,
    application_link: raw.application_link,
  };
}

export async function browseOpportunities(params: BrowseParams = {}): Promise<OpportunityListResponse> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) {
      if (v.length > 0) qs.set(k, v.join(","));
      continue;
    }
    qs.set(k, String(v));
  }
  const res = await request<OpportunityListResponse>(`/api/opportunities?${qs}`);
  return { ...res, items: res.items.map(normalizeOpportunity) };
}

export async function getOpportunity(id: string): Promise<Opportunity> {
  const res = await request<Opportunity>(`/api/opportunities/${id}`);
  return normalizeOpportunity(res);
}

export async function getRecommended(limit = 10): Promise<Opportunity[]> {
  const res = await request<Opportunity[]>(`/api/opportunities/recommended?limit=${limit}`);
  return res.map(normalizeOpportunity);
}

// --- Chat ---

export interface ChatMessage {
  id: string;
  role: string;
  content: string;
  cited_opportunity_ids: string[];
  created_at: string | null;
}

export interface ChatResponseData {
  message: ChatMessage;
  cited_opportunities: Opportunity[];
  session_id: string;
}

export interface ChatSession {
  id: string;
  title: string | null;
  created_at: string | null;
}

export interface ChatSessionDetail {
  session: ChatSession;
  messages: ChatMessage[];
}

export async function sendChatMessage(
  message: string,
  sessionId?: string
): Promise<ChatResponseData> {
  return request("/api/chat", {
    method: "POST",
    body: JSON.stringify({ message, session_id: sessionId }),
  });
}

export async function getChatSessions(): Promise<ChatSession[]> {
  return request("/api/chat/sessions");
}

export async function getChatSession(id: string): Promise<ChatSessionDetail> {
  return request(`/api/chat/sessions/${id}`);
}

// --- Alerts ---

export interface Alert {
  id: string;
  opportunity_id: string;
  reason: string;
  is_read: boolean;
  created_at: string;
}

export async function getAlerts(): Promise<Alert[]> {
  return request("/api/alerts");
}

export async function markAlertRead(id: string): Promise<Alert> {
  return request(`/api/alerts/${id}/read`, { method: "PUT" });
}
