# Google Calendar MCP Server - Authentication Analysis

## Overview

This document analyzes the Google Calendar MCP (Model Context Protocol) Server's authentication implementation and its suitability for different deployment scenarios, particularly focusing on the challenges of integrating this system with web applications that serve multiple users.

## What This Project Does

### Core Purpose
The Google Calendar MCP Server is a **Model Context Protocol (MCP) server** that provides Google Calendar integration for AI assistants like Claude. It acts as a bridge between AI assistants and Google Calendar APIs, enabling natural language calendar operations.

### Key Features
- **Event Management**: Create, read, update, and delete calendar events
- **Multi-Calendar Support**: Query events across multiple calendars simultaneously
- **Smart Scheduling**: Natural language understanding for dates and times
- **Recurring Events**: Advanced modification capabilities for recurring events
- **Free/Busy Queries**: Check availability across multiple calendars
- **Image Processing**: Extract calendar events from images, PDFs, or web links
- **Cross-Calendar Analysis**: Coordinate events and check availability across different calendars

### Architecture
- Built as an MCP server using the `@modelcontextprotocol/sdk`
- Supports both stdio and HTTP transport modes
- Uses Google APIs (`googleapis`, `google-auth-library`) for Calendar integration
- TypeScript-based with comprehensive test coverage

## Current Authentication Implementation

### OAuth 2.0 Desktop App Flow
The current implementation is designed around the **OAuth 2.0 Desktop Application** pattern:

```typescript
// From src/auth/client.ts
export async function initializeOAuth2Client(): Promise<OAuth2Client> {
    const credentials = await loadCredentialsWithFallback();
    return new OAuth2Client({
        clientId: credentials.client_id,
        clientSecret: credentials.client_secret,
        redirectUri: credentials.redirect_uris[0], // localhost redirect
    });
}
```

### Key Components

#### 1. Credential Management (`src/auth/client.ts`)
- **Single OAuth Credentials File**: Uses one `gcp-oauth.keys.json` file
- **Supports Multiple Formats**: Desktop app, web app, or direct format
- **Environment Variable Priority**: `GOOGLE_OAUTH_CREDENTIALS` takes precedence
- **Fallback to Project Root**: Default location is project root directory

#### 2. Token Storage (`src/auth/tokenManager.ts`)
- **File-Based Storage**: Tokens stored in `~/.config/google-calendar-mcp/tokens.json`
- **Multi-Account Support**: Stores tokens for "normal" and "test" account modes
- **Automatic Refresh**: Handles token refresh automatically
- **Legacy Migration**: Migrates from old token storage locations

```typescript
interface MultiAccountTokens {
    normal?: Credentials;
    test?: Credentials;
}
```

#### 3. Local Auth Server (`src/auth/server.ts`)
- **HTTP Server**: Starts local server on ports 3000-3005
- **OAuth Callback**: Handles `http://localhost:PORT/oauth2callback`
- **Browser Integration**: Automatically opens browser for authentication
- **Graceful Shutdown**: Proper connection management and cleanup

### Authentication Flow

1. **Initialization**: Load OAuth credentials from file or environment
2. **Token Validation**: Check if existing tokens are valid and not expired
3. **Local Server**: Start HTTP server on available port (3000-3005)
4. **Browser Auth**: Open browser with Google OAuth URL
5. **Callback Handling**: Receive authorization code via localhost callback
6. **Token Exchange**: Exchange code for access/refresh tokens
7. **Token Storage**: Save tokens to local config directory

## Multi-User/Account Handling

### Current Capabilities
The system has limited multi-account support:

- **Account Modes**: Supports "normal" and "test" modes
- **Mode Detection**: Based on `GOOGLE_ACCOUNT_MODE` environment variable or `NODE_ENV`
- **Separate Token Storage**: Different tokens for each mode
- **Runtime Switching**: Can switch between account modes

```typescript
// From src/auth/utils.ts
export function getAccountMode(): 'normal' | 'test' {
    const explicitMode = process.env.GOOGLE_ACCOUNT_MODE?.toLowerCase();
    if (explicitMode === 'test' || explicitMode === 'normal') {
        return explicitMode;
    }
    return process.env.NODE_ENV === 'test' ? 'test' : 'normal';
}
```

### Limitations
- **Binary Mode System**: Only "normal" vs "test", not true multi-user
- **Shared Credentials**: All users authenticate through same OAuth app
- **No User Identity**: No concept of distinct user accounts
- **Local Storage Only**: File-based storage not suitable for multi-tenant apps

## Integration Challenges for Web Applications

### Major Architectural Issues

#### 1. **Single OAuth Credentials Architecture**
```json
{
  "installed": {
    "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
    "client_secret": "YOUR_CLIENT_SECRET",
    "redirect_uris": ["http://localhost"]
  }
}
```

**Problems:**
- All users share the same `client_id` and `client_secret`
- No per-user credential isolation
- Security implications of shared OAuth app
- Difficulty in tracking usage per user

**Required Changes:**
- Per-user OAuth applications, or
- Proper multi-tenant OAuth setup with user consent tracking

