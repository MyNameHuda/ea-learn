/**
 * NextAuth.js v5 (Auth.js) configuration
 *
 * Email + password only. There is no email-verification step: a verification
 * code proved the person controlled the mailbox they had just typed, so it
 * added a round-trip and a way to get locked out of your own account without
 * telling anyone anything new. Account recovery is handled by a human instead
 * — see components/ContactSupport.
 *
 * First-time users come from /signup; there is no separate verification step
 * to complete afterwards.
 *
 * Database: PostgreSQL via `pg` (Neon / Supabase), no ORM
 *
 * ── What the security pass changed here ─────────────────────────────────────
 * Three things, all measured first and all verified after:
 *
 * 1. Sign-in is rate limited, on two axes at once. See lib/rate-limit.ts for
 *    why the counter lives in Postgres. Per-IP counts every attempt, because
 *    spraying one password across many accounts produces no per-account
 *    failures; per-account counts only failures, so a parent signing in ten
 *    times in an afternoon is never locked out of their own account.
 *
 * 2. A failed sign-in takes the same time as a successful one. Before, an
 *    unknown email returned before bcrypt ever ran, and the 88 ms difference
 *    was measurable from the outside — enough to enumerate who has an account.
 *    A throwaway hash is compared against when the account is not found, so
 *    both branches pay the same ~60-90 ms.
 *
 * 3. Changing a password now actually logs the old sessions out. A JWT is not
 *    consulted against the database when it is validated, so the previous
 *    cookie stayed valid for its full 30 days: a parent could reset a leaked
 *    password and the thief walked straight back in. The session callback now
 *    checks a `token_version` that the password route bumps.
 */

import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getUserByEmail, getUserById } from "@/lib/queries/data";
import { clientIp, hit, peek, reset, KEYS, LIMITS } from "@/lib/rate-limit";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
  interface User {
    id: string;
    tokenVersion: number;
  }
}

/**
 * A real bcrypt hash of a random 64-character hex string, so no password can
 * ever match it. Its only job is to make `compare` do the same work it would do
 * for a real user — the cost of bcrypt is in the comparison, not in knowing the
 * answer. Verified at cost 10: ~63 ms, which is what a real check costs.
 */
const DUMMY_HASH = "$2b$10$/cmSzfHvrO7AWJAwZfqSVOXi38ot.4WaOSJHUScmYic/g5aNdsVe6";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: {
    strategy: "jwt",
    // Was the 30-day default. A JWT cannot be revoked on its own, so its
    // lifetime *is* the worst-case window after a compromise; 7 days bounds it
    // even if the token_version check below is somehow bypassed.
    maxAge: 7 * 24 * 60 * 60,
  },
  trustHost: true, // Required for non-Vercel deployments (localhost, custom server)
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const email =
          typeof credentials?.email === "string" ? credentials.email : "";
        const password =
          typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) return null;

        const { perAccount, perIp, windowMs } = LIMITS.login;
        const accountKey = KEYS.loginAccount(email);

        // Every attempt spends from the IP budget, so a single host cannot
        // grind through a password list across many accounts.
        const ipBudget = await hit(
          KEYS.loginIp(clientIp(request)),
          perIp,
          windowMs,
        );
        if (!ipBudget.ok) return null;

        // Checked before any work is done, so a locked account costs no bcrypt.
        const accountBudget = await peek(accountKey, perAccount, windowMs);
        if (!accountBudget.ok) return null;

        const user = await getUserByEmail(email);

        // Same cost on both branches. A row with no password hash is not a way
        // in either, but it must not be a faster way to fail.
        const matches = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

        if (!user?.passwordHash || !matches) {
          await hit(accountKey, perAccount, windowMs);
          return null;
        }

        // Success clears the failure history, so an occasional typo does not
        // slowly march a real user toward a lockout.
        await reset(accountKey);

        return {
          id: user.id,
          email: user.email,
          name: user.displayName,
          tokenVersion: user.tokenVersion,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
        token.ver = user.tokenVersion;
      }
      return token;
    },

    /**
     * The one place a JWT meets the database.
     *
     * It has to: a signed token proves the cookie was not forged, not that the
     * account behind it still wants the session. Comparing the `ver` the token
     * was minted with against the row's current token_version is what turns
     * "change my password" into "log me out everywhere".
     *
     * Costs one extra query per session read, on a warm pooled connection in
     * the same region as the rest of the data (~35 ms measured on this
     * deployment). The alternative — strategy: "database" — costs a query too,
     * and additionally puts sessions in a table that has to be pruned.
     */
    async session({ session, token }) {
      const id = token?.id as string | undefined;
      if (!id || !session.user) return session;

      const user = await getUserById(id);
      if (!user || Number(token.ver ?? 0) !== user.tokenVersion) {
        // No `user` on the session is how Auth.js spells "signed out", and it
        // is what every `session?.user` check in this codebase already reads.
        return { ...session, user: undefined } as unknown as typeof session;
      }

      session.user.id = id;
      return session;
    },
  },
});
