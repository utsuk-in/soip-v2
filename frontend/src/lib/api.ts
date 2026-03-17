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
  return sessionStorage.getItem("soip_admin_token") || localStorage.getItem("soip_token");
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
    const wasAdmin = !!sessionStorage.getItem("soip_admin_token");
    sessionStorage.removeItem("soip_admin_token");
    localStorage.removeItem("soip_token");
    window.location.href = wasAdmin ? "/admin/login" : "/login";
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
  role: string;
  department: string | null;
  roll_number: string | null;
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
  password?: string;
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
  relevance_explanation?: string | null;
  url: string;
  application_url?: string;
  application_link?: string;
  source_url: string;
  confidence: number | null;
  is_active: boolean;
  created_at: string | null;
  location?: string;
  mode?: string;
  state?: string | null;
  start_date?: string | null;
  fee_type?: string | null;
  organizer?: string | null;
}

export interface BrowseParams {
  category?: string | string[];
  domain?: string | string[];
  location?: string | string[];
  mode?: string;
  state?: string;
  search?: string;
  deadline_before?: string;
  deadline_after?: string;
  sort?: string;
  active_only?: boolean;
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

export async function getOpportunityStats(): Promise<Record<string, number>> {
  return request("/api/opportunities/stats");
}

export async function searchOpportunities(q: string, limit = 20): Promise<Opportunity[]> {
  const qs = new URLSearchParams({ q, limit: String(limit) });
  const res = await request<Opportunity[]>(`/api/opportunities/search?${qs}`);
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

// --- Universities ---

export interface University {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
}

export async function getUniversities(search?: string): Promise<University[]> {
  const qs = search ? `?name=${encodeURIComponent(search)}` : "";
  return request(`/api/users/universities${qs}`);
}

// --- Admin ---

async function requestFormData<T>(path: string, formData: FormData): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers,
    body: formData,
  });

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

export interface AdminRegisterData {
  email: string;
  password: string;
  first_name: string;
  invite_code: string;
  university_id: string;
}

export async function adminRegister(data: AdminRegisterData): Promise<TokenResponse> {
  return request("/api/admin/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function redeemMagicLink(token: string): Promise<TokenResponse> {
  return request(`/api/auth/magic-link?token=${encodeURIComponent(token)}`);
}

// --- Admin Student Upload ---

export interface StudentRow {
  row_number: number;
  name: string;
  email: string;
  roll_number: string | null;
  department: string | null;
  year_of_study: string | null;
}

export interface RowError {
  row_number: number;
  field: string;
  message: string;
}

export interface UploadValidationResponse {
  valid_rows: StudentRow[];
  errors: RowError[];
  duplicates: string[];
  total_rows: number;
}

export interface MagicLinkResult {
  student_id: string;
  email: string;
  magic_token: string;
  magic_link_url: string;
}

export interface UploadSummary {
  total: number;
  invited: number;
  failed: number;
  duplicate_skipped: number;
  invited_students: MagicLinkResult[];
}

export async function validateStudentUpload(file: File): Promise<UploadValidationResponse> {
  const fd = new FormData();
  fd.append("file", file);
  return requestFormData("/api/admin/students/validate", fd);
}

export async function confirmStudentUpload(students: StudentRow[]): Promise<UploadSummary> {
  return request("/api/admin/students/upload", {
    method: "POST",
    body: JSON.stringify({ students }),
  });
}

export async function downloadTemplate(format: "xlsx" | "csv" = "xlsx"): Promise<void> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/api/admin/students/template?format=${format}`, { headers });
  if (!res.ok) throw new Error("Failed to download template");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `student_upload_template.${format}`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function resendInvite(studentId: string): Promise<MagicLinkResult> {
  return request(`/api/admin/students/${studentId}/resend-invite`, { method: "POST" });
}

export interface BulkResendSummary {
  results: MagicLinkResult[];
  skipped_onboarded: number;
  failed: number;
}

export interface BulkRemoveSummary {
  removed: number;
}

export async function bulkResendInvite(studentIds: string[]): Promise<BulkResendSummary> {
  return request("/api/admin/students/bulk-resend", {
    method: "POST",
    body: JSON.stringify({ student_ids: studentIds }),
  });
}

export async function bulkRemoveStudents(studentIds: string[]): Promise<BulkRemoveSummary> {
  return request("/api/admin/students/bulk", {
    method: "DELETE",
    body: JSON.stringify({ student_ids: studentIds }),
  });
}

// --- Admin Dashboard ---

export interface DashboardMetrics {
  total_invited: number;
  total_activated: number;
  activation_rate: number;
  total_views: number;
  total_applications: number;
}

export interface StudentListItem {
  id: string;
  first_name: string | null;
  email: string;
  department: string | null;
  year_of_study: string | null;
  roll_number: string | null;
  is_onboarded: boolean;
  is_active: boolean;
  last_login_at: string | null;
  invited_at: string | null;
  created_at: string | null;
  /** "valid" | "expired" | "used" | null */
  invite_token_status: string | null;
}

export interface StudentListResponse {
  items: StudentListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface StudentActivityData {
  total_views: number;
  total_logins: number;
  recent_activity: { action: string; created_at: string; opportunity_title?: string }[];
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  return request("/api/admin/dashboard/metrics");
}

export interface StudentListParams {
  page?: number;
  search?: string;
  status?: string;
  name?: string;
  email?: string;
  department?: string;
  year_of_study?: string;
}

export async function getStudentList(params: StudentListParams = {}): Promise<StudentListResponse> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.search) qs.set("search", params.search);
  if (params.status) qs.set("status_filter", params.status);
  if (params.name) qs.set("name", params.name);
  if (params.email) qs.set("email", params.email);
  if (params.department) qs.set("department", params.department);
  if (params.year_of_study) qs.set("year_of_study", params.year_of_study);
  return request(`/api/admin/students?${qs}`);
}

export async function getFilterOptions(field: string): Promise<string[]> {
  return request(`/api/admin/students/filter-options?field=${encodeURIComponent(field)}`);
}

export async function getStudentActivity(studentId: string): Promise<StudentActivityData> {
  return request(`/api/admin/students/${studentId}/activity`);
}

export async function removeStudent(studentId: string): Promise<void> {
  await request(`/api/admin/students/${studentId}`, { method: "DELETE" });
}

// --- Admin Engagement ---

export interface EngagementReport {
  top_opportunities: { opportunity_id: string; title: string; view_count: number }[];
  category_breakdown: { category: string; count: number }[];
  engagement_distribution: { bucket: string; count: number }[];
  weekly_trends: { week: string; interactions: number }[];
  magic_link_stats: { total_sent: number; total_used: number; open_rate: number };
}

export async function getEngagementReport(weeks = 8): Promise<EngagementReport> {
  return request(`/api/admin/engagement?weeks=${weeks}`);
}
