declare interface Env {
  readonly NODE_ENV: string;
  readonly NG_APP_PRODUCTION: string;
  readonly NG_APP_SUPABASE_URL: string;
  readonly NG_APP_SUPABASE_ANON_KEY: string;
  [key: string]: string;
}

declare interface ImportMeta {
  readonly env: Env;
}
