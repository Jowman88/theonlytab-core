interface UrlValidationResult {
  ok: boolean;
  normalizedUrl?: string;
  message?: string;
}

const disallowedHostnames = ['localhost', '127.0.0.1', '0.0.0.0'];

function isIpv4PrivateOrLocal(hostname: string): boolean {
  const ip = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
  if (!/^\d+(?:\.\d+){3}$/.test(ip)) return false;

  const octets = ip.split('.').map(Number);
  if (octets.some(part => Number.isNaN(part))) return false;

  const [a, b] = octets;
  if (a === 0 || a === 10 || a === 127 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 || a === 100 && b >= 64 && b <= 127 || a === 198 && (b === 18 || b === 19)) {
    return true;
  }

  return ip === '0.0.0.0';
}

function isLocalHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();

  if (disallowedHostnames.includes(normalized) || normalized.endsWith('.localhost') || normalized.endsWith('.local')) {
    return true;
  }

  return isIpv4PrivateOrLocal(normalized);
}

export function validateTargetUrl(rawUrl: string): UrlValidationResult {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { ok: false, message: 'A valid URL is required.' };
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { ok: false, message: 'A valid URL is required.' };
  }

  let candidate = trimmed;
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const parsed = new URL(candidate);

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { ok: false, message: 'Only http and https URLs are allowed.' };
    }

    if (parsed.username || parsed.password) {
      return { ok: false, message: 'URLs with embedded credentials are not allowed.' };
    }

    const hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (isLocalHostname(hostname)) {
      return { ok: false, message: 'Private and localhost URLs are not allowed.' };
    }

    return { ok: true, normalizedUrl: parsed.toString() };
  } catch {
    return { ok: false, message: 'The URL format is invalid.' };
  }
}

export function buildTargetUrl(rawUrl: string, startPath?: string): string {
  const validation = validateTargetUrl(rawUrl);
  if (!validation.ok || !validation.normalizedUrl) {
    throw new Error(validation.message || 'Invalid URL.');
  }

  let finalUrl = validation.normalizedUrl;
  const trimmedPath = (startPath || '').trim();
  if (!trimmedPath) {
    return finalUrl;
  }

  if (trimmedPath.startsWith('#')) {
    return `${finalUrl.replace(/\/$/, '')}${trimmedPath}`;
  }

  const cleanPath = trimmedPath.startsWith('/') ? trimmedPath : `/${trimmedPath}`;
  return `${finalUrl.replace(/\/$/, '')}${cleanPath}`;
}
