# Следующее действие

Updated: 2026-07-25

Источник scope: `FEM_MVP_ACCELERATED_PLAN.md` версии 3.0.

## Текущая точка

Этапы 0–7 завершены со статусом **PASS**. Локальный production preview и
внешний HTTPS demo проверены.

Production:

- `https://fem-demo-web.vercel.app`;
- `https://fem-demo-api.vercel.app/api/health`;
- отдельная Neon demo-база `fem_showcase`;
- Vercel Node.js 22.x для frontend и backend;
- фиксированный администратор с password + TOTP;
- restricted pooled database role для runtime.

## Следующий разрешённый шаг

Показать demo заказчику и собрать замечания только по утверждённому scope:

1. спортсмены;
2. лошади;
3. соревнования;
4. категории/классы;
5. результаты.

После показа зарегистрировать подтверждённые замечания и определить, какие из
них входят в P1. Не расширять продукт автоматически.

Полная инструкция:
[`docs/deployment/VERCEL_DEMO_DEPLOYMENT.md`](../deployment/VERCEL_DEMO_DEPLOYMENT.md).
Статические demo credentials хранятся только в ignored
`.env.vercel.local` и password manager. Owner URL, bootstrap и seed flags не
переданы runtime-функции. Swagger выключен, secure cookie/HSTS и same-origin
rewrite проверены.

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
