import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/",
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Find user by email, only fetch necessary fields
        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email as string,
            deletedAt: null,
          },
          select: {
            id: true,
            email: true,
            name: true,
            password: true,
            active: true,
            roleId: true,
            role: {
              select: {
                name: true,
              },
            },
          },
        });

        if (!user || !user.active) {
          return null;
        }

        // Verify password
        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!passwordMatch) {
          return null;
        }

        // Return user object (will be encoded in JWT)
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role.name,
          roleId: user.roleId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // On sign in, add user data to token
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.roleId = user.roleId;
      }
      return token;
    },
    async session({ session, token }) {
      // Add user data from token to session
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.roleId = token.roleId as string;
      }
      return session;
    },
  },
});
