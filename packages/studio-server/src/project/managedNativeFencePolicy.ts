/** Pure dispatch policy. Only authoritative document GET/HEAD can bypass the legacy handler. */
export function nativeManagedRequest(method: string, suffix: string): "read-document" | "blocked" {
  return (method === "GET" || method === "HEAD") && suffix.startsWith("/files/")
    ? "read-document"
    : "blocked";
}
