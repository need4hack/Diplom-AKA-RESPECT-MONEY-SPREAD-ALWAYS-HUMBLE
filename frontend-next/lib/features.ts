const ENABLED_VALUES = new Set(["1", "true", "yes", "on"]);

function parsePublicFlag(value: string | undefined, fallback = false) {
  if (!value) {
    return fallback;
  }

  return ENABLED_VALUES.has(value.trim().toLowerCase());
}

export const FEATURES = {
  masters: parsePublicFlag(process.env.NEXT_PUBLIC_ENABLE_MASTERS, false),
} as const;

export function isFeatureEnabled(feature: keyof typeof FEATURES) {
  return FEATURES[feature];
}
