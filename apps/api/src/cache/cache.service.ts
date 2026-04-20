import { Injectable } from "@nestjs/common";
import { LRUCache } from "lru-cache";

@Injectable()
export class CacheService {
  private readonly store = new LRUCache<string, any>({
    max: 500,
    ttl: 30_000,
    ttlAutopurge: true
  });

  private hits = 0;
  private misses = 0;

  public get<T>(key: string): T | null {
    const cached = this.store.get(key);
    if (cached === undefined) {
      this.misses += 1;
      return null;
    }
    this.hits += 1;
    return cached as T;
  }

  public set<T>(key: string, value: T, ttlMs = 30_000): void {
    this.store.set(key, value, { ttl: ttlMs });
  }

  public getStats(): { size: number; hits: number; misses: number } {
    return {
      size: this.store.size,
      hits: this.hits,
      misses: this.misses
    };
  }
}
