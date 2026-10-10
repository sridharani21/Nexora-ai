This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Placement preparation

The placement integrity review console is restricted to verified Clerk accounts whose email addresses are listed in the server-side `PLACEMENT_OFFICER_EMAILS` environment variable. Set it to a comma-separated allowlist, for example `officer-one@example.com,officer-two@example.com`, in your local server environment or deployment settings. Do not use student-controlled or `NEXT_PUBLIC_` variables for this allowlist. If it is unset, officer access remains disabled. During the placement assessment, browser camera and microphone connection status is monitored locally; no audio/video is recorded or uploaded.

This repository currently uses Prisma schema synchronization rather than checked-in Prisma migration files. After reviewing a schema change and backing up the target database, apply it with `npx prisma db push`, then regenerate Prisma Client with `npx prisma generate`. Run these commands against the intended database environment; do not assume the local `.env` points to the deployment database.

The interview's optional voice input/output uses browser `SpeechRecognition` and `speechSynthesis`; it is not a real-time audio-provider integration. Browser support and audio processing policies vary, and Nexora stores interview transcripts rather than audio recordings. A server-side provider integration would be required for real-time, provider-managed voice. DSA links and student-reported solve statuses do not sync with LeetCode, and job listings/application statuses do not sync with employers. No email or SMS notification provider is configured.

Run the available deterministic scoring and evidence-aggregation tests with:

```bash
npm test
```

These unit tests cover placement-score weighting, missing evidence, formula versioning, and readiness aggregation. They do not replace database-backed tests for Clerk ownership, profile persistence, or protected-record access; no such integration-test framework is currently configured.

Browser push is optional and requires HTTPS (localhost is supported during development), a browser with Push API support, and these server environment variables:

- `NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY` — VAPID public key.
- `WEB_PUSH_VAPID_PRIVATE_KEY` — matching private key; keep it server-only.
- `WEB_PUSH_CONTACT` — VAPID contact, such as `mailto:admin@example.com`.
- `WEB_PUSH_ENCRYPTION_KEY` — a base64-encoded 32-byte key used to encrypt stored browser subscriptions.
- `CRON_SECRET` — a long random bearer secret protecting scheduled delivery.

Generate a VAPID key pair with `npx web-push generate-vapid-keys --json`. Generate the encryption key with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"` and a cron secret with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Put the values in uncommitted `.env.local` for development and in server-side deployment settings for production; never put private keys or the cron secret in `NEXT_PUBLIC_` variables.

`vercel.json` registers a daily `GET /api/cron/placement-reminders` Vercel Cron Job at 03:30 UTC (09:00 India time). Set `CRON_SECRET` in Vercel's server-side project environment; Vercel Cron will send it as a bearer authorization header. The endpoint respects each student's in-app reminder toggle and daily/weekly cadence, sends generic messages only, and prunes expired browser subscriptions. Confirm your Vercel plan supports the configured daily cron. No email/SMS provider or paid push service is used.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
