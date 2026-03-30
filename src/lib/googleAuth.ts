const GOOGLE_OAUTH_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive',
].join(' ');

const GOOGLE_TOKEN_KEY = 'snapsearch.google.token';
const GOOGLE_TOKEN_EXP_KEY = 'snapsearch.google.token.exp';

type TokenCallback = (response: {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}) => void;

interface TokenClient {
  requestAccessToken: (options?: { prompt?: string }) => void;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: TokenCallback;
            error_callback?: (error: unknown) => void;
          }) => TokenClient;
        };
      };
    };
  }
}

function getGoogleClientId(): string {
  const env = import.meta.env as Record<string, string | undefined>;
  return env.VITE_GOOGLE_CLIENT_ID || '';
}

function saveToken(accessToken: string, expiresIn = 3600) {
  const expiresAt = Date.now() + expiresIn * 1000;
  localStorage.setItem(GOOGLE_TOKEN_KEY, accessToken);
  localStorage.setItem(GOOGLE_TOKEN_EXP_KEY, String(expiresAt));
}

export function clearGoogleToken() {
  localStorage.removeItem(GOOGLE_TOKEN_KEY);
  localStorage.removeItem(GOOGLE_TOKEN_EXP_KEY);
}

export function getStoredAccessToken(): string | null {
  const token = localStorage.getItem(GOOGLE_TOKEN_KEY);
  const expRaw = localStorage.getItem(GOOGLE_TOKEN_EXP_KEY);
  const expiresAt = expRaw ? Number(expRaw) : 0;

  if (!token || !expiresAt || Number.isNaN(expiresAt) || Date.now() >= expiresAt - 15000) {
    return null;
  }
  return token;
}

async function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.oauth2) return;

  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[data-google-identity="true"]') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Identity script')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity script'));
    document.head.appendChild(script);
  });
}

export async function ensureGoogleAccessToken(interactive: boolean): Promise<string> {
  const cached = getStoredAccessToken();
  if (cached) return cached;

  const clientId = getGoogleClientId();
  if (!clientId) {
    throw new Error('Missing VITE_GOOGLE_CLIENT_ID in .env.local');
  }

  await loadGoogleScript();

  const oauth = window.google?.accounts?.oauth2;
  if (!oauth) {
    throw new Error('Google OAuth is not available in this browser.');
  }

  const token = await new Promise<string>((resolve, reject) => {
    const client = oauth.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_OAUTH_SCOPES,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error_description || response.error || 'Google login failed'));
          return;
        }
        saveToken(response.access_token, response.expires_in || 3600);
        resolve(response.access_token);
      },
      error_callback: () => reject(new Error('Google OAuth popup failed to open or was blocked.')),
    });

    client.requestAccessToken({ prompt: interactive ? 'consent' : '' });
  });

  return token;
}

export async function fetchGoogleUserProfile(accessToken: string) {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch Google profile');
  }

  const payload = (await response.json()) as {
    sub: string;
    name?: string;
    email?: string;
    picture?: string;
  };

  return {
    uid: payload.sub,
    displayName: payload.name || payload.email || 'Google User',
    email: payload.email || 'unknown@google-user.local',
    photoURL: payload.picture,
  };
}
