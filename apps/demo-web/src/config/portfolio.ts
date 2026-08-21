export const portfolioReadonly = import.meta.env.PROD
  ? import.meta.env.VITE_PORTFOLIO_READONLY !== 'false'
  : import.meta.env.VITE_PORTFOLIO_READONLY === 'true';

export const portfolioDemoUsername = import.meta.env.VITE_PORTFOLIO_DEMO_USERNAME ?? 'admin1';
export const portfolioDemoPassword = import.meta.env.VITE_PORTFOLIO_DEMO_PASSWORD ?? '123';
