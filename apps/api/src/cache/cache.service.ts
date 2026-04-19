import { Injectable } from "@nestjs/common";

interface CacheItem<T> {
  value: T;
  expireAt: number;
}

@Injectable()
export class CacheService {
  private readonly store = new Map<string, CacheItem<unknown>>();

  private hits = 0;
  private misses = 0;

  public get<T>(key: string): T | null {
    const cached = this.store.get(key);
    if (!cached) {
      this.misses += 1;
      return null;
    }
    if (cached.expireAt < Date.now()) {
      this.store.delete(key);
      this.misses += 1;
      return null;
    }
    this.hits += 1;
    return cached.value as T;
  }

  public set<T>(key: string, value: T, ttlMs = 30_000): void {
    this.store.set(key, {
      value,
      expireAt: Date.now() + ttlMs
    });
  }

  public getStats(): { size: number; hits: number; misses: number } {
    return {
      size: this.store.size,
      hits: this.hits,
      misses: this.misses
    };
  }
}
