export const RATE_LIMIT_CONFIG = {
	maxRequests: 20,
	timeWindow: 60 * 1000, // 1 minute in milliseconds
} as const;
