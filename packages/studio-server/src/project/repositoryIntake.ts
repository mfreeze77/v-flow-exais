import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  constants,
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { createVideoProposals, type VideoProposal } from "./videoProposals";

export interface SourceRoot {
  id: string;
  label: string;
  path: string;
}
export type SourceRequest =
  | { kind: "local"; rootId: string; path: string }
  | { kind: "github"; url: string };
export interface SourceFile {
  path: string;
  sha256: string;
  bytes: number;
}
export interface SourcePackage {
  name: string;
  path: string;
  description: string;
  dependencies: string[];
  scripts: string[];
  citation: SourceFile;
}
export interface RepositoryFacts {
  title: string;
  revision: string | null;
  dirty: boolean;
  snapshotHash: string;
  fileCount: number;
  languages: Record<string, number>;
  packages: SourcePackage[];
  files: SourceFile[];
  limitations: string[];
}
export interface RepositoryIntake {
  schemaVersion: 1;
  id: string;
  createdAt: string;
  facts: RepositoryFacts;
  proposals: VideoProposal[];
}
export const digest = (bytes: string | Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
const skipped = new Set([
  "node_modules",
  ".git",
  "_sources",
  "dist",
  "build",
  "coverage",
  "evidence",
  ".vflow",
  ".next",
  "vendor",
  ".venv",
  "venv",
  ".agents",
  "data",
  "fixtures",
  "test",
  "tests",
  "__tests__",
]);
const safeFile = (name: string) =>
  !name.split("/").some((part) => part.startsWith(".") || skipped.has(part)) &&
  !/^(docs\/(upstream|implementation)|tools\/upstream-archify)\//.test(name) &&
  !/(^|\/)(?:credentials|secrets?|id_rsa|id_ed25519|config\.local)(\.|\/|$)/i.test(name) &&
  !/\.(pem|key|p12|pfx|jks|sqlite|db|zip|mp4|png|jpg|woff2?|lock)$/i.test(name);
const languages: Record<string, string> = {
  ".ts": "TypeScript",
  ".tsx": "TypeScript",
  ".js": "JavaScript",
  ".mjs": "JavaScript",
  ".py": "Python",
  ".go": "Go",
  ".rs": "Rust",
  ".java": "Java",
  ".cs": "C#",
  ".html": "HTML",
  ".css": "CSS",
  ".sh": "Shell",
};

/** Every component is checked; a selected source root never grants sibling access. */
export function contained(root: string, path: string) {
  const base = realpathSync(root);
  const target = resolve(base, path);
  const rel = relative(base, target);
  if (rel.startsWith("..") || isAbsolute(rel))
    throw new Error("Source path is outside the authorized root.");
  let current = base;
  for (const part of rel.split(/[\\/]/).filter(Boolean)) {
    current = join(current, part);
    if (existsSync(current) && lstatSync(current).isSymbolicLink())
      throw new Error("Source symlinks are not followed.");
  }
  return target;
}

function inventory(root: string): string[] {
  try {
    return execFileSync(
      "git",
      [
        "--no-optional-locks",
        "-c",
        `safe.directory=${root}`,
        "-C",
        root,
        "ls-files",
        "--cached",
        "--others",
        "--exclude-standard",
        "-z",
      ],
      {
        encoding: "utf8",
        timeout: 15_000,
        maxBuffer: 8_000_000,
        stdio: ["ignore", "pipe", "pipe"],
      },
    )
      .split("\0")
      .filter(Boolean);
  } catch {
    const files: string[] = [];
    const visit = (dir: string, depth: number) => {
      if (depth > 8 || files.length > 10_000) return;
      for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
        const name = dir ? `${dir}/${entry.name}` : entry.name;
        if (!safeFile(name) || entry.isSymbolicLink()) continue;
        if (entry.isDirectory()) visit(name, depth + 1);
        else if (entry.isFile()) files.push(name);
      }
    };
    visit("", 0);
    return files;
  }
}

function readSource(root: string, name: string): Buffer | null {
  const file = contained(root, name);
  const stat = lstatSync(file);
  if (!stat.isFile() || stat.size > 512_000) return null;
  const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    return readFileSync(fd);
  } finally {
    closeSync(fd);
  }
}

