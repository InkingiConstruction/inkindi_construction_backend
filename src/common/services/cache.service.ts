/**
 * ============================================================================
 * 📄 FILE HEADER COMMENT
 * ============================================================================
 * FILE NAME        : cache.service.ts
 * WHAT THIS FILE DOES : Provides a highly-performant cache store and Express caching middleware
 * HOW IT DOES IT      : Manages an in-memory key-value map with expiration times (TTL) and overrides res.send
 * DATA SOURCE         : API responses and query parameters
 * DATA DESTINATION    : Local high-speed RAM cache or cached HTTP response
 * PRINCIPLE APPLIED   : SOLID (Encapsulated caching concern)
 * ============================================================================
 */

import { Request, Response, NextFunction } from "express";
import { logger } from "../middleware/logger.middleware";

interface CacheItem {
  data: any;
  expiresAt: number;
}

/**
 * 🧱 CODE BLOCK: Cache Store Instance
 * WHAT IT IS DOING: Holds cached JSON payloads in high-speed Map memory with clear operations
 * WHY IT IS HERE  : Extremely fast lookup to bypass heavy database queries without requiring external Redis during local tests
 * PRINCIPLE       : KISS
 * DATA SOURCE     : API results
 * DATA DESTINATION: RAM memory
 */
class CacheStore {
  private store = new Map<string, CacheItem>();

  public get(key: string): any | null {
    const item = this.store.get(key);
    if (!item) return null;

    if (Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return item.data;
  }

  public set(key: string, data: any, ttlSeconds: number): void {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.store.set(key, { data, expiresAt });
  }

  public delete(key: string): void {
    this.store.delete(key);
  }

  public clear(): void {
    this.store.clear();
  }
}

export const cacheStore = new CacheStore();

/**
 * ============================================================================
 * 🔧 FUNCTION: cacheMiddleware
 * ============================================================================
 * WHAT IT DOES: Generates Express route caching middleware for specified duration
 * PARAMETERS:
 *   - ttlSeconds (number) : Cache duration in seconds
 * RETURNS: (req, res, next) => void
 * WHO CALLS IT: Routes requiring caching (e.g. projects, RFQs, static settings)
 * PRINCIPLE: SOLID
 * ============================================================================
 */
export function cacheMiddleware(ttlSeconds = 60) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Only cache safe GET requests
    if (req.method !== "GET") {
      return next();
    }

    const userScope = req.user
      ? `${String(req.user.role).toLowerCase()}:${req.user.id}`
      : "anonymous";
    const key = `__cache__${userScope}:${req.method}:${req.originalUrl}`;
    const cachedResponse = cacheStore.get(key);

    if (cachedResponse) {
      logger.debug(`Cache Hit for key: ${key}`);
      res.setHeader("X-Cache", "HIT");
      res.json(cachedResponse);
      return;
    }

    logger.debug(`Cache Miss for key: ${key}`);
    res.setHeader("X-Cache", "MISS");

    // Override res.send to capture response content before transmitting to client
    const originalSend = res.send;
    res.send = function (body: any): Response {
      try {
        const parsedBody = typeof body === "string" ? JSON.parse(body) : body;
        cacheStore.set(key, parsedBody, ttlSeconds);
      } catch (err) {
        // Skip caching if body is not valid JSON
      }
      return originalSend.call(this, body);
    };

    next();
  };
}
