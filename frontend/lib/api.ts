import axios from "axios";
import Cookies from "js-cookie";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

export const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = Cookies.get("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      Cookies.remove("access_token");
      Cookies.remove("user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

// ── Auth ──
export const authApi = {
  register: (data: object) => api.post("/auth/register", data),
  login: (data: object) => api.post("/auth/login", data),
  refreshToken: () => api.post("/auth/refresh", {}),
  me: () => api.get("/auth/me"),
  invite: (data: object) => api.post("/auth/invite", data),
  forgotPassword: (data: object) => api.post("/auth/forgot-password", data),
  resetPassword: (data: object) => api.post("/auth/reset-password", data),
};

// ── Org ──
export const orgApi = {
  get: () => api.get("/org/"),
  update: (data: object) => api.patch("/org/", data),
  uploadLogo: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post("/org/logo", form, { headers: { "Content-Type": "multipart/form-data" } });
  },
  getLogoUrl: () => api.get("/org/logo/url"),
};

// ── Employees ──
export const employeesApi = {
  list: (params?: object) => api.get("/employees/", { params }),
  get: (id: string) => api.get(`/employees/${id}`),
  create: (data: object) => api.post("/employees/", data),
  update: (id: string, data: object) => api.patch(`/employees/${id}`, data),
  archive: (id: string) => api.delete(`/employees/${id}`),
  importCsv: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post("/employees/import/csv", form, { headers: { "Content-Type": "multipart/form-data" } });
  },
};

// ── Attendance ──
export const attendanceApi = {
  previewCsv: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post("/attendance/upload/preview", form, { headers: { "Content-Type": "multipart/form-data" } });
  },
  commitCsv: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post("/attendance/upload/commit", form, { headers: { "Content-Type": "multipart/form-data" } });
  },
  markManual: (data: object) => api.post("/attendance/manual", data),
  getByEmployee: (id: string, params?: object) => api.get(`/attendance/employee/${id}`, { params }),
  summary: (month: number, year: number) => api.get("/attendance/summary", { params: { month, year } }),
};

// ── Leaves ──
export const leavesApi = {
  listTypes: () => api.get("/leaves/types"),
  createType: (data: object) => api.post("/leaves/types", data),
  initBalances: (year: number) => api.post("/leaves/balances/initialize", null, { params: { year } }),
  getBalances: (employeeId: string, year: number) =>
    api.get(`/leaves/balances/${employeeId}`, { params: { year } }),
  updateBalance: (id: string, params: { total_days?: number; adjustment?: number }) =>
    api.patch(`/leaves/balances/${id}`, null, { params }),
  listRequests: (params?: object) => api.get("/leaves/requests", { params }),
  createRequest: (data: object) => api.post("/leaves/requests", data),
  reviewRequest: (id: string, data: object) => api.post(`/leaves/requests/${id}/review`, data),
};

// ── Payroll ──
export const payrollApi = {
  listRuns: () => api.get("/payroll/runs"),
  getRun: (id: string) => api.get(`/payroll/runs/${id}`),
  createRun: (data: object) => api.post("/payroll/runs", data),
  lockRun: (id: string) => api.post(`/payroll/runs/${id}/lock`),
};

// ── Payslips ──
export const payslipsApi = {
  generate: (id: string) => api.post(`/payslips/${id}/generate`),
  getDownloadUrl: (id: string) => api.get(`/payslips/${id}/download-url`),
  generateAll: (runId: string) => api.post(`/payslips/run/${runId}/generate-all`),
  downloadZip: (runId: string) => api.get(`/payslips/run/${runId}/download-zip`, { responseType: "blob" }),
};

// ── Employee Self-Service ──
export const meApi = {
  getProfile: () => api.get("/me/profile"),
  updateProfile: (data: object) => api.patch("/me/profile", data),
  getAttendance: (params?: { month?: number; year?: number }) => api.get("/me/attendance", { params }),
  getLeaveBalances: (year: number) => api.get("/me/leaves/balances", { params: { year } }),
  getLeaveRequests: (params?: { status?: string }) => api.get("/me/leaves/requests", { params }),
  applyLeave: (data: object) => api.post("/me/leaves/requests", data),
  getPayslips: () => api.get("/me/payslips"),
  getDocuments: () => api.get("/me/documents"),
  requestDocument: (data: object) => api.post("/me/documents", data),
};

// ── Documents & Letters ──
export const documentsApi = {
  seedTemplates: () => api.post("/documents/templates/seed"),
  listTemplates: () => api.get("/documents/templates"),
  createTemplate: (data: object) => api.post("/documents/templates", data),
  updateTemplate: (id: string, data: object) => api.patch(`/documents/templates/${id}`, data),
  list: (params?: { employee_id?: string; status?: string }) => api.get("/documents/", { params }),
  create: (data: object) => api.post("/documents/", data),
  issue: (id: string, data: object) => api.post(`/documents/${id}/issue`, data),
  getDownloadUrl: (id: string) => api.get(`/documents/${id}/download`),
};

// ── Onboarding ──
export const onboardingApi = {
  listTemplates: () => api.get("/onboarding/templates"),
  createTemplate: (data: object) => api.post("/onboarding/templates", data),
  listTasks: (params?: { employee_id?: string; status?: string }) => api.get("/onboarding/tasks", { params }),
  updateTask: (id: string, data: { status: string }) => api.patch(`/onboarding/tasks/${id}`, data),
};

// ── Offboarding ──
export const offboardingApi = {
  initiate: (data: object) => api.post("/offboarding/", data),
  list: (params?: { status?: string }) => api.get("/offboarding/", { params }),
  updateTask: (id: string, data: { status: string }) => api.patch(`/offboarding/tasks/${id}`, data),
  complete: (id: string) => api.post(`/offboarding/${id}/complete`),
};
