const API_BASE = "/api";


export function getToken() {
  return localStorage.getItem("hcm_token");
}

export function saveSession(token, user) {
  localStorage.setItem("hcm_token", token);
  localStorage.setItem("hcm_user", JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem("hcm_token");
  localStorage.removeItem("hcm_user");
}

export function getSavedUser() {
  try {
    const user = localStorage.getItem("hcm_user");
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
}

async function request(path, options = {}) {
  const token = getToken();

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || `Request failed (${response.status})`);
  }

  return data;
}

export async function login(email, password) {
  const data = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  saveSession(data.token, data.user);
  return data;
}

export async function getCurrentUser() {
  return request("/auth/me");
}

export async function createHR({ fullName, email, password }) {
  return request("/admin/hr", {
    method: "POST",
    body: JSON.stringify({ fullName, email, password }),
  });
}

export async function getEmployees() {
  return request("/employees");
}


export async function createEmployee(employee) {
  return request("/employees", {
    method: "POST",
    body: JSON.stringify(employee),
  });
}


export async function getAttendance(date) {
  const query = date ? `?date=${encodeURIComponent(date)}` : "";
  return request(`/attendance${query}`);
}

export async function saveAttendance(attendance) {
  return request("/attendance", {
    method: "POST",
    body: JSON.stringify(attendance),
  });
}
