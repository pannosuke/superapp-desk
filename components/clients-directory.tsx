"use client";

import { useState } from "react";
import { saveClients, useClients } from "@/components/client-store";
import { PageHeader } from "@/components/panel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  defaultLinks,
  LINK_LABELS,
  SEED_CLIENTS,
  type ClientCloud,
  type ClientLinks,
  type ClientRecord,
} from "@/lib/clients";

const EMPTY: ClientRecord = {
  id: "",
  name: "",
  cloud: "commercial",
  ninjaOrgId: null,
  edgeProfile: "",
  notes: "",
  links: defaultLinks("commercial"),
};

export function ClientsDirectory() {
  const clients = useClients();
  const [editing, setEditing] = useState<ClientRecord | null>(null);

  function persist(next: ClientRecord[]) {
    saveClients(next);
  }

  function openNew() {
    setEditing({
      ...EMPTY,
      id: crypto.randomUUID(),
      links: defaultLinks("commercial"),
    });
  }

  function changeCloud(cloud: ClientCloud) {
    if (!editing) return;
    const previous = defaultLinks(editing.cloud);
    const links = { ...editing.links };
    (Object.keys(links) as (keyof ClientLinks)[]).forEach((key) => {
      if (links[key] === previous[key]) links[key] = defaultLinks(cloud)[key];
    });
    setEditing({ ...editing, cloud, links });
  }

  function saveEdit() {
    if (!editing || !editing.name.trim()) return;
    const next = clients.some((client) => client.id === editing.id)
      ? clients.map((client) => (client.id === editing.id ? editing : client))
      : [...clients, editing];
    persist(next);
    setEditing(null);
  }

  return (
    <div>
      <PageHeader
        title="Clients"
        lede="Pointers only: a name, which cloud they live in, the Edge profile to use, and the admin portals. Nothing here is saved on the server."
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Button onClick={openNew}>Add client</Button>
        <Button
          variant="outline"
          onClick={() => {
            persist(SEED_CLIENTS);
          }}
        >
          Reset to seed
        </Button>
      </div>
      <ul className="grid gap-4">
        {clients.map((client) => (
          <li key={client.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-medium">{client.name}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {client.cloud === "gcc-high" ? "GCC High" : "Commercial"}
                  {client.ninjaOrgId != null ? ` · NinjaOne org ${client.ninjaOrgId}` : ""}
                  {client.edgeProfile ? ` · Edge profile ${client.edgeProfile}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(client)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => persist(clients.filter((item) => item.id !== client.id))}
                >
                  Remove
                </Button>
              </div>
            </div>
            {client.cloud === "gcc-high" ? (
              <p className="mt-3 rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary">
                Link out only. Desk never calls GCC High endpoints and never pulls data from this tenant.
              </p>
            ) : null}
            {client.notes ? <p className="mt-3 text-sm text-muted-foreground">{client.notes}</p> : null}
            <ul className="mt-3 flex flex-wrap gap-2">
              {LINK_LABELS.map((link) => (
                <li key={link.key}>
                  <a
                    href={client.links[link.key]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex rounded-full border border-border px-2.5 py-1 text-xs hover:bg-muted"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{clients.some((client) => client.id === editing?.id) ? "Edit client" : "Add client"}</DialogTitle>
            <DialogDescription>Names, portal URLs, and notes stay in this browser.</DialogDescription>
          </DialogHeader>
          {editing ? (
            <div className="grid max-h-[60vh] gap-3 overflow-y-auto pr-1">
              <div className="grid gap-1.5">
                <Label htmlFor="client-name">Tenant name</Label>
                <Input
                  id="client-name"
                  value={editing.name}
                  onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="client-cloud">Cloud</Label>
                <select
                  id="client-cloud"
                  value={editing.cloud}
                  onChange={(event) => changeCloud(event.target.value as ClientCloud)}
                  className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
                >
                  <option value="commercial">Commercial</option>
                  <option value="gcc-high">GCC High</option>
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="client-org">NinjaOne org id</Label>
                <Input
                  id="client-org"
                  value={editing.ninjaOrgId ?? ""}
                  onChange={(event) =>
                    setEditing({
                      ...editing,
                      ninjaOrgId: event.target.value ? Number(event.target.value) : null,
                    })
                  }
                  inputMode="numeric"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="client-edge">Edge profile</Label>
                <Input
                  id="client-edge"
                  value={editing.edgeProfile}
                  onChange={(event) => setEditing({ ...editing, edgeProfile: event.target.value })}
                />
              </div>
              {LINK_LABELS.map((link) => (
                <div key={link.key} className="grid gap-1.5">
                  <Label htmlFor={`link-${link.key}`}>{link.label}</Label>
                  <Input
                    id={`link-${link.key}`}
                    value={editing.links[link.key]}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        links: { ...editing.links, [link.key]: event.target.value },
                      })
                    }
                  />
                </div>
              ))}
              <div className="grid gap-1.5">
                <Label htmlFor="client-notes">Notes</Label>
                <Textarea
                  id="client-notes"
                  value={editing.notes}
                  onChange={(event) => setEditing({ ...editing, notes: event.target.value })}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={!editing?.name.trim()}>
              Save in this browser
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
