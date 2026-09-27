# Tiers and API keys

Billing and key choice for each AI turn. `resolveApiKey` in `convex/ApiKeyResolver.ts` picks the OpenAI key. Free daily limits and Pro period checks live in `convex/users.ts` and `sendMessage` in `convex/chat.ts`. Settings UI: `app/settings/page.tsx`, `PlanOverview`, `ApiKeySection`.

Do not print key values in docs or logs from this map.

## Saved as

User fields on `users` (see [storage/schema.md](../storage/schema.md)): encrypted `openaiApiKey`, `tier`, Pro period fields, `dailyMessageCount`, token counters. Global free-token cap on `usage`.

## Shown from

| UI | Query |
| --- | --- |
| `ChatInterface` tier chip / free remaining | `getBillingStatus`, `getRemainingMessages` |
| Settings plan | `getBillingStatus` via `PlanOverview` |
| Settings / modal API key | `getApiKeyStatus`, `updateApiKey`, `deleteApiKey` via `ApiKeySection` / `ApiKeyModal` |

## Key resolution order (`resolveApiKey`)

1. **Admin** (`user.isAdmin`) — system `OPENAI_API_KEY`.
2. **In Pro period** (`isInProPeriod`) — Pro key while `proTokensUsedThisPeriod` &lt; monthly cap; if cap exhausted and BYOK exists, decrypt user key; otherwise error.
3. **BYOK** (`openaiApiKey` set, not in Pro path above) — decrypted user key.
4. **Free** — system key; `sendMessage` enforces the daily message limit via `canFreeUserSendMessage` / `incrementMessageCount`.

`isInProPeriod`: `proSubscriptionStatus` is `"active"` or `"canceled"`, and `now <= proCurrentPeriodEnd`.

## Schema or shape

Effective tier from `getBillingStatus`:

```ts
tier: "admin" | "pro" | "byok" | "free"
// plus pro: { status, isActive, currentPeriodEnd, tokensUsedThisPeriod, remainingTokens, byokFallbackNotifiedThisPeriod }
```

Limits from `CONFIG` in `convex/config.ts`: `FREE_TIER_DAILY_LIMIT`, `DEFAULT_PRO_MONTHLY_TOKEN_LIMIT`, `FREE_TIER_DAILY_TOKEN_CAP`.

## Routes

| Function | File | Role |
| --- | --- | --- |
| `resolveApiKey` | `convex/ApiKeyResolver.ts` | Choose key for `processMessage` |
| `isInProPeriod` | `convex/users.ts` | Pro window helper |
| `getBillingStatus` | `convex/users.ts` | Tier + Pro remaining tokens |
| `getApiKeyStatus` | `convex/users.ts` | Whether a key / admin is present (no secret) |
| `getRemainingMessages` | `convex/users.ts` | Free daily remaining |
| `sendMessage` free check | `convex/chat.ts` | Blocks free users over daily limit |

## Deletes and leftovers

Deleting a BYOK key (`deleteApiKey`) clears `openaiApiKey` on the user. Chat history and sandboxes are unrelated. Canceling Pro leaves the user in Pro until `proCurrentPeriodEnd` (`isInProPeriod`).

## Drift

Root `README.md` “Key Priority Hierarchy” lists Pro before Admin. `resolveApiKey` checks admin first.
