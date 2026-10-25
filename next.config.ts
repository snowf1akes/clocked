import type { NextConfig } from "next";

const dev = process.env.NODE_ENV === "development";
const auth0 = `https://${process.env.NEXT_PUBLIC_AUTH0_DOMAIN}`;
const convex = new URL(process.env.NEXT_PUBLIC_CONVEX_URL ?? "https://invalid.convex.cloud");

// The page may only talk to itself, Auth0 and Convex, so even injected script has nowhere to send a token.
// ponytail: 'unsafe-inline' scripts because the page is prerendered and nonces need fully dynamic pages;
// move to a nonce CSP (see Next's content-security-policy guide) if the page becomes dynamic.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "worker-src 'self' blob:", // Auth0 keeps refresh tokens inside a blob: Web Worker when tokens are in memory
  `connect-src 'self' ${auth0} ${convex.origin} wss://${convex.host}${dev ? " ws://localhost:*" : ""}`,
  `frame-src ${auth0}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(dev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
