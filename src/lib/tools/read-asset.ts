import crypto from "crypto";
import { dev } from "$app/environment";
import { base } from "$app/paths";
import { manifest, read_implementation } from "$app/server";

const fileEtags: Record<string, string> = {};

interface AssetData {
  length: number;
  mimeType: string;
  getEtag: () => Promise<string>;
  contents:
    | Blob
    | ArrayBuffer
    | DataView
    | FormData
    | ReadableStream
    | URLSearchParams
    | string;
}

export function readAsset(asset: string): AssetData {
  if (asset.startsWith("data:")) {
    // Inline data URL
    return readDataAsset(asset);
  }

  const file = dev && asset.startsWith("/@fs")
    ? asset
    : decodeURIComponent(asset.slice(base.length + 1));

  if (file in manifest._.server_assets) {
    const length = manifest._.server_assets[file];
    const mimeType = manifest.mimeTypes[file.slice(file.lastIndexOf("."))];

    return {
      length: length,
      mimeType: mimeType,
      contents: read_implementation(file),
      getEtag: async () => getEtagForFile(file),
    };
  }

  throw new Error(`Asset does not exist: ${file}`);
}

function readDataAsset(asset: string): AssetData {
  const firstComma = asset.indexOf(",");
  const header = asset.slice(0, firstComma);
  const data = asset.slice(firstComma + 1);
  const mimeType = header.split(";")[0].slice("data:".length) ||
    "application/octet-stream";

  if (header.endsWith(";base64")) {
    const decoded = b64_decode(data);

    return {
      length: decoded.byteLength,
      mimeType: mimeType,
      contents: decoded,
      getEtag: async () => getEtagForStr(data),
    };
  }

  const decoded = decodeURIComponent(data);

  return {
    length: decoded.length,
    mimeType: mimeType,
    contents: decoded,
    getEtag: async () => getEtagForStr(data),
  };
}

async function getEtagForFile(file: string): Promise<string> {
  if (file in fileEtags) {
    return fileEtags[file];
  }

  const hash = crypto.createHash("sha256");

  for await (const chunk of read_implementation(file)) {
    hash.update(chunk);
  }

  const etag = hash.digest("hex");

  // Cache for later usage
  Object.assign(fileEtags, { [file]: etag });

  return etag;
}

function getEtagForStr(str: string): string {
  const hash = crypto.createHash("sha256");
  hash.update(str);
  return hash.digest("hex");
}

function b64_decode(text: string): ArrayBufferLike {
  const d = atob(text);
  const u8 = new Uint8Array(d.length);

  for (let i = 0; i < d.length; i++) {
    u8[i] = d.charCodeAt(i);
  }

  return u8.buffer;
}
