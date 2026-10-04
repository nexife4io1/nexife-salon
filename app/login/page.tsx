import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { LoginForm } from "@/components/views/auth/login-form";
import { loginAction } from "@/server/auth/actions";
import { getLoginHints } from "@/server/auth/queries";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const hints = await getLoginHints();
  const demoUsers = hints?.users ?? [];

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel */}
      <aside className="relative hidden overflow-hidden bg-inverse-surface p-12 text-inverse-on-surface lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute -top-40 -right-40 size-[36rem] rounded-full bg-primary-container/25 blur-3xl"
          aria-hidden
        />
        <div className="pointer-events-none absolute -bottom-48 -left-24 size-[28rem] rounded-full bg-primary/30 blur-3xl" aria-hidden />
        <span className="relative font-headline text-headline-md font-bold text-primary-fixed-dim">Nexife</span>
        <div className="relative max-w-md">
          <p className="eyebrow mb-4 text-primary-fixed-dim!">Premium Salon Management</p>
          <p className="font-headline text-[2.5rem] leading-tight font-semibold tracking-[-0.02em]">
            Calm, considered operations for every chair you run.
          </p>
          <ul className="mt-10 space-y-4 text-body-sm text-inverse-on-surface/80">
            {[
              ["store", "Every branch at a glance"],
              ["calendar", "Appointments, staff and billing in one place"],
              ["sparkles", "AI Style Studio built in"],
            ].map(([icon, text]) => (
              <li key={text} className="flex items-center gap-3">
                <span className="grid size-8 place-items-center rounded-full bg-white/10 text-primary-fixed-dim">
                  <Icon name={icon as "store"} size={16} />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-label-sm text-inverse-on-surface/50">© Nexife</p>
      </aside>

      {/* Form */}
      <main className="flex items-center justify-center px-4 py-16 md:px-page">
        <div className="w-full max-w-md">
          <span className="mb-10 block font-headline text-headline-md font-bold text-primary lg:hidden">Nexife</span>
          <h1 className="font-headline text-headline-lg text-on-surface">Welcome back</h1>
          <p className="mt-2 text-body-md text-secondary">Sign in to manage your salon.</p>

          <Card padding="lg" className="mt-8">
            <LoginForm defaultUsername={demoUsers[1]?.username} action={loginAction} />
          </Card>

          {demoUsers.length > 0 && (
            <div className="mt-6 rounded-card border border-dashed border-outline-variant/60 p-5 text-body-sm text-secondary">
              <p className="eyebrow mb-3">Local demo accounts</p>
              <ul className="space-y-1.5">
                {demoUsers.map((u) => (
                  <li key={u.username} className="flex justify-between gap-4">
                    <code className="text-on-surface">{u.username}</code>
                    <span>
                      {u.name} · {u.role.replace("_", " ")}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3">
                Password: <code className="text-on-surface">{hints?.password}</code>
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
