import { createAuthClient } from "better-auth/react";

// Same origin as the API; Better Auth's routes are mounted at /api/auth
export const authClient = createAuthClient();

export const signInWithDiscord = () =>
    authClient.signIn.social({provider: "discord", callbackURL: window.location.href});

export const signOut = () => authClient.signOut();
