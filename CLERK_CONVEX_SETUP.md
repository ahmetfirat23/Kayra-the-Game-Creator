# Clerk + Convex JWT Setup

## Problem
Convex needs a JWT token from Clerk to verify user identity. Without the JWT template, `ctx.auth.getUserIdentity()` returns `null`.

## Solution: Configure JWT Template in Clerk

### Step 1: Go to Clerk Dashboard
1. Go to https://dashboard.clerk.com
2. Select your application
3. Go to **JWT Templates** (in the sidebar under "Configure")

### Step 2: Create Convex Template
1. Click **"New template"**
2. Select **"Convex"** from the list (it's a preset!)
3. Name it: `convex` (must be lowercase)
4. Click **"Save"**

### Step 3: Configure Convex
You also need to tell Convex about your Clerk domain:

1. Go to your Convex dashboard
2. Go to **Settings** → **Environment Variables**
3. Add:
   ```
   CLERK_JWT_ISSUER_DOMAIN=your-clerk-domain.clerk.accounts.dev
   ```
   
   (Find your domain in Clerk Dashboard → API Keys → "Issuer" field)

### Step 4: Update ConvexClientProvider (ALREADY DONE)
We're already using `ConvexProviderWithClerk` which handles the JWT automatically.

## After Setup
1. Refresh your app
2. Check browser console for "Syncing user..." and "User synced:"
3. Check Convex dashboard → Data → users table
4. You should see your user!

## Verification
Run this in browser console after refresh:
```javascript
// Should see your email/name
console.log("User synced!");
```

Check Convex logs for:
```
Identity: { ... }
Creating new user for: user_xxxxx
Created user: <userId>
```
