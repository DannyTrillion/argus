/**
 * Read-only conversation shares. The client posts a slimmed transcript, gets an id,
 * and anyone with the link can read it. File-backed, capped in size and count.
 */
import { mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

const DIR = process.env.SHARE_DIR ?? ".cache/shares";
const MAX_BYTES = 300_000;
const MAX_FILES = 500;

export interface Share {
  id: string;
  title: string;
  createdAt: string;
  messages: unknown[];
}

function ensureDir(): void {
  mkdirSync(DIR, { recursive: true });
}

function prune(): void {
  try {
    const files = readdirSync(DIR).filter((f) => f.endsWith(".json")).map((f) => ({ f, t: statSync(join(DIR, f)).mtimeMs })).sort((a, b) => a.t - b.t);
    for (const x of files.slice(0, Math.max(0, files.length - MAX_FILES))) unlinkSync(join(DIR, x.f));
  } catch { /* ignore */ }
}

export function createShare(input: { title?: unknown; messages?: unknown }): Share {
  if (!Array.isArray(input.messages) || input.messages.length === 0) throw new Error("messages required");
  const title = typeof input.title === "string" && input.title.trim() ? input.title.trim().slice(0, 120) : "Argus conversation";
  const share: Share = { id: randomBytes(6).toString("base64url"), title, createdAt: new Date().toISOString(), messages: input.messages.slice(0, 60) };
  const body = JSON.stringify(share);
  if (body.length > MAX_BYTES) throw new Error("conversation too large to share");
  ensureDir();
  writeFileSync(join(DIR, `${share.id}.json`), body);
  prune();
  return share;
}

export function readShare(id: string): Share | null {
  if (!/^[A-Za-z0-9_-]{6,16}$/.test(id)) return null;
  try {
    return JSON.parse(readFileSync(join(DIR, `${id}.json`), "utf8")) as Share;
  } catch {
    return null;
  }
}
