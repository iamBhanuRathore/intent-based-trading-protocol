import { Context } from "hono";
import { RateLimiter } from "../services/rateLimiter";
import { Env } from "../types/env";

export const rateLimitMiddleware = async (c: Context<{ Bindings: Env }>, next: () => Promise<void>) => {
	try {
		const userId = c.req.header("x-user-id") || "anonymous";
		const rateLimiter = new RateLimiter(c.env.swap_hono, 20, 60 * 1000);

		if (!(await rateLimiter.isAllowed(userId))) {
			return c.json(
				{
					error: "Rate limit exceeded. Please try again later.",
				},
				429
			);
		}
		await next();
	} catch (error) {
		console.error(`Rate limit middleware error: ${error}`);
		await next();
	}
};
