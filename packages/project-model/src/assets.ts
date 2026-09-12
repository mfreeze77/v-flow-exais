/** AFM-023: portable, immutable local-asset references. No filesystem or UI imports. */
export const MAX_PROJECT_ASSETS = 128;
export const MAX_PROJECT_ASSET_BYTES = 64 * 1024 * 1024;
export const MAX_PROJECT_ASSETS_BYTES = 256 * 1024 * 1024;

interface AssetBase {
  id: string;
  sha256: string;
  /** Build-relative path; never the original workstation path. */
  path: string;
  byteLength: number;
  origin: { kind: "local-file"; name: string };
  /** Importing a file does not establish its copyright or redistribution rights. */
  rights: "unverified";
}

export type ProjectAsset = AssetBase &
  (
    | {
        kind: "audio";
        mediaType: "audio/wav";
        metadata: {
          measured: true;
          codec: string;
          durationSeconds: number;
          sampleRate: number;
          channels: number;
        };
      }
    | {
        kind: "image";
        mediaType: "image/png";
        metadata: { measured: true; codec: "png"; width: number; height: number };
      }
  );

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const positiveInteger = (value: unknown, maximum: number): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= maximum;

export function isLocalAssetName(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= 240 &&
    !value.includes("/") &&
    !value.includes("\\") &&
    !Array.from(value).some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    })
  );
}

/** Detailed validation also applies to commands; a type assertion is not validation. */
export function projectAssetProblems(value: unknown): string[] {
  if (
    !record(value) ||
    !exactKeys(value, [
      "id",
      "sha256",
      "path",
      "byteLength",
      "origin",
      "rights",
      "kind",
      "mediaType",
      "metadata",
    ])
  )
    return ["Asset record has unknown or missing fields."];
  const problems: string[] = [];
  if (typeof value.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.sha256))
    problems.push("Asset digest must be a lowercase SHA-256.");
  if (value.id !== `asset-${value.sha256}`) problems.push("Asset ID must identify its content.");
  const extension = value.kind === "audio" ? "wav" : value.kind === "image" ? "png" : null;
  if (!extension || value.path !== `assets/${value.sha256}.${extension}`)
    problems.push("Asset path must be the canonical build-relative content path.");
  if (!positiveInteger(value.byteLength, MAX_PROJECT_ASSET_BYTES))
    problems.push("Asset byte length is outside the supported limit.");
  if (
    !record(value.origin) ||
    !exactKeys(value.origin, ["kind", "name"]) ||
    value.origin.kind !== "local-file" ||
    !isLocalAssetName(value.origin.name)
  )
    problems.push("Asset origin must contain a local display name, not a filesystem path.");
  if (value.rights !== "unverified") problems.push("Local import cannot attest asset rights.");
  const metadata = value.metadata;
  if (!record(metadata) || metadata.measured !== true) {
    problems.push("Measured asset metadata is required.");
    return problems;
  }
  if (value.kind === "audio") {
    if (
      value.mediaType !== "audio/wav" ||
      !exactKeys(metadata, ["measured", "codec", "durationSeconds", "sampleRate", "channels"]) ||
      typeof metadata.codec !== "string" ||
      !/^[a-zA-Z0-9_]{1,64}$/.test(metadata.codec) ||
      typeof metadata.durationSeconds !== "number" ||
      !Number.isFinite(metadata.durationSeconds) ||
      metadata.durationSeconds <= 0 ||
      !positiveInteger(metadata.sampleRate, 768000) ||
      !positiveInteger(metadata.channels, 64)
    )
      problems.push("Invalid measured WAV metadata.");
  } else if (value.kind === "image") {
    if (
      value.mediaType !== "image/png" ||
      !exactKeys(metadata, ["measured", "codec", "width", "height"]) ||
      metadata.codec !== "png" ||
      !positiveInteger(metadata.width, 16384) ||
      !positiveInteger(metadata.height, 16384) ||
      Number(metadata.width) * Number(metadata.height) > 64_000_000
    )
      problems.push("Invalid measured PNG metadata.");
  } else problems.push("This asset slice supports WAV audio and PNG images only.");
  return problems;
}

export function assertProjectAsset(value: unknown): asserts value is ProjectAsset {
  const problems = projectAssetProblems(value);
  if (problems.length) throw new Error(`asset/invalid: ${problems.join(" ")}`);
}

/** Compares the entire record without making object property order significant. */
export function sameProjectAsset(left: ProjectAsset, right: ProjectAsset): boolean {
  const fields = (asset: ProjectAsset) => [
    asset.id,
    asset.sha256,
    asset.path,
    asset.byteLength,
    asset.origin.kind,
    asset.origin.name,
    asset.rights,
    asset.kind,
    asset.mediaType,
    asset.metadata.measured,
    asset.metadata.codec,
    ...(asset.kind === "audio"
      ? [asset.metadata.durationSeconds, asset.metadata.sampleRate, asset.metadata.channels]
      : [asset.metadata.width, asset.metadata.height]),
  ];
  return JSON.stringify(fields(left)) === JSON.stringify(fields(right));
}

export function projectAssetRegistryProblems(
  value: unknown,
  documentPaths: string[] = [],
): string[] {
  if (value === undefined) return []; // Old projects do not acquire an empty registry on open.
  if (!Array.isArray(value) || value.length > MAX_PROJECT_ASSETS)
    return ["Asset registry must be a bounded array."];
  const problems: string[] = [];
  const identities = new Set<string>();
  const documents = new Set(documentPaths.map((path) => path.normalize("NFC").toLowerCase()));
  let bytes = 0;
  for (const [index, candidate] of value.entries()) {
    const issues = projectAssetProblems(candidate);
    problems.push(...issues.map((message) => `Asset ${index}: ${message}`));
    if (issues.length) continue;
    const asset = candidate as ProjectAsset;
    if (identities.has(asset.id)) problems.push(`Asset ${index}: duplicate content identity.`);
    identities.add(asset.id);
    if (documents.has(asset.path))
      problems.push(`Asset ${index}: path collides with an authored document.`);
    bytes += asset.byteLength;
  }
  if (bytes > MAX_PROJECT_ASSETS_BYTES)
    problems.push("Project assets exceed the supported total byte limit.");
  return problems;
}
