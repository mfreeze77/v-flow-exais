/** Session classification set by the router before mounting an editor.
 * Kept outside ProjectRouter so read/write adapters do not import the entire App.
 * This preserves the existing classification API; it is not a persistence store.
 */
let managedProjectId: string | null = null;
export function activeManagedProjectId(): string | null {
  return managedProjectId;
}
export function setActiveManagedProjectId(id: string | null): void {
  managedProjectId = id;
}
