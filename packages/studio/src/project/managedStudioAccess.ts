/** Construction does not touch the network or validate native project IDs. */
export const MANAGED_STUDIO_PROTOCOL = "managed-studio-native-fence-v1";
export function wantsManagedStudio(hash: string): boolean {
  const query = hash.indexOf("?");
  return query >= 0 && new URLSearchParams(hash.slice(query + 1)).get("editor") === "studio";
}
export function managedStudioHash(id: string, enabled: boolean): string {
  return `#project/${encodeURIComponent(id)}${enabled ? "?editor=studio" : ""}`;
}
export async function verifyManagedStudioAccess(
  id: string,
  signal: AbortSignal,
  fetcher = fetch,
): Promise<void> {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(id))
    throw new Error("Invalid managed project identity.");
  const response = await fetcher(
    `/api/vflow/projects/${encodeURIComponent(id)}/editor/studio-access`,
    {
      signal,
      cache: "no-store",
    },
  );
  if (!response.ok)
    throw new Error(
      "This server has not enabled the managed native-route fence. The editor was not opened.",
    );
  const value = await response.json();
  signal.throwIfAborted();
  if (
    value?.protocol !== MANAGED_STUDIO_PROTOCOL ||
    value.projectId !== id ||
    value.nativeRoutes !== "blocked-except-authoring-reads" ||
    value.history !== "project-journal"
  )
    throw new Error("Managed Studio safety contract mismatch. The editor was not opened.");
}
