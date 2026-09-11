export async function projectApi<T = any>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(
    `/api/vflow${path}`,
    body === undefined
      ? undefined
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const result = await response.json();
  if (!response.ok)
    throw Object.assign(new Error(result.error || `Project request failed (${response.status}).`), {
      code: result.code,
      diagnostics: result.diagnostics || [],
      status: response.status,
    });
  return result;
}
export const openProject = (id: string) => {
  window.location.hash = `project/${encodeURIComponent(id)}`;
};
