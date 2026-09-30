/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend API origin in production, e.g. https://api.example.com — empty = same-origin / Vite proxy */
  readonly VITE_API_BASE_URL: string;
  /** Supabase project URL (public) — required for production admin login */
  readonly VITE_SUPABASE_URL: string;
  /** Supabase anon key (public) — never put service_role here */
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
