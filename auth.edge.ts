import NextAuth from "next-auth";

export const { auth: middleware } = NextAuth({
  pages: {
    signIn: "/login",
  },

  session: {
    strategy: "jwt",
  },

  callbacks: {
    async authorized({ auth }) {
      return !!auth?.user;
    },

    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }

      return session;
    },
  },

  // IMPORTANT
  providers: [],
});
