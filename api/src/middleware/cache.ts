import type { Request, Response, NextFunction, RequestHandler } from "express";

type CacheEntry = {
    expiresAt: number;
    status: number;
    body: any;
    headers: Record<string, string>;
}

const store = new Map<string, CacheEntry>();
const MAX_ENTRIES = Number.isFinite(Number(process.env.CACHE_MAX_ENTRIES)) ? Math.max(10, Number(process.env.CACHE_MAX_ENTRIES)) : 200;

let reqCount = 0;

function pruneExpired(now: number){
    for(const [k, v] of store.entries()){
        if(v.expiresAt <= now) store.delete(k);
    }
    while(store.size > MAX_ENTRIES){
        const oldestKey = store.keys().next().value;
        if(!oldestKey) break;
        store.delete(oldestKey);
    }
}

export function cacheJson(ttlMs: number): RequestHandler {
    const ttl = Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : 10_000;

    return (req: Request, res: Response, next: NextFunction) => {
        if (req.method !== "GET") return next();

        const key = req.originalUrl;
        const now = Date.now();
        if((++reqCount % 50) === 0) pruneExpired(now);

        const hit = store.get(key);
        if(hit && hit.expiresAt > now){
            res.setHeader("X-Cache", "HIT");
            for (const [k, v] of Object.entries(hit.headers)) res.setHeader(k, v);

            return res.status(hit.status).json(hit.body);
        }

        res.setHeader("X-Cache", "MISS");

        const originalJson = res.json.bind(res);
        res.json = (body: any) => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                pruneExpired(Date.now());
                store.set(key, {
                    expiresAt: Date.now() + ttl,
                    status: res.statusCode,
                    body,
                    headers: {
                        "Content-Type": "application/json; charset=utf-8",
                    },
                });
            }
            return originalJson(body);
        };

        next();
    };
}

export function cacheClear(): void {
    store.clear();
}