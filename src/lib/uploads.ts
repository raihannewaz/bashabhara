import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR ?? "uploads");
export const MAX_BYTES = 5 * 1024 * 1024;
export const KEY_RE = /^[a-z0-9]+\/[a-f0-9]{32}\.(jpg|png|webp|pdf)$/;
export const MIME: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf" };

/** Identifies the real file type from its first bytes, ignoring the name and the browser-reported type. */
function sniff(b: Buffer): "jpg" | "png" | "webp" | "pdf" | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) return "png";
  if (b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP") return "webp";
  if (b.subarray(0, 4).toString() === "%PDF") return "pdf";
  return null;
}

/** Saves an uploaded file under the landlord's folder and returns its protected URL, or undefined when no file was chosen. */
export async function saveUpload(file: FormDataEntryValue | null, ownerId: string): Promise<string | undefined> {
  if (!(file instanceof File) || file.size === 0) return undefined;
  if (file.size > MAX_BYTES) throw new Error("File is larger than 5 MB");
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = sniff(buf);
  if (!ext) throw new Error("Upload a JPG, PNG, WebP or PDF file");
  const name = `${crypto.randomUUID().replace(/-/g, "")}.${ext}`;
  await fs.mkdir(path.join(UPLOAD_DIR, ownerId), { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, ownerId, name), buf);
  return `/api/files/${ownerId}/${name}`;
}
