import Link from "next/link";
import type { ReactNode } from "react";

export function Panel({
  title,
  href,
  meta,
  children,
}: {
  title: string;
  href?: string;
  meta?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col rounded-xl border border-border bg-card">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="text-sm font-medium tracking-tight">{title}</h2>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {meta}
          {href ? (
            <Link href={href} className="hover:text-foreground">
              Open
            </Link>
          ) : null}
        </div>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function NotConnected({ missing }: { missing: string[] }) {
  return (
    <div className="rounded-lg border border-dashed border-border px-3 py-8 text-center">
      <p className="text-sm text-foreground">Not connected, set {missing.join(", ")}</p>
    </div>
  );
}

export function PanelMessage({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

export function PageHeader({ eyebrow, title, lede }: { eyebrow?: string; title: string; lede: string }) {
  return (
    <header className="mb-6">
      {eyebrow ? (
        <p className="text-xs tracking-wide text-muted-foreground uppercase">{eyebrow}</p>
      ) : null}
      <h1 className="mt-1 text-2xl font-medium tracking-tight">{title}</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{lede}</p>
    </header>
  );
}
