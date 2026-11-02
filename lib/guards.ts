const BOARD_RUN = /^\/v2\/ticketing\/trigger\/board\/\d+\/run$/;

export function assertNinjaReadOnly(method: string, path: string) {
  const withoutQuery = path.split("?")[0] ?? path;
  const normalized = withoutQuery.startsWith("/api")
    ? withoutQuery.slice(4)
    : withoutQuery;
  const verb = method.toUpperCase();
  if (verb === "GET") return;
  if (verb === "POST" && BOARD_RUN.test(normalized)) return;
  throw new Error(
    `Blocked NinjaOne ${verb} ${path}. Desk never writes tickets, comments, status, or client tenants.`,
  );
}
