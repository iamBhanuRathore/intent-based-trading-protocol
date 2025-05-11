import { Buffer } from "buffer";
import { Hono } from "hono";
import { PublicKey, Connection } from "@solana/web3.js";
import { getMint } from "@solana/spl-token";
import { createJupiterApiClient } from "@jup-ag/api";
import { rateLimitMiddleware } from "./middleware/rateLimit";
import { Env } from "./types/env";
import { cors } from "hono/cors";

// Make Buffer globally available
(globalThis as any).Buffer = Buffer;

const app = new Hono<{ Bindings: Env }>();

// Add CORS middleware
app.use(
	"/*",
	cors({
		origin: ["http://localhost:3000"],
		allowMethods: ["GET", "POST", "OPTIONS"],
		allowHeaders: ["Content-Type"],
		exposeHeaders: ["Content-Length", "X-Kuma-Revision"],
		maxAge: 600,
		credentials: true,
	})
);

// Configuration constants
const JUPITER_CONFIG = {
	basePath: "https://lite-api.jup.ag/swap/v1",
	slippageBps: 100, // 1% slippage
	priorityLevel: "medium" as const,
	maxLamports: 10000,
} as const;
const jupiterApi = createJupiterApiClient({
	basePath: JUPITER_CONFIG.basePath,
});

// Custom error types
class JupiterError extends Error {
	constructor(
		message: string,
		public readonly details?: unknown
	) {
		super(message);
		this.name = "JupiterError";
	}
}

// Health check endpoint
app.get("/", rateLimitMiddleware, (c) => {
	return c.text("Hello Hono!");
});

app.get("/health", rateLimitMiddleware, (c) => {
	return c.text("OK");
});

// Get Jupiter quote
app.post("/quote", rateLimitMiddleware, async (c) => {
	const connection = new Connection(c.env.RPC_URL);
	try {
		const { inputMint, outputMint, amount } = await c.req.json();
		const inputMintInfo = await getMint(connection, new PublicKey(inputMint));
		const amountInSmallestUnit = Number(amount) * 10 ** inputMintInfo.decimals;
		const parsedAmount = Number(amount);
		if (isNaN(parsedAmount) || parsedAmount <= 0) {
			return c.json({ error: "Invalid amount" }, 400);
		}

		if (amountInSmallestUnit <= 0) {
			return c.json({ error: "Input amount must be greater than zero" }, 400);
		}

		const quoteResponse = await jupiterApi.quoteGet({
			inputMint,
			outputMint,
			amount: amountInSmallestUnit,
			slippageBps: JUPITER_CONFIG.slippageBps,
			restrictIntermediateTokens: true,
		});

		if (!quoteResponse) {
			return c.json({ error: "No quote received from Jupiter" }, 500);
		}

		return c.json(quoteResponse);
	} catch (error) {
		return c.json({ error: "Failed to execute Jupiter swap", details: error instanceof Error ? error.message : String(error) }, 500);
	}
});

// Execute swap
app.post("/swap", rateLimitMiddleware, async (c) => {
	try {
		const { quoteResponse, userPublicKey } = await c.req.json();

		const swapResult = await jupiterApi.swapPost({
			swapRequest: {
				userPublicKey,
				quoteResponse,
				wrapAndUnwrapSol: true,
				asLegacyTransaction: true,
				dynamicComputeUnitLimit: true,
				dynamicSlippage: true,
				prioritizationFeeLamports: {
					priorityLevelWithMaxLamports: {
						maxLamports: JUPITER_CONFIG.maxLamports,
						priorityLevel: JUPITER_CONFIG.priorityLevel,
					},
				},
			},
		});

		return c.json({ swapTransaction: swapResult.swapTransaction });
	} catch (error) {
		return c.json({ error: "Failed to execute Jupiter swap", details: error }, 500);
	}
});

export default app;
