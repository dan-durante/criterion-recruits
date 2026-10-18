/** Query params copied onto every interest-form payload. */
export const ATTRIBUTION_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'src',
];

const MAX_LEN = 200;

/**
 * Read UTM params and src from a query string.
 * Missing values are empty strings so the payload shape stays stable.
 * Any other query params are ignored.
 */
export function readAttribution(search = '') {
  const raw = String(search || '');
  const params = new URLSearchParams(raw.startsWith('?') ? raw.slice(1) : raw);
  const attribution = {};
  for (const key of ATTRIBUTION_KEYS) {
    const value = params.get(key) ?? '';
    attribution[key] = value.slice(0, MAX_LEN);
  }
  return attribution;
}
