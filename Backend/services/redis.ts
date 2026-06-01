import { createClient } from "redis";

export interface ICacheClient {
  get(key: string): Promise<string | null>;
  setEx(key: string, seconds: number, value: string): Promise<string | null>;
  del(key: string): Promise<number>;
  ttl(key: string): Promise<number>;
}

class InMemoryCache implements ICacheClient {
  private store = new Map<string, { value: string; expiresAt: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async setEx(key: string, seconds: number, value: string): Promise<string | null> {
    const expiresAt = Date.now() + seconds * 1000;
    this.store.set(key, { value, expiresAt });
    return "OK";
  }

  async del(key: string): Promise<number> {
    const deleted = this.store.delete(key);
    return deleted ? 1 : 0;
  }

  async ttl(key: string): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return -2;
    const remaining = entry.expiresAt - Date.now();
    if (remaining <= 0) {
      this.store.delete(key);
      return -2;
    }
    return Math.ceil(remaining / 1000);
  }
}

let cacheClient: ICacheClient;
const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

const realRedis = createClient({ url: REDIS_URL });

realRedis.on("error", () => {
});

async function initializeCache() {
  try {
    await realRedis.connect();
    console.log("====================================================");
    console.log("  [REDIS] Successfully connected to Redis server!");
    console.log("====================================================");
    cacheClient = realRedis as unknown as ICacheClient;
  } catch (error) {
    console.log("====================================================");
    console.log("  [WARNING] Redis connection failed!");
    console.log("  Falling back to [InMemoryCache] (in-memory storage).");
    console.log("  OTP codes and QR sessions will be stored in RAM.");
    console.log("====================================================");
    cacheClient = new InMemoryCache();
  }
}

initializeCache();

const cacheService = new Proxy({} as ICacheClient, {
  get: (target, prop) => {
    if (!cacheClient) {
      cacheClient = new InMemoryCache();
    }
    const value = cacheClient[prop as keyof ICacheClient];
    if (typeof value === "function") {
      return value.bind(cacheClient);
    }
    return value;
  }
});

export default cacheService;
