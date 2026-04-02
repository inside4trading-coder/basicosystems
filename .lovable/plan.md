

# Fix Zadarma WebRTC Key "Not Authorized" Error

## Root Cause

The HMAC signature in `zadarma-webrtc-key/index.ts` is wrong. The official Zadarma SDK (PHP) generates signatures as:

```text
base64_encode( hash_hmac('sha1', data, secret) )
       ↑ base64 of hex string
```

PHP's `hash_hmac` returns a **hex string** by default. So the correct signature is: base64 of the hex digest.

- `zadarma-sync` (working): `btoa(createHmac(...).digest("hex"))` — correct
- `zadarma-webrtc-key` (broken): `createHmac(...).digest("base64")` — this is base64 of binary, NOT base64 of hex

## Fix

**File: `supabase/functions/zadarma-webrtc-key/index.ts`**

Replace line 47:
```typescript
const signature = createHmac("sha1", zadarmaSecret).update(signStr).digest("base64");
```

With:
```typescript
const sha1Hex = createHmac("sha1", zadarmaSecret).update(signStr).digest("hex");
const signature = btoa(sha1Hex);
```

This matches exactly how `zadarma-sync` generates its signatures and aligns with the official Zadarma PHP SDK's `encodeSignature()` method.

No other changes needed.

