import { KVNamespace } from "@cloudflare/workers-types";
import { RateLimitData } from "../types/env";

export class RateLimiter {
	private readonly maxRequests: number;
	private readonly timeWindow: number;
	private readonly kv: KVNamespace;

	constructor(kv: KVNamespace, maxRequests: number, timeWindow: number) {
		this.kv = kv;
		this.maxRequests = maxRequests;
		this.timeWindow = timeWindow;
	}

	async isAllowed(userId: string): Promise<boolean> {
		try {
			const now = Date.now();
			const key = `rate_limit:${userId}`;

			const data = (await this.kv.get(key, { type: "json" })) as RateLimitData | null;

			if (!data) {
				await this.kv.put(key, JSON.stringify({ count: 1, timestamp: now }), {
					expirationTtl: this.timeWindow / 1000,
				});
				return true;
			}

			if (now - data.timestamp > this.timeWindow) {
				await this.kv.put(key, JSON.stringify({ count: 1, timestamp: now }), {
					expirationTtl: this.timeWindow / 1000,
				});
				return true;
			}

			if (data.count >= this.maxRequests) {
				return false;
			}

			await this.kv.put(
				key,
				JSON.stringify({
					count: data.count + 1,
					timestamp: data.timestamp,
				})
			);
			return true;
		} catch (error) {
			console.error(`Rate limiter error: ${error}`);
			return true;
		}
	}
}
