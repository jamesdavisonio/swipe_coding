/// <reference types="vite/client" />

// The VITE_* variables this app reads (see .env.example). Declaring them here gives them
// `string | undefined` instead of the `any` from Vite's catch-all index signature.
interface ImportMetaEnv {
  readonly VITE_USE_EMULATOR?: string
  readonly VITE_FIREBASE_PROJECT_ID?: string
  readonly VITE_FIREBASE_API_KEY?: string
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string
  readonly VITE_FIREBASE_APP_ID?: string
  readonly VITE_FIREBASE_VAPID_KEY?: string
}
