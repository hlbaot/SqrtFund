import axios from "axios";

type ApiErrorBody = {
  code?: string;
  error?: string;
  retryAfter?: number;
  attemptsLeft?: number;
  missing?: string[];
};

/** Preserve API error codes and OTP metadata for the existing UI flows. */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly retryAfter?: number,
    readonly attemptsLeft?: number,
    readonly missing?: string[],
  ) {
    super(code);
    this.name = "ApiError";
  }
}

export const api = axios.create({ headers: { Accept: "application/json" } });

api.interceptors.response.use(
  response => response,
  (error: unknown) => {
    if (axios.isCancel(error)) return Promise.reject(error);
    if (axios.isAxiosError<ApiErrorBody>(error)) {
      const data = error.response?.data;
      return Promise.reject(new ApiError(
        data?.code || data?.error || "SERVICE_UNAVAILABLE",
        data?.retryAfter,
        data?.attemptsLeft,
        data?.missing,
      ));
    }
    return Promise.reject(error);
  },
);