#### 2. **Local Callback Server Design**
```typescript
// From src/auth/server.ts
this.flowOAuth2Client = new OAuth2Client(
    client_id,
    client_secret,
    `http://localhost:${port}/oauth2callback`, // Hardcoded localhost
);
```

**Problems:**
- Hardcoded `localhost` redirect URIs
- Requires local server startup for each authentication
- Not compatible with web application domains
- Cannot handle multiple concurrent authentications

**Required Changes:**
- Web-based redirect URIs (e.g., `https://yourapp.com/oauth/callback`)
- Server-side OAuth handling without local HTTP servers
- Session-based authentication state management

#### 3. **File-Based Token Storage**
```typescript
// From src/auth/tokenManager.ts
export function getSecureTokenPath(): string {
    const configDir = process.env.XDG_CONFIG_HOME || path.join(homedir(), '.config');
    return path.join(configDir, 'google-calendar-mcp', 'tokens.json');
}
```

**Problems:**
- Local filesystem storage (`~/.config/`)
- No database integration
- No user identification mechanism
- Cannot scale to multiple users
- No token encryption or additional security

**Required Changes:**
- Database-backed token storage (PostgreSQL, MongoDB, etc.)
- User session management
- Token encryption at rest
- Proper user-token association

#### 4. **Account Mode Limitations**
```typescript
interface MultiAccountTokens {
    normal?: Credentials;  // Only two modes supported
    test?: Credentials;
}
```

**Problems:**
- Binary mode system (normal/test) insufficient for real users
- No concept of user identity or isolation
- Would conflict with multiple real user accounts

**Required Changes:**
- User-based token storage (keyed by user ID)
- Proper user authentication and session management
- Multi-tenant data isolation

### Web Application Integration Requirements

To properly integrate this MCP server with a web application serving multiple users, you would need:

#### 1. **OAuth Flow Redesign**
```typescript
// Conceptual web app integration
interface WebAuthConfig {
    clientId: string;
    clientSecret: string;
    redirectUri: string; // https://yourapp.com/oauth/callback
    scopes: string[];
}

interface UserToken {
    userId: string;
    accessToken: string;
    refreshToken: string;
    expiryDate: number;
    createdAt: Date;
    updatedAt: Date;
}
```

#### 2. **Database Integration**
```sql
-- Required database schema
CREATE TABLE user_tokens (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expiry_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id)
);
```

#### 3. **Multi-Tenant Architecture**
```typescript
class WebTokenManager {
    async getTokensForUser(userId: string): Promise<UserToken | null>;
    async saveTokensForUser(userId: string, tokens: Credentials): Promise<void>;
    async refreshTokensForUser(userId: string): Promise<boolean>;
    async revokeTokensForUser(userId: string): Promise<void>;
}
```

#### 4. **Session Management**
- User authentication/authorization
- Session-based token retrieval
- Proper user context in MCP operations
- Request isolation between users

## Security Considerations

### Current Security Model
- **Local Storage**: Tokens stored with file permissions `0o600`
- **No Encryption**: Tokens stored in plain JSON
- **Single User**: Designed for single-user desktop usage
- **Local Network**: OAuth callbacks on localhost only

### Web Application Security Requirements
- **Token Encryption**: Encrypt tokens at rest in database
- **User Isolation**: Proper multi-tenant data separation
- **HTTPS**: Secure OAuth redirects over HTTPS
- **Session Security**: Secure session management
- **Rate Limiting**: Per-user API rate limiting
- **Audit Logging**: Track user actions and API usage

## Recommendations

### For Current Use Cases (Desktop/Testing)
The current implementation is **well-suited** for:
- Personal use with Claude Desktop
- Development and testing environments
- Single-user standalone applications
- Command-line tools

### For Web Application Integration
**Recommendation: Significant Refactoring Required**

The current architecture is not suitable for web applications with multiple users. Consider these approaches:

#### Option 1: Fork and Redesign
Create a web-specific version with:
- Database-backed token storage
- Web OAuth flow
- User management system
- Multi-tenant architecture

#### Option 2: Service Layer Abstraction
Build a web service that:
- Wraps the existing MCP server
- Handles user authentication separately
- Manages per-user MCP server instances
- Provides web-safe APIs

#### Option 3: Hybrid Approach
Use the existing MCP server as a backend service:
- Deploy as container/service per user
- Web app manages user sessions and routing
- Isolated MCP instances for each user
- Shared OAuth app with proper user consent

## Conclusion

The Google Calendar MCP Server is excellently designed for its intended use case: providing Calendar integration for AI assistants in desktop/development environments. However, its authentication architecture has fundamental limitations that make it unsuitable for multi-user web applications without significant refactoring.

The core issues stem from the desktop-first design assumptions: single OAuth credentials, localhost callbacks, file-based storage, and binary account modes. Converting this to a multi-tenant web application would require redesigning the authentication system, token management, and storage architecture.

For web integration, consider the project as a reference implementation rather than a drop-in solution, and plan for substantial authentication system changes.