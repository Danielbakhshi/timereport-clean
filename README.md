# Time Reporting App - Clean Start

This is the clean-start version of the app.

## Test logins

- Admin: `admin` / `admin123`
- Employee: `anna` / `anna123`
- Employee: `erik` / `erik123`

## Supabase setup

1. Create a new Supabase project.
2. Open SQL Editor.
3. Create a new query.
4. Copy everything from `supabase-setup.sql`.
5. Paste and run it.
6. Go to Project Settings / API or Connect and copy:
   - Project URL
   - anon public key

## Vercel setup

Add these environment variables in Vercel before deploying:

```txt
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Then deploy the GitHub repo.

## Local development

```bash
npm install
cp .env.example .env.local
# Edit .env.local with your Supabase values
npm run dev
```

## Security note

This is a prototype. It uses simple demo login stored in Supabase and is not production-secure. For real production use, replace it with Supabase Auth or server-side authentication.
