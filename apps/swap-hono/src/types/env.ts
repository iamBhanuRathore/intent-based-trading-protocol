import type { KVNamespace } from "@cloudflare/workers-types";

export interface Env {
	swap_hono: KVNamespace;
	RPC_URL: string;
}

export interface RateLimitData {
	count: number;
	timestamp: number;
}
