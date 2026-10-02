import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { SearchField } from "@/components/ui/search-field";
import { logoutAction } from "@/server/auth/actions";
import { MobileNavToggle } from "./mobile-nav-toggle";

const ROLE_LABELS: Record<string, string> = {
  platform_admin: "Platform Admin",
  owner: "Owner",
  manager: "Manager",
  staff: "Staff",
};

/** Glassy fixed top bar (mockup TopAppBar): search pill, quiet icons, profile. */
export function Topbar({ userName, role }: { userName: string; role: string }) {
  return (
    <header className="fixed top-0 right-0 left-0 z-30 flex h-topbar items-center justify-between gap-4 bg-surface/80 px-4 shadow-sm backdrop-blur-md md:px-page lg:left-sidebar">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <MobileNavToggle />
        {/* TODO(step 3): global search across customers, appointments and staff. */}
        <SearchField placeholder="Search branches, staff, clients…" aria-label="Search" className="w-full max-w-md" />
      </div>

      <div className="flex items-center gap-4 md:gap-6">
        <div className="hidden items-center gap-4 text-on-surface-variant sm:flex">
          <button type="button" className="relative transition-colors hover:text-primary" aria-label="Notifications">
            <Icon name="bell" size={22} />
            <span className="absolute top-0 right-0 size-2 rounded-full bg-error" aria-hidden />
          </button>
          <button type="button" className="transition-colors hover:text-primary" aria-label="Help">
            <Icon name="help" size={22} />
          </button>
        </div>

        <div className="flex items-center gap-3 border-l border-outline-variant/30 pl-4 md:pl-6">
          <Avatar name={userName} size="sm" />
          <div className="hidden md:block">
            <p className="text-label-md text-on-surface">{userName}</p>
            <p className="text-label-sm text-secondary">{ROLE_LABELS[role] ?? role}</p>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="rounded-full p-1.5 text-secondary transition-colors hover:text-primary" aria-label="Sign out" title="Sign out">
              <Icon name="logout" size={18} />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
