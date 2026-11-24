// The visitor's name for the "Hi, <name>" greeting. Stored in the settings record on this device only.
import { cleanName } from "./migrate.ts";
import { settings, updateSettings } from "./settings.ts";

export { cleanName };

export interface Profile {
  readonly name: string | null;
}

export function readProfile(): Profile {
  return { name: settings().name };
}

export function writeProfile(profile: Profile): void {
  updateSettings({ name: profile.name === null ? null : cleanName(profile.name) });
}
