export function projectApiError(error: any) {
  const conflict =
    [
      "project/revision-conflict",
      "proposal/review-conflict",
      "proposal/busy",
      "review/revision-conflict",
    ].includes(error?.code) || error?.message?.includes("idempotency-conflict");
  const status: 400 | 409 | 503 = conflict
    ? 409
    : error?.code === "proposal/provider-unavailable"
      ? 503
      : 400;
  return {
    status,
    body: {
      error: error?.message || "Project operation failed.",
      code: error?.code || "project/invalid",
      diagnostics: error?.diagnostics || [],
      expected: error?.expected,
      actual: error?.actual,
    },
  };
}
