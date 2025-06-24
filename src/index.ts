import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './config/TransportConfig.js';
import { GoogleCalendarMcpServer } from './server.js';

// Import modular components
import { initializeOAuth2Client } from './auth/client.js';
import { AuthServer } from './auth/server.js';

// Get package version
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJsonPath = join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
const VERSION = packageJson.version;

// --- Main Application Logic ---
async function main() {
    try {
        // Parse command line arguments
        const config = parseArgs(process.argv.slice(2));

        // Create and initialize the server
        const server = new GoogleCalendarMcpServer(config);
        await server.initialize();

        // Start the server with the appropriate transport
        await server.start();
    } catch (error: unknown) {
        process.stderr.write(
            `Failed to start server: ${error instanceof Error ? error.message : error}\n`,
        );
        process.exit(1);
    }
}

// --- Command Line Interface ---
async function runAuthServer(): Promise<void> {
    // Use the same logic as auth-server.ts
    try {
        // Initialize OAuth client
        const oauth2Client = await initializeOAuth2Client();

        // Create and start the auth server
        const authServerInstance = new AuthServer(oauth2Client);

        // Start with browser opening (true by default)
        const success = await authServerInstance.start(true);

        if (!success && !authServerInstance.authCompletedSuccessfully) {
            // Failed to start and tokens weren't already valid
            process.stderr.write(
                'Authentication failed. Could not start server or validate existing tokens. Check port availability (3000-3004) and try again.\n',
            );
            process.exit(1);
        } else if (authServerInstance.authCompletedSuccessfully) {
            // Auth was successful (either existing tokens were valid or flow completed just now)
            process.stderr.write('Authentication successful.\n');
            process.exit(0); // Exit cleanly if auth is already done
        }

        // If we reach here, the server started and is waiting for the browser callback
        process.stderr.write(
            'Authentication server started. Please complete the authentication in your browser...\n',
        );

        // Wait for completion
        const intervalId = setInterval(async () => {
            if (authServerInstance.authCompletedSuccessfully) {
                clearInterval(intervalId);
                await authServerInstance.stop();
                process.stderr.write(
                    'Authentication completed successfully!\n',
                );
                process.exit(0);
            }
        }, 1000);
    } catch (error) {
        process.stderr.write(`Authentication failed: ${error}\n`);
        process.exit(1);
    }
}

function showHelp(): void {
    process.stdout.write(`
Google Calendar MCP Server v${VERSION}

Usage:
  npx @cocal/google-calendar-mcp [command] [options]

Commands:
  auth     Run the authentication flow
  start    Start the MCP server (default)
  version  Show version information
  help     Show this help message

Options:
  --credentials-file <path>   Path to OAuth credentials file
  --transport <type>          Transport type: stdio (default) | http
  --port <number>            Port for HTTP transport (default: 3000)
  --host <string>            Host for HTTP transport (default: 127.0.0.1)
  --debug                    Enable debug logging

Examples:
  npx @cocal/google-calendar-mcp
  npx @cocal/google-calendar-mcp --credentials-file /path/to/gcp-oauth.keys.json
  npx @cocal/google-calendar-mcp start --transport http --port 3000
  npx @cocal/google-calendar-mcp version

Environment Variables:
  GOOGLE_OAUTH_CREDENTIALS    Path to OAuth credentials file
`);
}

function showVersion(): void {
    process.stdout.write(`Google Calendar MCP Server v${VERSION}\n`);
}

// --- Exports & Execution Guard ---
// Export main for testing or potential programmatic use
export { main, runAuthServer };

// Parse CLI arguments
function parseCliArgs(): { command: string | undefined } {
    const args = process.argv.slice(2);
    let command: string | undefined;

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        // Handle special version/help flags as commands
        if (
            arg === '--version' ||
            arg === '-v' ||
            arg === '--help' ||
            arg === '-h'
        ) {
            command = arg;
            continue;
        }

        // Skip transport options and their values
        if (
            arg === '--transport' ||
            arg === '--port' ||
            arg === '--host' ||
            arg === '--credentials-file'
        ) {
            i++; // Skip the next argument (the value)
            continue;
        }

        // Skip other flags
        if (arg === '--debug') {
            continue;
        }

        // Check for command (first non-option argument)
        if (!command && !arg.startsWith('--')) {
            command = arg;
        }
    }

    return { command };
}

// CLI logic here (run always)
const { command } = parseCliArgs();

switch (command) {
    case 'auth':
        runAuthServer().catch((error) => {
            process.stderr.write(`Authentication failed: ${error}\n`);
            process.exit(1);
        });
        break;
    case 'start':
    case void 0:
        main().catch((error) => {
            process.stderr.write(`Failed to start server: ${error}\n`);
            process.exit(1);
        });
        break;
    case 'version':
    case '--version':
    case '-v':
        showVersion();
        break;
    case 'help':
    case '--help':
    case '-h':
        showHelp();
        break;
    default:
        process.stderr.write(`Unknown command: ${command}\n`);
        showHelp();
        process.exit(1);
}
