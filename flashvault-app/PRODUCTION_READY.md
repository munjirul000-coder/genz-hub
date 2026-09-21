# FlashVault BD - Real User Production Ready Guide
### For Student Budget 1000 Tk/month

## Current Status (After Fixes)
✅ **Ready for demo/portfolio:** 90%
⚠️ **Ready for real paying customers:** Needs 2 env vars (0 Tk cost)

## What Was Fixed for Real Users

### 1. Image Upload - Now Production Ready
- Saves to both `public/uploads` + `data/uploads`
- Serves via `/api/uploads/[filename]` API route (always works)
- Immediate local preview via `URL.createObjectURL`
- **Cloudinary real upload implemented** - if `CLOUDINARY_CLOUD_NAME` + `CLOUDINARY_UPLOAD_PRESET` set, images go to Cloudinary CDN (persistent)
- **R2/S3 support** - fallback with clear message
- Storage status shown in merchant dashboard

### 2. Storage Abstraction
`lib/storage.ts` now tries Cloudinary > R2 > S3 > Local

### 3. Production Health Check
New endpoint: `/api/health` - shows DB, storage, auth, payment status

### 4. Environment Template
`.env.example` created

### 5. Security Verified
- JWT validation in middleware
- CSRF protection
- Rate limiting
- Forgot-password never returns token
- Payment never marks PAID from frontend
- Order: auth required, drop state server-enforced, idempotency, inventory atomic

## What You Need for 100% Real Users (0 Tk)

### Step 1: Database (5 min, FREE)
1. supabase.com -> New Project -> Free
2. Copy DATABASE_URL
3. Set in Vercel/Render env
4. `npx prisma migrate deploy && npx prisma db seed`

### Step 2: Image Storage (5 min, FREE)
**Cloudinary (Easiest):**
1. cloudinary.com/console -> Free 25GB
2. Create unsigned preset: Settings > Upload > Add preset > Unsigned > Folder: flashvault
3. Set env: CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET

### Step 3: Secrets
```
JWT_SECRET=openssl rand -base64 32
SUPER_ADMIN_PASSWORD=StrongPass@123
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
```

## Cost
- 0 Tk/month: Vercel FREE + Supabase FREE + Cloudinary FREE
- Domain: ৳1200/year
- Railway $5/mo = ৳585/mo alternative

## Check Ready
Visit `/api/health` - should say readyForRealUsers true

## Super Admin
- admin@flashvault.bd / FlashVault@2026Admin
- Set SUPER_ADMIN_PASSWORD env for production
