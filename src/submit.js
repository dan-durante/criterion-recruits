/**
 * Decide whether a configured endpoint is safe to call.
 * Empty is not sendable — the caller treats that as the local preview path.
 * Only http(s) URLs and same-site relative paths are allowed.
 */
export function isSendableEndpoint(endpoint) {
  if (typeof endpoint !== 'string') return false;
  const url = endpoint.trim();
  if (!url || url.startsWith('//')) return false;
  if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) {
    return true;
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function normalizeHeaders(headers) {
  const out = {};
  if (!headers || typeof headers !== 'object') return out;
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string' && value.trim()) out[key] = value;
  }
  return out;
}

/**
 * POST the payload when an endpoint is configured.
 * Returns { mode: 'local' } when there is nowhere to send it.
 * The caller logs the payload and shows success in that case.
 */
export async function submitInterest(endpoint, headers, payload) {
  const url = typeof endpoint === 'string' ? endpoint.trim() : '';
  if (!url) return { mode: 'local' };

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...normalizeHeaders(headers),
      },
      body: JSON.stringify(payload),
      credentials: 'omit',
      cache: 'no-store',
    });
  } catch (cause) {
    const error = new Error('Could not reach the form endpoint');
    error.cause = cause;
    throw error;
  }

  if (!response.ok) {
    const error = new Error('Form endpoint rejected the request');
    error.status = response.status;
    throw error;
  }

  return { mode: 'remote', status: response.status };
}
