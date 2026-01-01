# Bug Report: API OAuth redirect_uri Parameter Not Supported

## Issue
The frontend is passing a `redirect_uri` query parameter to `/api/v1/auth/github/login` to support multiple frontend instances on different ports, but the API is not accepting or using this parameter. Instead, it's redirecting to a hardcoded URL (`http://localhost:8080/auth/complete`).

## Expected Behavior
The API should:
1. Accept a `redirect_uri` query parameter on `/api/v1/auth/github/login`
2. Store this `redirect_uri` (e.g., in the OAuth state)
3. Use this `redirect_uri` when redirecting after OAuth callback completion
4. Allow multiple frontend instances (on different ports) to use the same API

## Current Behavior
- Frontend passes: `/api/v1/auth/github/login?redirect_uri=http://localhost:5173/auth/complete`
- API redirects to: `http://localhost:8080/auth/complete` (hardcoded)
- The `redirect_uri` parameter is ignored

## Impact
- **High**: Prevents multiple frontend instances from using the same API
- **High**: Breaks OAuth flow for frontend instances not running on port 8080
- **Medium**: Requires hardcoding frontend URLs in API configuration

## Requested Fix

### Option 1: Query Parameter (Recommended)
Accept `redirect_uri` as a query parameter:
```
GET /api/v1/auth/github/login?redirect_uri=http://localhost:5173/auth/complete
```

Store it in the OAuth state and use it when redirecting after callback.

### Option 2: Header-Based
Accept `redirect_uri` via a custom header (e.g., `X-Redirect-URI`).

### Option 3: Request Body
Accept `redirect_uri` in a POST request body (less RESTful for OAuth initiation).

## Implementation Details

### Frontend Implementation (Already Done)
The frontend now dynamically detects its own URL and passes it:
```typescript
const frontendOrigin = window.location.origin; // e.g., "http://localhost:5173"
const callbackUrl = `${frontendOrigin}/auth/complete`;
const authEndpoint = `${apiBaseUrl}/api/v1/auth/github/login?redirect_uri=${encodeURIComponent(callbackUrl)}`;
```

### API Changes Needed
1. **Parse `redirect_uri` query parameter** in `/api/v1/auth/github/login` handler
2. **Store `redirect_uri` in OAuth state** (alongside CSRF state token)
3. **Retrieve `redirect_uri` from state** in `/api/v1/auth/github/callback` handler
4. **Redirect to stored `redirect_uri`** instead of hardcoded URL
5. **Validate `redirect_uri`** (optional but recommended for security):
   - Ensure it's a valid URL
   - Optionally whitelist allowed origins/ports
   - Prevent open redirect vulnerabilities

### Security Considerations
- **Validate redirect_uri**: Ensure it's a valid URL format
- **Optional whitelist**: Consider allowing only specific origins (e.g., localhost ports)
- **Prevent open redirects**: Don't allow arbitrary external URLs unless explicitly configured
- **HTTPS in production**: Enforce HTTPS redirect URIs in production

## Test Cases

### Test 1: Basic redirect_uri support
1. Call: `GET /api/v1/auth/github/login?redirect_uri=http://localhost:5173/auth/complete`
2. Complete OAuth flow
3. **Expected**: Redirect to `http://localhost:5173/auth/complete?code=...`
4. **Actual**: Redirects to `http://localhost:8080/auth/complete?code=...`

### Test 2: Multiple ports
1. Frontend on port 5173: `GET /api/v1/auth/github/login?redirect_uri=http://localhost:5173/auth/complete`
2. Frontend on port 8080: `GET /api/v1/auth/github/login?redirect_uri=http://localhost:8080/auth/complete`
3. **Expected**: Each redirects to its own port
4. **Actual**: Both redirect to port 8080

### Test 3: Missing redirect_uri (backward compatibility)
1. Call: `GET /api/v1/auth/github/login` (no redirect_uri)
2. **Expected**: Uses default redirect URL (current behavior)
3. **Actual**: Should still work with default

## Related Files
- Frontend: `frontend/src/pages/Home.tsx` (line ~197)
- Frontend: `frontend/src/components/common/OnlineOfflineToggle.tsx` (line ~94)
- API Contract: `specs/001-data-modelling-app/contracts/api-contracts.md` (line ~33)

## Priority
**High** - Blocks multi-instance frontend development and breaks OAuth for non-default ports.

## Status
- [x] API accepts `redirect_uri` parameter ✅ **IMPLEMENTED**
- [x] API stores `redirect_uri` in OAuth state ✅ **IMPLEMENTED**
- [x] API uses `redirect_uri` for redirect after callback ✅ **IMPLEMENTED**
- [ ] Backward compatibility maintained (default redirect_uri) - **TO VERIFY**
- [ ] Security validation implemented - **TO VERIFY**
- [ ] Tests added - **TO VERIFY**

## Resolution
**Status**: ✅ **RESOLVED** - API now accepts and uses `redirect_uri` parameter.

The frontend implementation is already in place and compatible with the API changes:
- `frontend/src/pages/Home.tsx` - Passes `redirect_uri` dynamically
- `frontend/src/components/common/OnlineOfflineToggle.tsx` - Passes `redirect_uri` dynamically
- Both use `window.location.origin` to detect the frontend URL automatically

**Next Steps**:
1. Test OAuth flow with multiple frontend instances on different ports
2. Verify backward compatibility (OAuth without `redirect_uri` parameter)
3. Verify security validation (prevent open redirects)

