interface ImportMetaEnv {
  readonly PROD: boolean;
  readonly VITE_PORTFOLIO_READONLY?: string;
  readonly VITE_PORTFOLIO_DEMO_USERNAME?: string;
  readonly VITE_PORTFOLIO_DEMO_PASSWORD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
