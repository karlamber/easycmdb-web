# easyCMDB

React SPA for easyCMDB, a configuration inventory of applications, landscapes, environments, and cloud resources. The API is [easycmdb-api](https://github.com/karlamber/easycmdb-api).

![easyCMDB — correlate landscapes, applications, environments, and resources](src/assets/easycmdb-hero.png)

Two areas:

- **Discover** — read-only listings and detail views
- **Management** — admin create, update, and soft-delete screens, role-gated

The product name is easyCMDB. The technical alias in the API, Postgres schema, and Cognito claim prefixes remains `argus`.

## Stack

| Layer | Choice |
| ----- | ------ |
| UI | React 19, function components and hooks |
| Build | Vite 6, `/api` dev proxy |
| Styling | Tailwind CSS v4, IBM Plex Sans, teal and slate tokens |
| Components | shadcn/ui (Radix primitives in `src/components/ui/`) |
| Routing | React Router v7 |
| Server state | TanStack Query |
| Auth session | Zustand |
| HTTP | axios (`src/api/http.ts`) |
| Hosting | Static files on S3, fronted by CloudFront |

If you read three files: `src/router/index.tsx`, `src/api/http.ts`, and `src/pages/discover/AllApplicationsPage.tsx`.

## Local development

Node 24 (`.nvmrc`).

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173`). The browser calls `VITE_API_BASE_URL` (default `/api`). In dev, Vite proxies that to `VITE_DEV_API_PROXY_TARGET` (default `http://127.0.0.1:3000`).

```bash
npm run lint
npm run type-check
npm run test:unit:ci
npm run build
```

### Auth modes

Match the API's `AUTH_MODE`.

| Use | API `AUTH_MODE` | SPA `VITE_AUTH_MODE` |
| --- | --------------- | -------------------- |
| Local demo, no identity provider | `basic` | `basic` |
| Cognito users | `cognito` or `both` | `cognito` or `both` |
| Demo plus SSO | `both` | `both` |

Basic auth posts the username and password to the API. The API holds the passwords. The browser keeps credentials in `sessionStorage` for the current tab only.

Cognito uses the hosted UI. Admin and application-editor access come from `custom:roles` or `cognito:groups`, matched to `VITE_ADMIN_ROLE_CLAIM_VALUE` and `VITE_APP_EDIT_ROLE_CLAIM_VALUE`.

## Deploy

`npm run build` typechecks and emits `dist/`. `scripts/deploy-poc.mjs` syncs that directory to an S3 bucket and invalidates CloudFront. Copy `.env.deploy.example` and fill in your own bucket and distribution. The VPC, DNS, and identity provider are provisioned separately.

## License

[MIT](LICENSE)
