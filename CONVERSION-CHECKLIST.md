# MCP Server Web App Conversion Checklist

## Overview
Convert the Google Calendar MCP server to accept external Google OAuth tokens for web application integration.

---

## Phase 1: Core HTTP Transport Modifications

### 1. HTTP Transport Layer
- [ ] Create new `GoogleTokenHttpTransport` class in `src/transports/http.ts`
- [ ] Add `extractGoogleToken()` method to parse Authorization header
- [ ] Add `createOAuthClient()` method to create OAuth2Client from token
- [ ] Add `validateGoogleToken()` method with lightweight API call
- [ ] Add proper error handling for invalid/missing tokens
- [ ] Update CORS headers to allow Authorization header

### 2. Server Configuration
- [ ] Add environment variables support for Google client credentials
  - [ ] `GOOGLE_CLIENT_ID`
  - [ ] `GOOGLE_CLIENT_SECRET`
  - [ ] `MCP_AUTH_MODE` (optional: `internal` | `external`)
- [ ] Update `TransportConfig` interface to support external auth mode
- [ ] Modify `parseArgs()` to handle new auth configuration

### 3. Server Class Updates
- [ ] Modify `GoogleCalendarMcpServer` constructor to support external auth mode
- [ ] Update `executeWithHandler()` to accept external OAuth2Client
- [ ] Remove/conditionally disable `ensureAuthenticated()` calls for external mode
- [ ] Update startup authentication logic for external auth mode

---

## Phase 2: Internal Authentication Removal/Conditional

### 4. Authentication Components (Make Optional)
- [ ] Modify `src/server.ts` to skip internal auth when in external mode
- [ ] Update `handleStartupAuthentication()` to handle external auth mode
- [ ] Conditionally disable AuthServer initialization for external mode
- [ ] Keep internal auth as fallback for stdio transport

### 5. Configuration Updates
- [ ] Add configuration validation for external auth mode
- [ ] Ensure Google client credentials are required for external mode
- [ ] Add fallback behavior when external auth is disabled

---

## Phase 3: Tool Handler Updates (Minimal Changes)

### 6. Base Tool Handler
- [ ] Verify `BaseToolHandler.runTool()` accepts any OAuth2Client (should already work)
- [ ] Add optional user context parameter for future enhancements
- [ ] Ensure error handling works with external tokens

### 7. Individual Tool Handlers
- [ ] Test that existing handlers work with external OAuth2Client instances
- [ ] No changes should be needed (handlers are already generic)

---

## Phase 4: Error Handling & Validation

### 8. Error Handling
- [ ] Add specific error responses for missing Authorization header
- [ ] Add error handling for invalid Google tokens
- [ ] Add error handling for expired tokens
- [ ] Add proper HTTP status codes (401, 403, 400)
- [ ] Add error logging for debugging

### 9. Token Validation
- [ ] Implement lightweight Google API call for token validation
- [ ] Add token caching to reduce validation overhead (optional)
- [ ] Handle token refresh scenarios (or document requirement for web app)

---

## Phase 5: Documentation & Testing

### 10. Documentation Updates
- [ ] Update README.md with external auth mode instructions
- [ ] Add environment variable documentation
- [ ] Add web app integration examples
- [ ] Document HTTP API endpoints and expected headers

### 11. Testing
- [ ] Test external auth mode with valid Google tokens
- [ ] Test error handling with invalid/missing tokens
- [ ] Test that stdio mode still works with internal auth
- [ ] Verify all existing tool handlers work with external tokens

---

## Phase 6: Optional Enhancements

### 12. Production Readiness (Optional)
- [ ] Add request rate limiting per token
- [ ] Add comprehensive logging for audit trails
- [ ] Add token introspection/validation caching
- [ ] Add metrics collection for monitoring

### 13. Backward Compatibility (Optional)
- [ ] Ensure stdio transport continues to work unchanged
- [ ] Keep internal auth as default for non-HTTP transports
- [ ] Add migration guide for existing deployments

---

## Implementation Notes

### Key Files to Modify:
- `src/transports/http.ts` - Main HTTP transport changes
- `src/server.ts` - Server configuration and auth mode handling
- `src/config/TransportConfig.ts` - Configuration interface updates
- `README.md` - Documentation updates

### Key Principles:
- Keep changes minimal and focused
- Maintain backward compatibility for stdio transport
- Use existing OAuth2Client patterns throughout
- Make external auth opt-in initially

### Testing Strategy:
1. Test with curl/Postman using valid Google tokens
2. Verify existing tool functionality works unchanged
3. Test error scenarios (missing/invalid tokens)
4. Ensure stdio mode remains unaffected

---

## Success Criteria

✅ **External auth mode working**: HTTP transport accepts Google tokens in Authorization header
✅ **Tool handlers functional**: All existing calendar operations work with external tokens
✅ **Error handling**: Proper HTTP errors for auth failures
✅ **Backward compatibility**: Stdio transport and internal auth still work
✅ **Documentation**: Clear instructions for web app integration
