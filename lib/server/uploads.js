import "server-only";
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

export const MAX_UPLOAD = 20 * 1024 * 1024; // 20 MB

export function uploadDir() {
  const db = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "sentinel.db");
  const dir = path.join(path.dirname(db), "uploads");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Stores a File under a random name; returns the stored file name (never user-controlled). */
export async function saveUpload(file) {
  const name = randomBytes(16).toString("hex");
  fs.writeFileSync(path.join(uploadDir(), name), Buffer.from(await file.arrayBuffer()));
  return name;
}

export const readUpload = (stored) => fs.readFileSync(path.join(uploadDir(), path.basename(stored)));
export const removeUpload = (stored) => fs.rmSync(path.join(uploadDir(), path.basename(stored)), { force: true });
