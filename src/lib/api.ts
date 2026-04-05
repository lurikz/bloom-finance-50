const API_URL = (() => {
  const env = import.meta.env.VITE_API_URL?.trim();
  if (env && !/localhost|127\.0\.0\.1/.test(env)) return env;
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return env || 'http://localhost:3001/api';
  }
  return 'https://evolution-bloom-backend.exf0ty.easypanel.host/api';
})();

async function request(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Erro na requisição');
  return data;
}

export const api = {
  // Auth
  register: (email: string, password: string, name: string) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name }) }),
  login: (email: string, password: string) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  adminLogin: (username: string, password: string) =>
    request('/auth/admin-login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  forgotPassword: (email: string) =>
    request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token: string, password: string) =>
    request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),

  // Transactions
  getTransactions: (params?: { month?: number; year?: number; type?: string; category?: string; search?: string; min_amount?: number; max_amount?: number; date_from?: string; date_to?: string }) => {
    const query = new URLSearchParams();
    if (params?.month) query.set('month', String(params.month));
    if (params?.year) query.set('year', String(params.year));
    if (params?.type) query.set('type', params.type);
    if (params?.category) query.set('category', params.category);
    if (params?.search) query.set('search', params.search);
    if (params?.min_amount) query.set('min_amount', String(params.min_amount));
    if (params?.max_amount) query.set('max_amount', String(params.max_amount));
    if (params?.date_from) query.set('date_from', params.date_from);
    if (params?.date_to) query.set('date_to', params.date_to);
    return request(`/transactions?${query.toString()}`);
  },
  createTransaction: (data: { description: string; amount: number; type: 'income' | 'expense'; category_id: string; date: string }) =>
    request('/transactions', { method: 'POST', body: JSON.stringify(data) }),
  updateTransaction: (id: string, data: any) =>
    request(`/transactions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTransaction: (id: string) =>
    request(`/transactions/${id}`, { method: 'DELETE' }),

  // Categories
  getCategories: () => request('/categories'),
  createCategory: (data: { name: string; type: 'income' | 'expense'; color?: string }) =>
    request('/categories', { method: 'POST', body: JSON.stringify(data) }),
  updateCategory: (id: string, data: { name?: string; color?: string }) =>
    request(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCategory: (id: string) =>
    request(`/categories/${id}`, { method: 'DELETE' }),

  // Dashboard
  getDashboard: (params?: { month?: number; year?: number }) => {
    const query = new URLSearchParams();
    if (params?.month) query.set('month', String(params.month));
    if (params?.year) query.set('year', String(params.year));
    return request(`/dashboard?${query.toString()}`);
  },

  // Fixed Expenses
  getFixedExpenses: () => request('/fixed-expenses'),
  createFixedExpense: (data: { description: string; amount: number; category_id: string; start_date: string; recurrence_months: number }) =>
    request('/fixed-expenses', { method: 'POST', body: JSON.stringify(data) }),
  updateFixedExpense: (id: string, data: any) =>
    request(`/fixed-expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteFixedExpense: (id: string) =>
    request(`/fixed-expenses/${id}`, { method: 'DELETE' }),

  // Reports
  getMonthlyReport: (params?: { month?: number; year?: number }) => {
    const query = new URLSearchParams();
    if (params?.month) query.set('month', String(params.month));
    if (params?.year) query.set('year', String(params.year));
    return request(`/reports/monthly?${query.toString()}`);
  },

  // Admin
  getDbStatus: () => request('/admin/db-status'),
  initDb: () => request('/admin/init-db', { method: 'POST' }),
  syncCategories: () => request('/admin/sync-categories', { method: 'POST' }),

  // Admin - User Management
  getAdminUsers: (status?: string) => {
    const query = status ? `?status=${status}` : '';
    return request(`/admin/users${query}`);
  },
  createAdminUser: (data: { name: string; email: string; password: string; client_type?: string; plan_amount?: number; due_day?: number }) =>
    request('/admin/users', { method: 'POST', body: JSON.stringify(data) }),
  updateAdminUser: (id: string, data: { name?: string; email?: string; password?: string; client_type?: string; plan_amount?: number; due_day?: number }) =>
    request(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAdminUser: (id: string) =>
    request(`/admin/users/${id}`, { method: 'DELETE' }),
  blockUser: (id: string) =>
    request(`/admin/users/${id}/block`, { method: 'POST' }),
  unblockUser: (id: string) =>
    request(`/admin/users/${id}/unblock`, { method: 'POST' }),

  // Admin - Subscriptions
  getSubscriptions: (params?: { user_id?: string; status?: string; month?: number; year?: number }) => {
    const query = new URLSearchParams();
    if (params?.user_id) query.set('user_id', params.user_id);
    if (params?.status) query.set('status', params.status);
    if (params?.month) query.set('month', String(params.month));
    if (params?.year) query.set('year', String(params.year));
    return request(`/admin/subscriptions?${query.toString()}`);
  },
  createSubscription: (data: { user_id: string; amount: number; due_date: string }) =>
    request('/admin/subscriptions', { method: 'POST', body: JSON.stringify(data) }),
  paySubscription: (id: string) =>
    request(`/admin/subscriptions/${id}/pay`, { method: 'POST' }),
  updateSubscriptionStatus: (id: string, status: string) =>
    request(`/admin/subscriptions/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  deleteSubscription: (id: string) =>
    request(`/admin/subscriptions/${id}`, { method: 'DELETE' }),
  generateSubscriptions: () =>
    request('/admin/subscriptions/generate', { method: 'POST' }),

  // Admin Dashboard
  getAdminDashboard: () => request('/admin/dashboard'),

  // Profile
  getProfile: () => request('/profile/me'),
  updateProfileName: (name: string) =>
    request('/profile/name', { method: 'PUT', body: JSON.stringify({ name }) }),
  updateProfileEmail: (email: string, current_password: string) =>
    request('/profile/email', { method: 'PUT', body: JSON.stringify({ email, current_password }) }),
  updateProfilePassword: (current_password: string, new_password: string) =>
    request('/profile/password', { method: 'PUT', body: JSON.stringify({ current_password, new_password }) }),

  // Savings
  getSavings: () => request('/savings'),
  createSaving: (data: { name: string; target_amount?: number }) =>
    request('/savings', { method: 'POST', body: JSON.stringify(data) }),
  depositSaving: (id: string, data: { amount: number; description?: string }) =>
    request(`/savings/${id}/deposit`, { method: 'POST', body: JSON.stringify(data) }),
  withdrawSaving: (id: string, data: { amount: number; description?: string }) =>
    request(`/savings/${id}/withdraw`, { method: 'POST', body: JSON.stringify(data) }),
  deleteSaving: (id: string) =>
    request(`/savings/${id}`, { method: 'DELETE' }),
  getSavingMovements: (id: string) =>
    request(`/savings/${id}/movements`),
  getSavingsSummary: () => request('/savings/summary/total'),

  // Notifications
  sendNotification: (data: { title: string; message: string; type: string; target: string; target_user_id?: string }) =>
    request('/notifications', { method: 'POST', body: JSON.stringify(data) }),
  getNotificationHistory: () => request('/notifications/history'),
  deleteNotification: (id: string) =>
    request(`/notifications/${id}`, { method: 'DELETE' }),
  getMyNotifications: () => request('/notifications/mine'),
  markNotificationRead: (id: string) =>
    request(`/notifications/${id}/read`, { method: 'POST' }),
  markAllNotificationsRead: () =>
    request('/notifications/read-all', { method: 'POST' }),
};
