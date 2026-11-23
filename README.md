# Evora API

Node.js + Express 5 + PostgreSQL backend for the Evora admin panel, customer app and partner app.

## Setup

```bash
npm install
# create .env.development with DB_PASSWORD, JWT_SECRET and ADMIN_* values
npm run db:setup                   # creates the database, runs migrations, seeds the first super admin
npm run dev                        # http://localhost:4000
```

## Environments

`NODE_ENV` picks which file is loaded. Variables set on the server itself always override the file.

| NODE_ENV | File | Run server | Database setup |
|---|---|---|---|
| `development` (default) | `.env.development` | `npm run dev` | `npm run db:setup` |
| `testing` | `.env.testing` | `npm run start:testing` | `npm run db:setup:testing` |
| `staging` | `.env.staging` | `npm run start:staging` | `npm run db:setup:staging` |
| `production` | `.env.production` | `npm run start:production` | `npm run db:setup:production` |

Use `npm run db:migrate:<env>` to apply new migrations later.
Staging and production refuse to start unless `JWT_SECRET` is a random string of 32+ characters.
All `.env.*` files are git-ignored.

| Script | What it does |
|---|---|
| `npm run db:create` | Creates the `DB_NAME` database if it does not exist |
| `npm run db:migrate` | Applies new SQL files from `src/db/migrations` (tracked in `schema_migrations`) |
| `npm run db:seed` | Creates the super admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD` if missing |

## Project structure

```
src/
  config/env.js            environment config
  db/pool.js               PostgreSQL connection pool
  db/migrations/*.sql      schema migrations
  middleware/              auth (JWT + roles), validation (zod), error handling
  modules/auth/            email login (admin panel), mobile OTP login (customer + partner apps)
  services/sms.js          SMS sender used for OTPs
  modules/users/           current user's profile
  modules/admin/           admin user management
scripts/                   create-db, migrate, seed-admin
```

## API

All responses are JSON in the form `{ success, data?, message?, pagination? }`.
Protected routes need `Authorization: Bearer <token>`.

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/api/health` | public | API and database status |
| POST | `/api/auth/admin/login` | public | Admin panel login `{ email, password }`, returns `{ token, user }` |
| POST | `/api/auth/customer/send-otp` | public | Customer app: send/resend OTP `{ phone }` |
| POST | `/api/auth/customer/verify-otp` | public | Customer app: `{ phone, otp }` → `{ token, isNewUser, isProfileComplete, user }` |
| POST | `/api/auth/partner/send-otp` | public | Partner app: send/resend OTP `{ phone }` |
| POST | `/api/auth/partner/verify-otp` | public | Partner app: `{ phone, otp }` → `{ token, isNewUser, isProfileComplete, user }` |
| GET | `/api/users/me` | any user | Current user's profile |
| PATCH | `/api/users/me` | any user | Update `fullName`, `phone` |
| POST | `/api/users/me/change-password` | any user | `{ currentPassword, newPassword }` |
| GET | `/api/admin/users` | super_admin, admin | **Users list for the admin panel** |
| GET | `/api/admin/users/:id` | super_admin, admin | Single user |
| POST | `/api/admin/users` | super_admin, admin | Create a user (admin: customer/partner only) |
| PATCH | `/api/admin/users/:id` | super_admin, admin | Update details, `role`, `status` (admin: customer/partner only) |

### Admin panel roles

| Role | Can do |
|---|---|
| `super_admin` | Everything, including creating and managing `admin` and `super_admin` accounts |
| `admin` | View all users; create and manage `customer` and `partner` accounts only |

Nobody can change their own role or deactivate their own account. The first seeded admin is the super admin.

### `GET /api/admin/users`

| Query param | Default | Values |
|---|---|---|
| `page` | 1 | ≥ 1 |
| `limit` | 20 | 1–100 |
| `search` | | matches name, email or phone |
| `role` | | `super_admin`, `admin`, `customer`, `partner` |
| `status` | | `active`, `inactive`, `suspended` |
| `sortBy` | `createdAt` | `createdAt`, `fullName`, `email`, `lastLoginAt` |
| `order` | `desc` | `asc`, `desc` |

Example response:

```json
{
  "success": true,
  "data": [
    {
      "id": "6f1c…",
      "fullName": "Evora Admin",
      "email": "admin@evora.com",
      "phone": null,
      "role": "admin",
      "status": "active",
      "lastLoginAt": "2026-11-02T12:00:00.000Z",
      "createdAt": "2026-11-02T11:00:00.000Z",
      "updatedAt": "2026-11-02T12:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

### Mobile OTP login (customer and partner apps)

Same flow for both apps; the path decides the account type. One number can have both a customer and a partner account.

1. `POST /api/auth/{customer|partner}/send-otp` with `{ "phone": "+91 98765 43210" }` (also accepts `9876543210`, `919876543210`).
   Returns `{ phone, expiresInSeconds: 300, resendAfterSeconds: 30 }`. With `SMS_PROVIDER=console` outside production it also returns `devOtp`.
2. `POST /api/auth/{customer|partner}/verify-otp` with `{ "phone": "...", "otp": "482613" }`.
   Logs in, or creates the account on first login. If `isProfileComplete` is false, collect the name with `PATCH /api/users/me`.

| Status | When |
|---|---|
| 400 | Invalid phone/OTP format, wrong code (`details.attemptsLeft`), expired or used code |
| 403 | Account is inactive or suspended |
| 429 | Resend before 30s, more than 5 codes per hour, or 5 wrong attempts (`details.retryAfterSeconds` where relevant) |
| 502 | SMS could not be sent |
