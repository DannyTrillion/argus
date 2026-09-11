/**
 * Small persisted settings for the running server. Today: whether unattended
 * automation (brief + watch loop) is paused. Toggled from the Status screen.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

interface Settings {
  automationPaused: boolean;
}

const FILE = process.env.SETTINGS_FILE ?? ".cache/settings.json";
let settings: Settings = load();

function load(): Settings {
  try {
    const s = JSON.parse(readFileSync(FILE, "utf8")) as Partial<Settings>;
    return { automationPaused: Boolean(s.automationPaused) };
  } catch {
    return { automationPaused: process.env.AUTOMATION_PAUSED === "1" };
  }
}

export function getSettings(): Settings {
  return { ...settings };
}

export function setAutomationPaused(paused: boolean): Settings {
  settings = { ...settings, automationPaused: paused };
  try {
    mkdirSync(dirname(FILE), { recursive: true });
    writeFileSync(FILE, JSON.stringify(settings));
  } catch (err) {
    console.warn("[settings] could not persist:", err instanceof Error ? err.message : err);
  }
  return getSettings();
}

export function automationPaused(): boolean {
  return settings.automationPaused;
}
