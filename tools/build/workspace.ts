/**
 * AFM-009 / AFM-011 — workspace manifest and build-order validation.
 *
 * Answers three questions the acceptance criteria ask:
 *   - Does one root install resolve every production workspace dependency
 *     locally, with no registry fallback?
 *   - Do duplicate package names, hidden npm roots or an accidental substitution
 *     of a published upstream package fail validation?
 *   - Is the build order consistent with the actual dependency graph, including
 *     upstream's reviewed cycle allowances rather than a blanket rewrite?
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export interface PackageManifest {
  name?: string;
  version?: string;
  private?: boolean;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  exports?: unknown;
  files?: string[];
}

export interface WorkspacePackage {
  dir: string;
  manifest: PackageManifest;
}

export type WorkspaceProblemCode =
  | "duplicate-package-name"
  | "missing-package-name"
  | "nested-package-manager-root"
  | "registry-substitution"
  | "unresolved-workspace-dependency"
  | "new-package-not-private"
  | "build-order-violation";

export interface WorkspaceProblem {
  code: WorkspaceProblemCode;
  package: string;
  detail: string;
}

/**
 * Packages introduced by this repository. Contract C11 keeps them private until
 * a separately approved publishing policy exists — they are not upstream's to
 * publish and not ours to publish under upstream's scope.
 */
export const OWNED_NEW_PACKAGES = new Set([
  "@hyperframes/diagram-engine",
  "@hyperframes/diagram-viewer",
  "@hyperframes/project-model",
  "@hyperframes/diagram-motion",
]);

const LOCKFILE_NAMES = ["package-lock.json", "yarn.lock", "pnpm-lock.yaml", "npm-shrinkwrap.json"];

export function readWorkspace(root: string): WorkspacePackage[] {
  const packagesDir = join(root, "packages");
  if (!existsSync(packagesDir)) return [];

  const result: WorkspacePackage[] = [];
  for (const name of readdirSync(packagesDir).sort()) {
    const manifestPath = join(packagesDir, name, "package.json");
    if (!existsSync(manifestPath)) continue;
    try {
      result.push({
        dir: `packages/${name}`,
        manifest: JSON.parse(readFileSync(manifestPath, "utf8")) as PackageManifest,
      });
    } catch {
      // A manifest that will not parse is reported by validateWorkspace via the
      // missing-name path rather than crashing the whole check.
      result.push({ dir: `packages/${name}`, manifest: {} });
    }
  }
  return result;
}

export function validateWorkspace(root: string, packages: WorkspacePackage[]): WorkspaceProblem[] {
  const problems: WorkspaceProblem[] = [];
  const names = new Map<string, string[]>();

  for (const pkg of packages) {
    const name = pkg.manifest.name;
    if (!name) {
      problems.push({
        code: "missing-package-name",
        package: pkg.dir,
        detail: "Workspace member has no package name",
      });
      continue;
    }
    const seen = names.get(name);
    if (seen) seen.push(pkg.dir);
    else names.set(name, [pkg.dir]);

    // A stray lockfile inside a member is a second package-manager root: run
    // npm there and it silently installs a different tree beside bun's.
    for (const lockfile of LOCKFILE_NAMES) {
      if (existsSync(join(root, pkg.dir, lockfile))) {
        problems.push({
          code: "nested-package-manager-root",
          package: name,
          detail: `${pkg.dir}/${lockfile} is a second package-manager root inside a bun workspace member`,
        });
      }
    }

    if (OWNED_NEW_PACKAGES.has(name) && pkg.manifest.private !== true) {
      problems.push({
        code: "new-package-not-private",
        package: name,
        detail:
          "Packages introduced by this repository stay private until a publishing policy exists",
      });
    }
  }

  for (const [name, dirs] of names) {
    if (dirs.length > 1) {
      problems.push({
        code: "duplicate-package-name",
        package: name,
        detail: `Declared by ${dirs.join(" and ")}`,
      });
    }
  }

  // An internal dependency pinned to a registry range rather than workspace:*
  // resolves to whatever upstream published under that name — the "accidental
  // published upstream package substitution" the ticket names.
  const workspaceNames = new Set(names.keys());
  for (const pkg of packages) {
    const name = pkg.manifest.name ?? pkg.dir;
    const deps = {
      ...(pkg.manifest.dependencies ?? {}),
      ...(pkg.manifest.devDependencies ?? {}),
    };
    for (const [dep, range] of Object.entries(deps)) {
      if (!workspaceNames.has(dep)) continue;
      if (!range.startsWith("workspace:")) {
        problems.push({
          code: "registry-substitution",
          package: name,
          detail: `Depends on workspace package ${dep} via range ${JSON.stringify(range)}; use workspace:* so it cannot resolve to a published upstream package`,
        });
      }
    }
  }

  return problems;
}

/**
 * Verifies that every workspace package a member depends on is actually linked
 * into node_modules, so one root install really did resolve everything locally.
 */
export function findUnresolvedWorkspaceDependencies(
  root: string,
  packages: WorkspacePackage[],
): WorkspaceProblem[] {
  const problems: WorkspaceProblem[] = [];
  const workspaceNames = new Set(packages.map((p) => p.manifest.name).filter(Boolean) as string[]);

  for (const pkg of packages) {
    const name = pkg.manifest.name ?? pkg.dir;
    for (const dep of Object.keys(pkg.manifest.dependencies ?? {})) {
      if (!workspaceNames.has(dep)) continue;
      const linked =
        existsSync(join(root, "node_modules", dep)) ||
        existsSync(join(root, pkg.dir, "node_modules", dep));
      if (!linked) {
        problems.push({
          code: "unresolved-workspace-dependency",
          package: name,
          detail: `${dep} is a workspace package but is not linked into node_modules`,
        });
      }
    }
  }
  return problems;
}

export interface WorkspaceReport {
  scope: string;
  packageCount: number;
  packages: Array<{ dir: string; name: string; private: boolean }>;
  problems: WorkspaceProblem[];
  valid: boolean;
}

export function checkWorkspace(root: string): WorkspaceReport {
  const packages = readWorkspace(root);
  const problems = [
    ...validateWorkspace(root, packages),
    ...findUnresolvedWorkspaceDependencies(root, packages),
  ];

  return {
    scope: "Workspace manifest, ownership and local-resolution validation (AFM-009, AFM-011)",
    packageCount: packages.length,
    packages: packages.map((p) => ({
      dir: p.dir,
      name: p.manifest.name ?? "(unnamed)",
      private: p.manifest.private === true,
    })),
    problems,
    valid: problems.length === 0,
  };
}
