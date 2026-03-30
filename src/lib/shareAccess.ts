import { issueEventShareToken } from './store';

function isLocalHostUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

function normalizeBaseUrl(url: string): string {
  const trimmed = url.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withProtocol.replace(/\/+$/, '');
}

export function getPublicAppBaseUrl(): string {
  const env = import.meta.env as Record<string, string | undefined>;
  const configured = env.VITE_PUBLIC_APP_URL;
  const runtimeOrigin = normalizeBaseUrl(window.location.origin);

  if (configured && configured.trim()) {
    const normalizedConfigured = normalizeBaseUrl(configured);
    // Prevent accidentally shipping localhost links in production sessions.
    if (isLocalHostUrl(normalizedConfigured) && !isLocalHostUrl(runtimeOrigin)) {
      return runtimeOrigin;
    }
    return normalizedConfigured;
  }

  return runtimeOrigin;
}

export async function createSecureClientDashboardUrl(eventId: string): Promise<string> {
  if (!eventId?.trim()) {
    throw new Error('Missing event id for secure share link.');
  }

  const token = await issueEventShareToken(eventId);
  if (!token) {
    throw new Error('Unable to create secure share link for this event.');
  }

  const base = getPublicAppBaseUrl();
  const params = new URLSearchParams({
    event: eventId,
    token,
  });

  return `${base}/client?${params.toString()}`;
}
