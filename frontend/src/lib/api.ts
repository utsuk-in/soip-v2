const API_BASE =
  (import.meta as any).env?.VITE_API_BASE || "http://localhost:8000";

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

export async function register(email: string, password: string): Promise<TokenResponse> {
  return request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
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
  degree_type: string | null;
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
  degree_type?: string;
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
  source_url: string;
  confidence: number | null;
  is_active: boolean;
  created_at: string | null;
}

export interface BrowseParams {
  category?: string;
  domain?: string;
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

export async function browseOpportunities(params: BrowseParams = {}): Promise<OpportunityListResponse> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  return request(`/api/opportunities?${qs}`);
}

export async function getOpportunity(id: string): Promise<Opportunity> {
  return request(`/api/opportunities/${id}`);
}

export async function getRecommended(limit = 10): Promise<Opportunity[]> {
  return request(`/api/opportunities/recommended?limit=${limit}`);
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
