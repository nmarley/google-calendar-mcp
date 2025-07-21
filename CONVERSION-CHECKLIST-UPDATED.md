# MCP Server Web App Conversion Checklist (UPDATED)

## Overview
Convert the Google Calendar MCP server to accept external Google OAuth tokens while **preserving MCP tool discovery and LLM orchestration**.

**⚠️ Key Principle**: The LLM should still discover tools via `tools/list` and call them dynamically. We're only adding token injection, not converting to a procedural API.

**Goal**: Enable this flow:
1. LLM calls `tools/list` → discovers calendar tools
2. LLM calls `tools/call` with tool name + args
3. Your backend injects Google token into MCP request
4. MCP server executes tool with user's credentials
5. LLM gets result and continues orchestration

---

## Phase 1: Token Injection (Preserve MCP Interface)

### 1. HTTP Transport Token Handling
- [ ] **Modify existing** `HttpTransportHandler` in `src/transports/http.ts` (don't create new class)
- [ ] Add `extractGoogleToken()` method to parse `Authorization: Bearer <token>` from requests
- [ ] Add lightweight token validation (call Google API to verify token works)
- [ ] **Preserve all existing MCP endpoints**:
  - [ ] `GET /health` (no auth needed)
  - [ ] `POST /` with `method: "initialize"` (no auth needed)
  - [ ] `POST /` with `method: "tools/list"` (no auth needed)
  - [ ] `POST /` with `method: "tools/call"` (requires auth)
- [ ] Update CORS headers to allow `Authorization` header

### 2. Server Configuration for External Auth
- [ ] Add environment variables for token validation:
  - [ ] `GOOGLE_CLIENT_ID` - For validating tokens
  - [ ] `GOOGLE_CLIENT_SECRET` - For validating tokens
  - [ ] `MCP_AUTH_MODE=external` - Enable external token mode
- [ ] **Keep existing stdio configuration unchanged** (backward compatibility)
- [ ] Update `TransportConfig` to support external auth mode

### 3. Per-Request OAuth2Client Creation
- [ ] Modify `executeWithHandler()` in `src/server.ts` to:
  - [ ] Extract token from HTTP request (when in external mode)
  - [ ] Create OAuth2Client with extracted token for this request only
  - [ ] Pass OAuth2Client to tool handler (existing pattern)
- [ ] **Keep existing tool registration completely unchanged**
- [ ] Add proper error handling for missing/invalid tokens
- [ ] **Ensure tool discovery works without auth**: `tools/list` should not require tokens

---

## Phase 2: Conditional Authentication

### 4. Server Mode Handling
- [ ] Modify `GoogleCalendarMcpServer` to support both modes:
  - [ ] **stdio mode**: Use existing internal authentication (unchanged)
  - [ ] **HTTP + external mode**: Skip internal auth, use per-request tokens
- [ ] Update `handleStartupAuthentication()` to skip for external HTTP mode
- [ ] Keep internal `AuthServer` for stdio/internal modes

### 5. Tool Handler Compatibility
- [ ] **Verify existing handlers work unchanged** - they should accept any OAuth2Client
- [ ] Test that `BaseToolHandler.runTool(args, oauth2Client)` works with external tokens
- [ ] No changes should be needed to individual tool implementations

---

## Phase 3: Testing & Validation

### 6. MCP Protocol Compliance
- [ ] Test MCP initialization flow: `POST / {"method": "initialize"}`
- [ ] Test tool discovery: `POST / {"method": "tools/list"}` → returns tool schemas
- [ ] Test tool execution: `POST / {"method": "tools/call", "params": {"name": "list-calendars"}}`
- [ ] Verify session ID support: `mcp-session-id` header handling
- [ ] Test with curl using examples from `examples/http-with-curl.sh`

### 7. Token Integration Testing
- [ ] Test with valid Google OAuth token in Authorization header
- [ ] Test error handling for missing Authorization header
- [ ] Test error handling for invalid/expired tokens
- [ ] Verify that different tokens access different user's calendars

### 8. Backward Compatibility
- [ ] Ensure stdio mode still works with internal auth (no regressions)
- [ ] Test existing Claude Desktop integration remains functional
- [ ] Verify environment variable fallbacks work correctly

---

## Phase 4: LLM Integration Support

### 9. Web App Backend Integration
- [ ] Document how to inject tokens into MCP requests from backend
- [ ] Provide example of OpenAI/Claude SDK calling MCP with token injection
- [ ] Create example showing LLM tool discovery + orchestration workflow

### 10. Documentation Updates
- [ ] Update README with external auth mode instructions
- [ ] Add examples showing LLM → Backend → MCP flow
- [ ] Document required environment variables for external mode
- [ ] Add troubleshooting guide for token-related errors

---

## Implementation Notes

### Core Architecture (DO NOT CHANGE):
```typescript
// Keep this flow intact:
LLM → tools/list → ["create-event", "list-events", ...]
LLM → tools/call → {name: "create-event", arguments: {...}}
```

### Token Injection (ADD THIS):
```typescript
// Your backend intercepts MCP call and adds token:
const mcpRequest = {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${userGoogleToken}` },
  body: JSON.stringify(llmRequest) // Forward LLM's request unchanged
};
```

### Key Files to Modify:
- `src/transports/http.ts` - Add token extraction
- `src/server.ts` - Add per-request OAuth2Client creation
- `src/config/TransportConfig.ts` - Add external auth config
- **DO NOT MODIFY**: Tool registry, individual tool handlers, MCP protocol handling

### Success Criteria:
✅ **MCP tool discovery works**: LLM can call `tools/list` and get schemas
✅ **Token injection works**: HTTP requests with Authorization header use that user's Google tokens
✅ **Tool orchestration works**: LLM can call multiple tools in sequence
✅ **Backward compatibility**: stdio mode and Claude Desktop still work
✅ **Multi-user support**: Different tokens access different user's calendars

---

## What NOT to Do:
❌ Don't create custom HTTP endpoints that bypass MCP protocol
❌ Don't modify tool schemas or remove tool discovery
❌ Don't hardcode API integrations in your backend
❌ Don't break the MCP JSON-RPC protocol
❌ Don't require tokens for `initialize` or `tools/list` calls

The goal is **MCP + token injection**, not **MCP → custom API conversion**.
