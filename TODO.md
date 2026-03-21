# Resolve Vercel SSL/HSTS Error for mamahause.vercel.app [UPDATED]

## Current Status
✅ Timeout fixed
⚠️  HSTS/Cert error (caused by preload headers + alias cert)
✅ Configs updated

## New Diagnosis
**Progress**: Site responds (no timeout!) but ERR_CERT_AUTHORITY_INVALID
**Cause**: HSTS preload + Vercel custom domain cert issue

## Step-by-Step Fix

### 1. Configs Fixed [COMPLETED ✅]
- vercel.json: HSTS/CSP commented out
- next.config.js: HSTS preload/CSP commented out
- Kept safe headers (X-Frame/XSS/Content-Type)

### 2. Clear Browser HSTS [USER IMMEDIATE]
1. chrome://net-internals/#hsts
2. Domain: `mamahause.vercel.app` → Delete
3. Reload site

### 3. Test Production URL [NOW]
https://room-rent-management-nnkurjnqu-juandepoys-projects.vercel.app
(This has valid Vercel cert)

### 4. Deploy Changes [READY]
```
git add .
git commit -m \"Disable HSTS for SSL debugging\"
git push
```

### 5. Fix Alias Cert (Long-term)
Vercel dashboard > Domains > mamahause.vercel.app:
- Add DNS records (if custom domain)
- Wait cert propagation (24h)
- Re-enable HSTS later

### 6. Set Supabase Env Vars [STILL NEEDED]
Vercel > Settings > Env Vars:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY

## Expected Result
✅ Site loads without cert errors
✅ Login works (post env vars)

**Priority: Clear HSTS → test production URL → push → retest!**
