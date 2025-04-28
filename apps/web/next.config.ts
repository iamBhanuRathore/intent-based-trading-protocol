import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	webpackDevMiddleware: (config: any) => {
		config.watchOptions = {
			ignored: ["**/.git/**", "**/node_modules/**", "**/dist/**", "**/build/**"],
		};
		return config;
	},
};

export default nextConfig;
