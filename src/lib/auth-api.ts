const API_URL = "";

export class ApiError extends Error {
  status: number;
  fieldErrors?: Record<string, string>;

  constructor(status: number, message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

async function post<T = unknown>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Can't reach the AgriShift server. Check your connection and try again.");
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // FastAPI returns { detail: string } or a list of validation errors
    const detail = data?.detail;
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail) && detail[0]?.msg
          ? detail[0].msg
          : "Something went wrong. Please try again.";
    throw new ApiError(res.status, message, data?.field_errors);
  }

  return data as T;
}

export const authApi = {
  login: (email: string, password: string) =>
    post<{ user: { id: string; email: string; name: string } }>("/api/auth/login", { email, password }),

  signup: (name: string, email: string, password: string) =>
    post<{ message: string }>("/api/auth/signup", { name, email, password }),

  // Always resolves the same way whether or not the email exists (prevents account enumeration)
  forgotPassword: (email: string) => post<{ message: string }>("/api/auth/forgot-password", { email }),

  resetPassword: (token: string, password: string) =>
    post<{ message: string }>("/api/auth/reset-password", { token, password }),

  verifyEmail: (token: string) => post<{ message: string }>("/api/auth/verify-email", { token }),

  logout: () => post<{ message: string }>("/api/auth/logout", {}),
};
