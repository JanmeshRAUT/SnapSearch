/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_GOOGLE_CLIENT_ID?: string;
	readonly VITE_GEMINI_API_KEY?: string;
	readonly VITE_PUBLIC_APP_URL?: string;
	readonly APP_URL?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
