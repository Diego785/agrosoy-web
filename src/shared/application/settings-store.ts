/** The settings administration changes from the screens, one JSON value per key. */
export const SETTING_KEYS = ["official_rate", "company_profile", "late_interest"] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];

/**
 * Each module reads its own key and validates what it finds (it may be missing or from an older
 * shape), so a bad value falls back to the module's defaults instead of breaking a screen.
 */
export interface SettingsStore {
  get(key: SettingKey): Promise<unknown>;
  set(key: SettingKey, value: unknown, actorId: string): Promise<void>;
}
