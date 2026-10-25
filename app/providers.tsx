"use client";

import { Auth0Provider } from "@auth0/auth0-react";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithAuth0 } from "convex/react-auth0";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Auth0Provider
      domain={process.env.NEXT_PUBLIC_AUTH0_DOMAIN!}
      clientId={process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID!}
      authorizationParams={{
        redirect_uri: typeof window === "undefined" ? undefined : window.location.origin,
      }}
      // Tokens stay in memory, not localStorage, so a script injected into the page can't read them.
      // On reload the SDK quietly restores the session from Auth0; where the browser blocks that, sign in again.
      useRefreshTokens
      useRefreshTokensFallback
      cacheLocation="memory"
    >
      <ConvexProviderWithAuth0 client={convex}>{children}</ConvexProviderWithAuth0>
    </Auth0Provider>
  );
}
