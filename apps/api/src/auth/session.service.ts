import { Injectable } from "@nestjs/common";

interface SessionData {
  username: string;
  token: string;
  createdAt: number;
}

@Injectable()
export class SessionService {
  private readonly sessions = new Map<string, SessionData>();

  public createSession(data: SessionData): string {
    const sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
    this.sessions.set(sid, data);
    return sid;
  }

  public getSession(sid: string): SessionData | null {
    return this.sessions.get(sid) ?? null;
  }

  public deleteSession(sid: string): void {
    this.sessions.delete(sid);
  }
}
