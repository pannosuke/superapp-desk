export type ClientCloud = "commercial" | "gcc-high";

export type ClientLinks = {
  m365: string;
  entra: string;
  intune: string;
  defender: string;
  partner: string;
};

export type ClientRecord = {
  id: string;
  name: string;
  cloud: ClientCloud;
  ninjaOrgId: number | null;
  edgeProfile: string;
  notes: string;
  links: ClientLinks;
};

export const CLIENT_STORAGE_KEY = "desk.clients.v1";

export function defaultLinks(cloud: ClientCloud): ClientLinks {
  if (cloud === "gcc-high") {
    return {
      m365: "https://admin.microsoft.us",
      entra: "https://entra.microsoft.us",
      intune: "https://intune.microsoft.us",
      defender: "https://security.microsoft.us",
      partner: "https://partner.microsoft.com/dashboard",
    };
  }
  return {
    m365: "https://admin.microsoft.com",
    entra: "https://entra.microsoft.com",
    intune: "https://intune.microsoft.com",
    defender: "https://security.microsoft.com",
    partner: "https://partner.microsoft.com/dashboard",
  };
}

export const LINK_LABELS: { key: keyof ClientLinks; label: string }[] = [
  { key: "m365", label: "M365 admin" },
  { key: "entra", label: "Entra" },
  { key: "intune", label: "Intune" },
  { key: "defender", label: "Defender" },
  { key: "partner", label: "Partner Center" },
];

export const SEED_CLIENTS: ClientRecord[] = [
  {
    id: "burch-construction",
    name: "Burch Construction",
    cloud: "commercial",
    ninjaOrgId: 3,
    edgeProfile: "",
    notes: "",
    links: defaultLinks("commercial"),
  },
  {
    id: "ra-burch",
    name: "R.A. Burch",
    cloud: "commercial",
    ninjaOrgId: 4,
    edgeProfile: "",
    notes: "",
    links: defaultLinks("commercial"),
  },
  {
    id: "marlin",
    name: "Marlin",
    cloud: "gcc-high",
    ninjaOrgId: null,
    edgeProfile: "",
    notes:
      "GCC High. Open the portals in the matching Edge profile. Desk never pulls data from this tenant.",
    links: defaultLinks("gcc-high"),
  },
];

export function organizationName(orgId: number | null | undefined) {
  if (orgId == null) return null;
  return SEED_CLIENTS.find((client) => client.ninjaOrgId === orgId)?.name ?? null;
}
