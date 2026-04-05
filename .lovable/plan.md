

## Problems identified

1. **Name field bug**: In `CrewGeneralData.tsx`, the "Nombre completo" input calls `set("first_name", ...)` and then `set("last_name", ...)` in the same event handler. Each `set` call spreads from the same stale `draft` object, so the second call overwrites the first. This makes it impossible to properly edit or clear the name.

2. **Document URLs blocked**: Documents are stored with a pre-generated signed URL (`createSignedUrl` with 1-year expiry). The URL points directly to `xolvbptlpuvjadyjsiyn.supabase.co` which Chrome ad blockers flag as a tracker (ERR_BLOCKED_BY_CLIENT). The fix is to store the **storage path** instead of the signed URL, and generate a fresh signed URL on-demand when the user clicks "Ver archivo".

3. **Photo upload doesn't persist**: `handlePhoto` creates a `blob:` URL which only exists in browser memory. It needs to upload to Supabase Storage and save the path.

---

## Plan

### 1. Fix name field editing (CrewGeneralData.tsx)

Split "Nombre completo" into two separate inputs: "Nombre" and "Apellido". This eliminates the double-set bug entirely and gives cleaner UX. Each field maps to its own `set()` call independently.

### 2. Fix photo upload to persist (CrewGeneralData.tsx)

- On file select, upload to `crew-documents/{employeeId}/photo_{timestamp}.{ext}` in Supabase Storage
- Store the **storage path** in `photo_url` field (not a blob URL)
- When displaying the avatar, generate a signed URL on the fly using `createSignedUrl`
- Add a small loading spinner during upload

### 3. Fix document storage and viewing (CrewDocuments.tsx)

**Upload flow** (UploadDocSheet):
- Store the **storage path** (e.g. `{employeeId}/1775323058658_Antecedentes.pdf`) in `file_url` column instead of a signed URL

**View flow** (document card "Ver archivo" button):
- When clicked, call `supabase.storage.from("crew-documents").createSignedUrl(doc.file_url, 3600)` to get a fresh URL
- Open that URL in a new tab
- Show a brief loading state on the button while generating

### 4. Migration for existing data

No schema migration needed -- the `file_url` column is already `text`. The change is purely in application logic (what value gets stored there).

---

## Technical details

**File: `src/components/crew/CrewGeneralData.tsx`**
- Replace the single "Nombre completo" input (lines 88-99) with two fields: "Nombre" (`first_name`) and "Apellido" (`last_name`), each with its own `set()` call
- Fix `set` function to properly merge: `const next = { ...draft, [key]: value }` -- this is actually fine per-call, the issue is two calls in one handler. Splitting fields solves it.
- Add async `handlePhoto` that uploads to Storage, gets path, calls `set("photo_url", storagePath)`
- Add a helper to resolve photo URLs via signed URL for display

**File: `src/components/crew/CrewDocuments.tsx`**
- In `handleSave`: store `storagePath` directly in `file_url` instead of `signedData.signedUrl`
- In document card: replace `window.open(doc.file_url)` with an async handler that generates a signed URL first, then opens it
- Remove the unused `getPublicUrl` call

**File: `src/pages/CrewProfile.tsx`**
- Update avatar display to use signed URL resolution for `employee.photo_url` if it's a storage path

