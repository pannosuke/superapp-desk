"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState, type ReactNode } from "react";
import { signOut } from "next-auth/react";
import {
  Building2,
  FilePenLine,
  ListChecks,
  Rss,
  SunMedium,
  Ticket,
} from "lucide-react";
import { CommandBar } from "@/components/command-bar";
import { useApi } from "@/components/use-api";
import { cn } from "cn";

const NAV = [
  { href: "/", label: "Today", icon: SunMedium },
  { href: "/drafts", label: "Drafts", icon: FilePenLine },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
  { href: "/tickets", label: "Tickets", icon: Ticket },
  { href: "/clients", label: "Clients", icon: Building2 },
  { href: "/feed", label: "Feed", icon: Rss },
];

type SessionResponse = {
  configured?: boolean;
  email?: string | null;
  missing?: string[];
  storage?: string;
};

function active(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SideNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Desk" className="flex flex-1 flex-col gap-0.5 px-2">
      {NAV.map((item) => {
        const Icon = item.icon;
        const on = active(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm",
              on ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
            )}
          >
            <Icon />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SideNavFallback() {
  return (
    <nav aria-label="Desk" className="flex flex-1 flex-col gap-0.5 px-2">
      {NAV.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground"
          >
            <Icon />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function MobileNav({ onSearch }: { onSearch: () => void }) {
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-border px-3 py-2 md:hidden">
      <span className="mr-2 text-sm font-medium">Desk</span>
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "rounded-full px-2.5 py-1 text-xs whitespace-nowrap",
            active(pathname, item.href) ? "bg-muted text-foreground" : "text-muted-foreground",
          )}
        >
          {item.label}
        </Link>
      ))}
      <button type="button" onClick={onSearch} className="ml-auto text-xs text-muted-foreground">
        Ctrl K
      </button>
    </div>
  );
}

export function DeskShell({ children }: { children: ReactNode }) {
  const session = useApi<SessionResponse>("/api/session");
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="px-4 py-5">
          <p className="text-sm font-medium tracking-tight">Desk</p>
          <p className="mt-1 text-xs text-muted-foreground">Eric Allerton</p>
          <p className="text-xs text-muted-foreground">PCG</p>
        </div>
        <Suspense fallback={<SideNavFallback />}>
          <SideNav />
        </Suspense>
        <div className="space-y-2 border-t border-sidebar-border p-3">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex w-full items-center justify-between rounded-lg border border-sidebar-border px-2 py-1.5 text-left text-xs text-muted-foreground hover:text-foreground"
          >
            Search or ask
            <kbd className="font-mono text-[10px]">Ctrl K</kbd>
          </button>
          {session.data?.email ? (
            <button type="button" onClick={() => void signOut({ callbackUrl: "/sign-in" })} className="text-xs text-muted-foreground hover:text-foreground">
              Sign out {session.data.email}
            </button>
          ) : null}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <Suspense fallback={null}>
          <MobileNav onSearch={() => setOpen(true)} />
        </Suspense>
        {session.data?.configured === false ? (
          <p className="border-b border-border px-4 py-2 text-xs text-muted-foreground md:px-8">
            Sign-in is not configured, set {(session.data.missing ?? []).join(", ")}. Live calls stay off until then.
            {session.data.storage ? ` Storage: ${session.data.storage}.` : ""}
          </p>
        ) : null}
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
      <CommandBar open={open} onOpenChange={setOpen} />
    </div>
  );
}
