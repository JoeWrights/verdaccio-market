import axios from "axios";
import { getAccessToken } from "../auth/session";

export interface ApiClientError {
  code: string;
  message: string;
  statusCode: number;
}

const apiBaseUrl = import.meta.env.PUBLIC_API_BASE_URL ?? "/api/v1";

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 8000,
  withCredentials: true
});

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const payload = error?.response?.data;
    const mapped: ApiClientError = {
      code: payload?.code ?? "INTERNAL_ERROR",
      message: payload?.message ?? "请求失败，请稍后重试。",
      statusCode: payload?.statusCode ?? error?.response?.status ?? 500
    };
    return Promise.reject(mapped);
  }
);
