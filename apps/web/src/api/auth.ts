import type { LoginRequestDto, SessionUserDto } from "@verdaccio-market/types";
import { apiClient } from "./client";
import { clearAccessToken, setAccessToken } from "../auth/session";

export async function login(params: LoginRequestDto): Promise<SessionUserDto> {
  const response = await apiClient.post<SessionUserDto>("/auth/login", params);
  setAccessToken(params.token);
  return response.data;
}

export async function getCurrentUser(): Promise<SessionUserDto> {
  const response = await apiClient.get<SessionUserDto>("/auth/me");
  return response.data;
}

export async function logout(): Promise<void> {
  await apiClient.post("/auth/logout");
  clearAccessToken();
}
