// Auth0 issuer and client id, set on each Convex deployment:
//   npx convex env set AUTH0_DOMAIN https://<tenant>.us.auth0.com/   (full URL, trailing slash)
//   npx convex env set AUTH0_CLIENT_ID <client id>
export default {
  providers: [
    {
      domain: process.env.AUTH0_DOMAIN!,
      applicationID: process.env.AUTH0_CLIENT_ID!,
    },
  ],
};
