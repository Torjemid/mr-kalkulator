This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

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

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
## Environment variables (Vercel & local)

This project requires the following environment variables for email sending and database access.

- `RESEND_API_KEY`: Your Resend API key (starts with `re_...`). Get it from https://resend.com → Dashboard → API keys. Add this in Vercel under Project Settings → Environment Variables and set it for Preview/Production as needed.
- `SUPABASE_URL`: Your Supabase project URL (from your Supabase project settings).
- `SUPABASE_SERVICE_ROLE_KEY`: The Supabase service role key (keep this secret; use only in server-side envs).

For local development, create a `.env.local` file at the repository root (do NOT commit it) with:

```env
RESEND_API_KEY=re_xxx
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

After setting the variables in Vercel, trigger a redeploy (or push a commit). Verify the deployment logs and test the `/api/lead` endpoint (submit the calculator form) to ensure no build/runtime errors remain.