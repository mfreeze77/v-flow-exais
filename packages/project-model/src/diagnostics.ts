export interface ProjectDiagnostic {
  code: string;
  severity: "error" | "warning";
  pointer: string;
  message: string;
  documentId?: string;
  sceneId?: string;
  recovery: string;
}

export class ProjectValidationError extends Error {
  readonly code = "project/invalid";
  constructor(readonly diagnostics: ProjectDiagnostic[]) {
    super(
      diagnostics.map((diagnostic) => `${diagnostic.pointer}: ${diagnostic.message}`).join("; "),
    );
    this.name = "ProjectValidationError";
  }
}

export function problem(
  code: string,
  pointer: string,
  message: string,
  recovery = "Correct the source and retry.",
): ProjectDiagnostic {
  return { code, severity: "error", pointer, message, recovery };
}
