# Remaining Auth Integration Tasks

## Files That Need Updates:

### 1. `convex/chat.ts`
- [ ] Add auth checks to all mutations/queries
- [ ] Change `listChats` to filter by `userId`
- [ ] Update `createChat` to use current user's ID
- [ ] Pass user's API key (or admin system key) to agent

### 2. `convex/agent.ts`
- [ ] Accept `apiKey` parameter in agent initialization
- [ ] Use provided key instead of `process.env.OPENAI_API_KEY`

### 3. `app/page.tsx`
- [ ] Add user menu/profile button
- [ ] Check if user has API key, prompt if not
- [ ] Show "Settings" link

### 4. New Files Needed:
- [ ] `app/sign-in/[[...sign-in]]/page.tsx` - Clerk sign-in page
- [ ] `app/sign-up/[[...sign-up]]/page.tsx` - Clerk sign-up page
- [ ] `app/settings/page.tsx` - API key management

## Quick Next Steps:

1. Add Clerk keys to `.env.local`
2. I'll help update the remaining files
3. Test sign in/up flow
4. Set yourself as admin in Convex dashboard
5. Test BYOK with a regular account
