# Authentication & BYOK Setup

## 1. Get Clerk Keys
1. Go to https://clerk.com and create an account
2. Create a new application
3. Go to "API Keys" and copy:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`

## 2. Update .env.local
Add these variables to your `.env.local`:
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up  
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/
```

## 3. Set Admin Account
After signing up, run this in Convex dashboard:
```javascript
// Replace with your actual email
await ctx.db
  .query("users")
  .filter(q => q.eq(q.field("email"), "your-admin-email@example.com"))
  .first()
  .then(user => user && ctx.db.patch(user._id, { isAdmin: true }))
```

## 4. How it Works

**Admin Account (You):**
- Uses `OPENAI_API_KEY` from environment
- Can test without users needing API keys
- Set via `isAdmin: true` in database

**Regular Users:**
- Must provide their own OpenAI API key in settings
- Keys stored encrypted in Convex
- Billed directly by OpenAI

## 5. User Flow
1. User signs up with Clerk
2. Prompted to add OpenAI API key (or sees "trial" if admin)
3. Can create games using their key
4. Can update key in settings anytime
