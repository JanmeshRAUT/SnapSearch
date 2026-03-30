<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/3538ec59-48c5-43b2-a561-937035097a67

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Set `VITE_GOOGLE_CLIENT_ID` in [.env.local](.env.local) for Google sign-in and Drive access.
4. For sharing links to other devices, set `VITE_PUBLIC_APP_URL` to your deployed domain (not localhost).
5. Run the app:
   `npm run dev`

## Access Rules

- Public events: anyone with the QR/link can access.
- Private events: only Gmail accounts added in Event Settings -> Allowed Gmail Accounts can access.
- Photos remain in Google Drive; event metadata is stored locally in your browser.
