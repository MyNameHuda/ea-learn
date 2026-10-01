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
 */

import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getUserByEmail } from "@/lib/queries/data";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
  interface User {
    id: string;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
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
      async authorize(credentials) {
        const email =
          typeof credentials?.email === "string" ? credentials.email : "";
        const password =
          typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) return null;

        const user = await getUserByEmail(email);
        // A row with no password hash cannot be signed into. Treat it as a
        // failure rather than letting an empty hash through.
        if (!user?.passwordHash) return null;
        if (!bcrypt.compareSync(password, user.passwordHash)) return null;

        return { id: user.id, email: user.email, name: user.displayName };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
