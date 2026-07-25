# Следующее действие

Updated: 2026-07-25

Источник scope: `FEM_MVP_ACCELERATED_PLAN.md` версии 3.0.

## Текущая точка

Этапы 0–6 завершены со статусом **PASS**. Воспроизводимый локальный
production preview Этапа 7 также проходит утверждённый demo-сценарий.

## Единственный незавершённый пункт Этапа 7

Завершить реальное размещение уже подготовленных Vercel-проектов:

1. авторизовать Vercel CLI или импортировать репозиторий через Dashboard;
2. создать `fem-demo-api` из корня репозитория;
3. создать отдельную Neon demo-базу через Vercel Marketplace;
4. применить 17 migrations, guarded seed дважды и one-time admin bootstrap;
5. создать restricted runtime role и назначить его pooled URL API-проекту;
6. создать `fem-demo-web` из `apps/demo-web`;
7. связать frontend с API через `FEM_BACKEND_ORIGIN`;
8. выполнить clean-browser acceptance smoke.

Полная инструкция:
[`docs/deployment/VERCEL_DEMO_DEPLOYMENT.md`](../deployment/VERCEL_DEMO_DEPLOYMENT.md).
Статические demo credentials подготовлены в ignored `.env.vercel.local`;
database URL пока отсутствует, поэтому bootstrap удалённой учётной записи ещё
не выполнялся.

Перед внешним показом:

1. задать точный HTTPS `CORS_ALLOWED_ORIGINS`;
2. оставить secure cookie/HSTS и same-origin frontend proxy;
3. оставить Swagger выключенным;
4. не передавать owner URL или bootstrap/seed secrets runtime-функции;
5. выполнить smoke в чистой browser session;
6. повторить локальный fallback gate.

## Локальный fallback

```powershell
pnpm db:up
pnpm start:dev
pnpm web:build
pnpm web:preview
```

Используйте `127.0.0.1` для обоих приложений и не встраивайте credentials во
frontend.

## Не делать

- не расширять Public API;
- не создавать public website, dashboard, CMS, Excel/import, ranking или
  owners UI;
- не создавать отдельные продуктовые страницы классов и результатов;
- не менять Prisma schema без доказанного frontend-блокера;
- не использовать production/development DB для demo seed или mutating tests.
