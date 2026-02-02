import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      roleId: string;
      requirePasswordChange: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role: string;
    roleId: string;
    requirePasswordChange: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    roleId: string;
    requirePasswordChange: boolean;
  }
}
