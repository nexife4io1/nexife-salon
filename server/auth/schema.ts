import { z } from "zod";
import { ROLES } from "@/server/shared/session-token";

export const loginInputSchema = z.object({
  username: z.string().trim().min(1, "Enter your username").max(64),
  password: z.string().min(1, "Enter your password").max(256),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

/** Internal: what the repository returns. Never leaves the backend module. */
export type UserRecord = {
  id: string;
  tenantId: string | null;
  name: string;
  username: string;
  passwordHash: string;
  role: (typeof ROLES)[number];
  menus: string[];
};

export type LoginState = { error?: string; fieldErrors?: Record<string, string[]> } | undefined;
