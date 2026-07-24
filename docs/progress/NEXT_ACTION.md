# Следующее действие

Updated: 2026-07-24

Источник scope: `FEM_MVP_ACCELERATED_PLAN.md` версии 3.0.

## Текущая точка

Этапы 0–6 завершены со статусом **PASS**. Воспроизводимый локальный
production preview Этапа 7 также проходит утверждённый demo-сценарий.

## Единственный незавершённый пункт Этапа 7

Разместить frontend и backend в контролируемой внешней demo-среде после
предоставления:

- hosting/project access;
- отдельной demo PostgreSQL и restricted runtime credential;
- DNS/TLS или готового HTTPS origin;
- deployment secret storage;
- согласованной demo-учётной записи, передаваемой вне frontend/repository.

Перед внешним показом:

1. задать точный HTTPS `CORS_ALLOWED_ORIGINS`;
2. включить secure cookie/HSTS с корректным proxy trust;
3. выключить Swagger либо защитить его отдельными credentials;
4. применить 17 migrations и guarded demo seed к отдельной demo-БД;
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
