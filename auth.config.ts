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

        return loginUser(
          parsed.data.email,
          parsed.data.password
        );
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

      if (token.id && !token.revoked) {
        const currentUser = await prisma.user.findUnique({
          where: { id: token.id },
          select: { sessionVersion: true, isActive: true, isDeleted: true },
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
        session.user.id = token.revoked ? "" : (token.id as string);
        session.user.role = token.revoked ? "USER" : (token.role as string);
      }

      return session;
    },
  },
} satisfies NextAuthConfig;
