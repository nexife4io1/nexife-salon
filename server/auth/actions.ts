"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { homePathFor } from "@/server/shared/rbac";
import { endSession, startSession } from "@/server/shared/session";
import { loginInputSchema, type LoginState } from "./schema";
import { authenticate } from "./service";

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginInputSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const user = await authenticate(parsed.data);
  if (!user) return { error: "That username and password don't match." };

  await startSession({ sub: user.id, tid: user.tenantId, role: user.role, name: user.name, menus: user.menus });
  redirect(homePathFor(user));
}

export async function logoutAction(): Promise<void> {
  await endSession();
  redirect("/login");
}