export function inspectRepository(root: string, snapshotDir: string): RepositoryFacts {
  const names = [...new Set(inventory(root))].filter(safeFile).sort().slice(0, 10_000);
  const counts: Record<string, number> = {};
  const packages: SourcePackage[] = [];
  const files: SourceFile[] = [];
  let workspacePatterns: string[] | null = null;
  let byteCount = 0;
  for (const name of names) {
    const language = languages[extname(name)];
    if (language) counts[language] = (counts[language] || 0) + 1;
    // Capture bounded package/config evidence, never execute repository code.
    if (
      !(
        basename(name) === "package.json" ||
        /(^|\/)(pyproject\.toml|Cargo\.toml|go\.mod|Dockerfile|compose\.ya?ml|README\.md)$/i.test(
          name,
        )
      )
    )
      continue;
    const bytes = readSource(root, name);
    if (!bytes || byteCount + bytes.length > 8_000_000) continue;
    const content = bytes.toString("utf8");
    if (
      /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:ghp_[a-zA-Z0-9]{30,}|sk-(?:proj-)?[a-zA-Z0-9_-]{35,})/.test(
        content,
      )
    )
      continue;
    byteCount += bytes.length;
    const citation = { path: name, sha256: digest(bytes), bytes: bytes.length };
    files.push(citation);
    const dest = join(snapshotDir, name);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, bytes, { flag: "wx", mode: 0o600 });
    if (basename(name) !== "package.json") continue;
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      continue;
    }
    if (name === "package.json") {
      const declared = Array.isArray(parsed.workspaces)
        ? parsed.workspaces
        : parsed.workspaces?.packages;
      workspacePatterns = Array.isArray(declared)
        ? declared.filter((pattern: unknown) => typeof pattern === "string")
        : [];
    }
    if (!parsed || typeof parsed !== "object" || typeof parsed.name !== "string") continue;
    packages.push({
      name: parsed.name.slice(0, 160),
      path: name,
      description: typeof parsed.description === "string" ? parsed.description.slice(0, 400) : "",
      dependencies: Object.keys({
        ...parsed.dependencies,
        ...parsed.devDependencies,
        ...parsed.optionalDependencies,
      }).sort(),
      scripts: Object.keys(parsed.scripts || {}).sort(),
      citation,
    });
  }
  let revision: string | null = null;
  let dirty = true;
  try {
    const git = (args: string[]) =>
      execFileSync(
        "git",
        ["--no-optional-locks", "-c", `safe.directory=${root}`, "-C", root, ...args],
        { encoding: "utf8", timeout: 15_000, stdio: ["ignore", "pipe", "pipe"] },
      ).trim();
    revision = git(["rev-parse", "HEAD"]);
    dirty = git(["status", "--porcelain", "--untracked-files=no"]).length > 0;
  } catch {
    /* Local non-Git folders remain supported and explicitly unversioned. */
  }
  const title = packages.find((item) => item.path === "package.json")?.name || basename(root);
  const matchesWorkspace = (path: string) =>
    workspacePatterns?.some((pattern) => {
      const expression = pattern
        .replace(/\*\*/g, "\u0001")
        .replace(/\*/g, "\u0002")
        .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\u0001/g, ".*")
        .replace(/\u0002/g, "[^/]+");
      return new RegExp(`^${expression.replace(/\/$/, "")}$`).test(dirname(path));
    });
  const scopedPackages =
    workspacePatterns === null
      ? packages
      : packages.filter((item) => item.path === "package.json" || matchesWorkspace(item.path));
  return {
    title,
    revision,
    dirty,
    snapshotHash: digest(JSON.stringify({ files, counts, names })),
    fileCount: names.length,
    languages: counts,
    packages: scopedPackages,
    files,
    limitations: [
      "Static source inventory and declared package dependencies; runtime and deployment behavior are not inferred.",
      "Dependency, generated, hidden, test and secret-bearing inputs are excluded. At most 10,000 paths and 8 MB of configuration evidence are inspected.",
    ],
  };
}

export async function createRepositoryIntake(
  home: string,
  roots: SourceRoot[],
  request: SourceRequest,
): Promise<RepositoryIntake> {
  const id = `intake-${randomUUID()}`;
  const dir = join(home, id);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  let root: string;
  if (request.kind === "local") {
    const authority = roots.find((item) => item.id === request.rootId);
    if (!authority || typeof request.path !== "string" || request.path.length > 512)
      throw new Error("Choose an authorized local source root.");
    root = contained(authority.path, request.path);
  } else if (request.kind === "github") {
    const url = new URL(request.url);
    if (
      url.protocol !== "https:" ||
      url.hostname !== "github.com" ||
      url.port ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !/^\/[\w.-]+\/[\w.-]+(?:\.git)?\/?$/.test(url.pathname)
    )
      throw new Error(
        "Use an HTTPS GitHub repository URL without credentials or extra path segments.",
      );
    root = join(dir, "checkout");
    execFileSync(
      "git",
      [
        "-c",
        "core.hooksPath=/dev/null",
        "-c",
        "protocol.file.allow=never",
        "-c",
        "credential.helper=",
        "clone",
        "--depth=1",
        "--no-recurse-submodules",
        "--",
        url.href,
        root,
      ],
      {
        timeout: 120_000,
        maxBuffer: 2_000_000,
        env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_CONFIG_NOSYSTEM: "1" },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
  } else throw new Error("Unsupported source kind.");
  const facts = inspectRepository(root, join(dir, "snapshot"));
  const intake: RepositoryIntake = {
    schemaVersion: 1,
    id,
    createdAt: new Date().toISOString(),
    facts,
    proposals: createVideoProposals(facts),
  };
  writeFileSync(join(dir, "intake.json"), JSON.stringify(intake, null, 2), {
    flag: "wx",
    mode: 0o600,
  });
  return intake;
}
