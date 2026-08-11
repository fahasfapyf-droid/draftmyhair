import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

import { loginUser } from "@/lib/auth/login";
import { prisma } from "@/lib/prisma";

export default {
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },

      async authorize(credentials) {
        const parsed = z
          .object({
            email: z.string().email(),
            password: z.string().min(8),
          })
          .safeParse(credentials);

        if (!parsed.success) {
          return null;
        }

        const result = await loginUser(
          parsed.data.email,
          parsed.data.password
        );

        return result.status === "SUCCESS" ? result.user : null;
      },
    }),
  ],

  pages: {
    signIn: "/login",
  },

  session: {
    strategy: "jwt",
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.sessionVersion = user.sessionVersion;
        token.revoked = false;
        return token;
      }

      const tokenUserId =
        typeof token.id === "string" ? token.id : null;

      if (tokenUserId && !token.revoked) {
        const currentUser = await prisma.user.findUnique({
          where: { id: tokenUserId },
          select: {
            sessionVersion: true,
            isActive: true,
            isDeleted: true,
          },
        });

        if (
          !currentUser ||
          !currentUser.isActive ||
          currentUser.isDeleted ||
          currentUser.sessionVersion !== token.sessionVersion
        ) {
          token.revoked = true;
          token.id = "";
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.revoked ? "" : String(token.id ?? "");
        session.user.role = token.revoked
          ? "USER"
          : String(token.role ?? "USER");
      }

      return session;
    },
  },
} satisfies NextAuthConfig;
