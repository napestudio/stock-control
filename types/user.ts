import { User, Role } from "@prisma/client";

export type UserWithRole = User & {
  role: Role;
};

export type UserListItem = {
  id: string;
  email: string;
  name: string | null;
  active: boolean;
  role: {
    id: string;
    name: string;
  };
  createdAt: Date;
  requirePasswordChange: boolean;
};

export type CreateUserResult = {
  user: User;
  temporaryPassword: string;
};

export type ResetPasswordResult = {
  temporaryPassword: string;
};
