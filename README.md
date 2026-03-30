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
3. Configure Firebase in [.env](.env) with:
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`
4. In Firebase Console, create a Firestore database and allow your app's authenticated users to read/write `users` and `events` collections.
5. For sharing links to other devices, set `VITE_PUBLIC_APP_URL` to your deployed domain (not localhost).
6. Run the app:
   `npm run dev`

## Access Rules

- Public events: anyone with the QR/link can access.
- Private events: only Gmail accounts added in Event Settings -> Allowed Gmail Accounts can access.
- Photos remain in Google Drive; Firebase stores only user and event metadata.
