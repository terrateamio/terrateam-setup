"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupAppFactory = void 0;
const fs = require('fs');
const body_parser_1 = __importDefault(require("body-parser"));
const child_process_1 = require("child_process");
const update_dotenv_1 = __importDefault(require("update-dotenv"));
const manifest_creation_1 = require("../manifest-creation");
const logging_middleware_1 = require("../server/logging-middleware");
const is_production_1 = require("../helpers/is-production");
const path_1 = __importDefault(require("path"));

// Helper function to make HTTP requests to GitHub API
function makeGitHubRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const https = require('https');
        const urlObj = new URL(url);
        
        const requestOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || 443,
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: options.headers || {}
        };
        
        const req = https.request(requestOptions, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const parsedData = JSON.parse(data);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(parsedData);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${parsedData.message || data}`));
                    }
                } catch (parseError) {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(data);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                    }
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        if (options.body) {
            req.write(options.body);
        }
        
        req.end();
    });
}

// Application state management
const applicationState = {
    tunnelCredentials: new Map(), // sessionId -> tunnel credentials
    userSessions: new Map()       // sessionId -> user data
};

// Helper function to generate session ID
function generateSessionId() {
    return 'session_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Helper function to get or create session ID
function getSessionId(req) {
    let sessionId = req.headers['x-session-id'] || req.query.sessionId;
    if (!sessionId) {
        sessionId = generateSessionId();
    }
    return sessionId;
}

const setupAppFactory = (host, port) => async function setupApp(app, { getRouter }) {
    const setup = new manifest_creation_1.ManifestCreation();
    const route = getRouter();
    route.use((0, logging_middleware_1.getLoggingMiddleware)(app.log));
    route.use(body_parser_1.default.urlencoded({ extended: true }));
    route.use(body_parser_1.default.json());
    
    // Clean up expired sessions every hour
    setInterval(() => {
        const now = new Date();
        const expiredSessions = [];
        
        for (const [sessionId, credentials] of applicationState.tunnelCredentials.entries()) {
            const ageInHours = (now - credentials.createdAt) / (1000 * 60 * 60);
            if (ageInHours > 24) { // Expire sessions after 24 hours
                expiredSessions.push(sessionId);
            }
        }
        
        for (const sessionId of expiredSessions) {
            applicationState.tunnelCredentials.delete(sessionId);
            applicationState.userSessions.delete(sessionId);
            app.log.info(`Cleaned up expired session: ${sessionId}`);
        }
        
        if (expiredSessions.length > 0) {
            app.log.info(`Cleaned up ${expiredSessions.length} expired sessions`);
        }
    }, 60 * 60 * 1000); // Run every hour
    
    printWelcomeMessage(app, host, port);
    route.get("/probot", async (req, res) => {
        // First screen - welcome and email opt-in
        res.render("setup.handlebars");
    });
    
    // Development mode helper route
    route.get("/probot/dev", async (req, res) => {
        if (process.env.TERRATEAM_DEV_MODE === 'true') {
            res.send(`
                <html>
                <head><title>Terrateam Development Mode</title></head>
                <body style="font-family: Arial, sans-serif; padding: 2rem; max-width: 800px; margin: 0 auto;">
                    <h1>Terrateam Development Mode</h1>
                    <p>Development mode is <strong>enabled</strong>. You can access the success page directly without creating a real GitHub app.</p>
                    
                    <h2>Quick Links:</h2>
                    <ul>
                        <li><a href="/probot">Start Setup Flow</a> - Normal setup flow</li>
                        <li><a href="/probot/vcs-selection">VCS Selection</a> - Choose between GitHub and GitLab</li>
                        <li><a href="/probot/tunnel-config">Tunnel Configuration</a> - Configure tunnel settings</li>
                        <li><strong>GitHub Flow:</strong>
                            <ul>
                                <li><a href="/probot/app-setup">App Setup Page</a> - GitHub app creation form</li>
                                <li><a href="/probot/success">Success Page (Dev Mode)</a> - Direct access to success page with mock data</li>
                            </ul>
                        </li>
                        <li><strong>GitLab Flow:</strong>
                            <ul>
                                <li><a href="/probot/gitlab-pat-setup">GitLab PAT Setup</a> - Configure bot account PAT</li>
                                <li><a href="/probot/gitlab-manual-setup">GitLab Manual Setup</a> - Manual app creation instructions</li>
                                <li><a href="/probot/gitlab-success">GitLab Success</a> - Environment variables display</li>
                            </ul>
                        </li>
                    </ul>
                    
                    <h2>How to use:</h2>
                    <ol>
                        <li>Set <code>TERRATEAM_DEV_MODE=true</code> in your environment</li>
                        <li>Visit <a href="/probot/success">/probot/success</a> directly to see the success page with mock GitHub app data</li>
                        <li>Or follow the normal flow - when you reach the GitHub app creation step, you can skip it and go directly to the success page</li>
                    </ol>
                    
                    <p><strong>Note:</strong> This will still update your .env file with mock values for development purposes.</p>
                </body>
                </html>
            `);
        } else {
            res.status(404).send('Development mode is not enabled. Set TERRATEAM_DEV_MODE=true to enable.');
        }
    });
    route.get("/probot/vcs-selection", async (req, res) => {
        // VCS provider selection screen
        res.render("vcs-selection.handlebars");
    });
    route.get("/probot/tunnel-config", async (req, res) => {
        // Third screen - tunnel configuration
        const sessionId = getSessionId(req);
        res.render("tunnel-config.handlebars", { sessionId });
    });
    route.get("/probot/oauth-callback", async (req, res) => {
        // Handle GitHub OAuth callback in popup
        const isDevelopment = process.env.TERRATEAM_DEV_MODE === 'true';
        res.render("oauth-callback.handlebars", { isDevelopment });
    });
    route.get("/probot/api/session/:sessionId", async (req, res) => {
        // Get stored session data and tunnel credentials
        const { sessionId } = req.params;
        
        if (!sessionId) {
            return res.status(400).json({
                success: false,
                error: 'Session ID required'
            });
        }
        
        const tunnelCredentials = applicationState.tunnelCredentials.get(sessionId);
        const userSession = applicationState.userSessions.get(sessionId);
        
        if (!tunnelCredentials || !userSession) {
            return res.status(404).json({
                success: false,
                error: 'Session not found or expired'
            });
        }
        
        res.json({
            success: true,
            sessionId: sessionId,
            user: userSession,
            tunnel: {
                tunnel_id: tunnelCredentials.tunnel_id,
                tunnel_url: tunnelCredentials.tunnel_url,
                api_key: tunnelCredentials.api_key,
                createdAt: tunnelCredentials.createdAt
            }
        });
    });
    route.get("/probot/api/sessions", async (req, res) => {
        // Get all active sessions (for debugging/monitoring)
        const sessions = [];
        
        for (const [sessionId, userSession] of applicationState.userSessions.entries()) {
            const tunnelCredentials = applicationState.tunnelCredentials.get(sessionId);
            sessions.push({
                sessionId,
                user: userSession,
                tunnel: tunnelCredentials ? {
                    tunnel_id: tunnelCredentials.tunnel_id,
                    tunnel_url: tunnelCredentials.tunnel_url,
                    hasApiKey: !!tunnelCredentials.api_key,
                    createdAt: tunnelCredentials.createdAt
                } : null
            });
        }
        
        res.json({
            success: true,
            sessions,
            totalSessions: sessions.length
        });
    });
    route.delete("/probot/api/session/:sessionId", async (req, res) => {
        // Clear stored session data
        const { sessionId } = req.params;
        
        if (!sessionId) {
            return res.status(400).json({
                success: false,
                error: 'Session ID required'
            });
        }
        
        const hadCredentials = applicationState.tunnelCredentials.has(sessionId);
        const hadSession = applicationState.userSessions.has(sessionId);
        
        applicationState.tunnelCredentials.delete(sessionId);
        applicationState.userSessions.delete(sessionId);
        
        res.json({
            success: true,
            sessionId,
            cleared: {
                credentials: hadCredentials,
                session: hadSession
            }
        });
    });
    route.post("/probot/oauth-exchange", async (req, res) => {
        // Exchange OAuth code for access token
        const { code, state, sessionId } = req.body;
        
        if (!code) {
            return res.json({
                success: false,
                error: 'No authorization code provided'
            });
        }
        
        try {
            const clientId = process.env.GITHUB_CLIENT_ID || 'dev-client-id';
            const clientSecret = process.env.GITHUB_CLIENT_SECRET || 'dev-client-secret';
            const githubApiBase = process.env.GITHUB_API_BASE_URL || 'https://api.github.com';
            const githubWebBase = process.env.GITHUB_WEB_BASE_URL || 'https://github.com';
            
            // Development mode - return mock data
            if (process.env.TERRATEAM_DEV_MODE === 'true') {
                const mockResponse = {
                    access_token: 'mock_token_' + code,
                    user: {
                        login: 'dev_user',
                        id: 123456,
                        avatar_url: 'https://github.com/identicons/dev_user.png',
                        name: 'Development User',
                        email: 'dev@example.com'
                    },
                    tunnel: {
                        tunnel_id: 'dev_tunnel_' + Date.now(),
                        tunnel_url: 'dev-tunnel-' + Date.now() + '.tunnel.terrateam.dev',
                        api_key: 'dev_api_key_' + Math.random().toString(36).substring(7)
                    }
                };
                
                // Store mock credentials in application state
                if (sessionId) {
                    applicationState.tunnelCredentials.set(sessionId, {
                        ...mockResponse.tunnel,
                        createdAt: new Date(),
                        githubToken: mockResponse.access_token
                    });
                    
                    applicationState.userSessions.set(sessionId, {
                        login: mockResponse.user.login,
                        id: mockResponse.user.id,
                        email: mockResponse.user.email,
                        createdAt: new Date()
                    });
                    
                    app.log.info(`Stored mock tunnel credentials for session: ${sessionId}`);
                }
                
                return res.json({
                    success: true,
                    access_token: mockResponse.access_token,
                    user: mockResponse.user,
                    tunnel: mockResponse.tunnel,
                    sessionId: sessionId
                });
            }
            
            // Step 1: Exchange code for access token
            const tokenData = await makeGitHubRequest(`${githubWebBase}/login/oauth/access_token`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'Terrateam-Setup'
                },
                body: JSON.stringify({
                    client_id: clientId,
                    client_secret: clientSecret,
                    code: code
                })
            });
            
            if (tokenData.error) {
                throw new Error(`GitHub OAuth error: ${tokenData.error_description || tokenData.error}`);
            }
            
            if (!tokenData.access_token) {
                throw new Error('No access token received from GitHub');
            }
            
            // Step 2: Get user information
            const userData = await makeGitHubRequest(`${githubApiBase}/user`, {
                headers: {
                    'Authorization': `Bearer ${tokenData.access_token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'Terrateam-Setup'
                }
            });
            
            // Step 3: Get user email (if not public)
            let userEmail = userData.email;
            if (!userEmail) {
                try {
                    const emails = await makeGitHubRequest(`${githubApiBase}/user/emails`, {
                        headers: {
                            'Authorization': `Bearer ${tokenData.access_token}`,
                            'Accept': 'application/vnd.github.v3+json',
                            'User-Agent': 'Terrateam-Setup'
                        }
                    });
                    
                    const primaryEmail = emails.find(email => email.primary);
                    if (primaryEmail) {
                        userEmail = primaryEmail.email;
                    }
                } catch (emailError) {
                    app.log.warn('Failed to fetch user email:', emailError);
                    // Continue without email - it's not critical
                }
            }
            
            // Step 4: Exchange GitHub token with Terratunnel
            let tunnelCredentials = null;
            try {
                const terratunnelResponse = await makeGitHubRequest('https://tunnel.terrateam.dev/api/auth/exchange', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'User-Agent': 'Terrateam-Setup'
                    },
                    body: JSON.stringify({
                        github_token: tokenData.access_token,
                        user: {
                            login: userData.login,
                            id: userData.id,
                            email: userEmail
                        }
                    })
                });
                
                tunnelCredentials = terratunnelResponse;
                app.log.info('Successfully exchanged GitHub token for tunnel credentials');
                
                // Store tunnel credentials in application state
                if (sessionId && tunnelCredentials) {
                    applicationState.tunnelCredentials.set(sessionId, {
                        ...tunnelCredentials,
                        createdAt: new Date(),
                        githubToken: tokenData.access_token
                    });
                    
                    applicationState.userSessions.set(sessionId, {
                        login: userData.login,
                        id: userData.id,
                        email: userEmail,
                        createdAt: new Date()
                    });
                    
                    app.log.info(`Stored tunnel credentials for session: ${sessionId}`);
                }
            } catch (tunnelError) {
                app.log.warn('Failed to exchange token with Terratunnel:', tunnelError.message);
                // Continue without tunnel credentials - this is not critical for the OAuth flow
            }

            // Return successful response
            res.json({
                success: true,
                access_token: tokenData.access_token,
                user: {
                    login: userData.login,
                    id: userData.id,
                    avatar_url: userData.avatar_url,
                    name: userData.name,
                    email: userEmail,
                    html_url: userData.html_url
                },
                tunnel: tunnelCredentials,
                sessionId: sessionId
            });
            
        } catch (error) {
            app.log.error('OAuth exchange error:', error);
            res.json({
                success: false,
                error: error.message || 'Failed to exchange authorization code'
            });
        }
    });
    route.get("/probot/telemetry", async (req, res) => {
        // Handle telemetry submission
        const { email, firstName, lastName, githubAccount } = req.query;
        if (email || githubAccount) {
            try {
                const https = require('https');
                const params = new URLSearchParams();
                if (email) params.append('email', email);
                if (githubAccount) params.append('github', githubAccount);
                const url = `https://telemetry.terrateam.io/event/terrateam-setup/opt-in?${params.toString()}`;
                
                https.get(url, (telemetryRes) => {
                    // Telemetry sent silently
                }).on('error', (error) => {
                    app.log.error('Telemetry request failed:', error);
                });
            } catch (error) {
                app.log.error('Telemetry error:', error);
            }
        }
        res.json({ success: true });
    });
    route.get("/probot/gitlab-pat-setup", async (req, res) => {
        // GitLab PAT setup screen
        res.render("gitlab-pat-setup.handlebars");
    });
    route.get("/probot/gitlab-manual-setup", async (req, res) => {
        // GitLab manual app creation screen
        res.render("gitlab-manual-setup.handlebars");
    });
    route.get("/probot/gitlab-success", async (req, res) => {
        // GitLab success screen
        res.render("gitlab-success.handlebars");
    });
    // Removed gitlab-app-create endpoint - we go directly to manual setup since API creation requires admin permissions
    route.get("/probot/app-setup", async (req, res) => {
        // GitHub app creation screen
        const baseUrl = getBaseUrl(req);
        const pkg = setup.pkg;
        const manifest = setup.getManifest(pkg, baseUrl);
        const baseCreateAppUrl = setup.baseCreateAppUrl;
        const orgName = process.env.GH_ORG || '';
        res.render("app-setup.handlebars", { pkg, baseCreateAppUrl, manifest, orgName });
    });
    route.get("/probot/success", async (req, res) => {
        const { code, firstName, lastName, email, onboardingCall, tunnelConfig, sessionId } = req.query;
        
        // Development mode - allow direct access without GitHub code
        if (process.env.TERRATEAM_DEV_MODE === 'true' && !code) {
            app.log.info('Development mode: Rendering success page with mock data');
            try {
                const response = await setup.createAppFromCode('dev-mock-code');
                const { html_url, id, client_id, client_secret, webhook_secret, pem, owner } = response.data;
                let env_file = fs.readFileSync((path_1.default.join(process.cwd(), ".env")));
                
                // Add tunnel configuration to .env file if provided
                if (tunnelConfig) {
                    try {
                        const tunnelData = JSON.parse(decodeURIComponent(tunnelConfig));
                        
                        if (tunnelData.needsTunnel && tunnelData.tunnelCredentials && tunnelData.tunnelCredentials.api_key) {
                            const apiKey = tunnelData.tunnelCredentials.api_key;
                            let envContent = env_file.toString();
                            
                            // Remove any existing TERRATUNNEL_API_KEY lines
                            envContent = envContent.replace(/^TERRATUNNEL_API_KEY=.*$/gm, '');
                            
                            // Remove extra blank lines
                            envContent = envContent.replace(/\n\s*\n/g, '\n');
                            
                            // Add the new key
                            if (!envContent.endsWith('\n')) {
                                envContent += '\n';
                            }
                            envContent += `TERRATUNNEL_API_KEY=${apiKey}\n`;
                            
                            // Add TERRAT_UI_BASE if tunnel URL exists
                            if (tunnelData.tunnelCredentials.tunnel_url) {
                                let tunnelUrl = tunnelData.tunnelCredentials.tunnel_url;
                                // Ensure we don't double-add https://
                                if (!tunnelUrl.startsWith('https://') && !tunnelUrl.startsWith('http://')) {
                                    tunnelUrl = `https://${tunnelUrl}`;
                                }
                                envContent += `TERRAT_UI_BASE=${tunnelUrl}\n`;
                            }
                            
                            env_file = envContent;
                        }
                        
                        // Write updated .env file in dev mode
                        fs.writeFileSync(path_1.default.join(process.cwd(), ".env"), env_file);
                    } catch (tunnelError) {
                        app.log.error('Development mode tunnel configuration error:', tunnelError);
                    }
                }
                
                // Retrieve tunnel data from session if available (dev mode)
                let tunnelUrl = null;
                if (sessionId) {
                    const tunnelCredentials = applicationState.tunnelCredentials.get(sessionId);
                    if (tunnelCredentials && tunnelCredentials.tunnel_url) {
                        tunnelUrl = tunnelCredentials.tunnel_url;
                    }
                }
                
                // Extract TERRAT_UI_BASE from env_file if tunnelUrl is not set
                if (!tunnelUrl) {
                    const envContent = env_file.toString();
                    const terratUiBaseMatch = envContent.match(/^TERRAT_UI_BASE=(.+)$/m);
                    if (terratUiBaseMatch) {
                        tunnelUrl = terratUiBaseMatch[1];
                    }
                }
                
                res.render("success.handlebars", { env_file, html_url, id, client_id, client_secret, webhook_secret, pem, tunnelUrl });
                return;
            } catch (e) {
                app.log.error('Development mode error:', e);
                res.status(500).send('Development mode error');
                return;
            }
        }
        
        // Production mode or development mode with actual GitHub code
        if (!code) {
            res.status(400).send('Missing GitHub app creation code');
            return;
        }
        
        try {
            const response = await setup.createAppFromCode(code);
            const { html_url, id, client_id, client_secret, webhook_secret, pem, owner } = response.data;
            let env_file = fs.readFileSync((path_1.default.join(process.cwd(), ".env")));
            
            // Add tunnel configuration to .env file if provided
            if (tunnelConfig) {
                try {
                    const tunnelData = JSON.parse(decodeURIComponent(tunnelConfig));
                    
                    if (tunnelData.needsTunnel && tunnelData.tunnelCredentials && tunnelData.tunnelCredentials.api_key) {
                        const apiKey = tunnelData.tunnelCredentials.api_key;
                        let envContent = env_file.toString();
                        
                        // Remove any existing TERRATUNNEL_API_KEY lines
                        envContent = envContent.replace(/^TERRATUNNEL_API_KEY=.*$/gm, '');
                        
                        // Remove extra blank lines
                        envContent = envContent.replace(/\n\s*\n/g, '\n');
                        
                        // Add the new key
                        if (!envContent.endsWith('\n')) {
                            envContent += '\n';
                        }
                        envContent += `TERRATUNNEL_API_KEY=${apiKey}\n`;
                        
                        // Add TERRAT_UI_BASE if tunnel URL exists
                        if (tunnelData.tunnelCredentials.tunnel_url) {
                            let tunnelUrl = tunnelData.tunnelCredentials.tunnel_url;
                            // Ensure we don't double-add https://
                            if (!tunnelUrl.startsWith('https://') && !tunnelUrl.startsWith('http://')) {
                                tunnelUrl = `https://${tunnelUrl}`;
                            }
                            envContent += `TERRAT_UI_BASE=${tunnelUrl}\n`;
                        }
                        
                        env_file = envContent;
                    }
                    
                    // Write updated .env file
                    fs.writeFileSync(path_1.default.join(process.cwd(), ".env"), env_file);
                } catch (tunnelError) {
                    app.log.error('Error processing tunnel configuration:', tunnelError);
                }
            }
            
            // Send telemetry with authenticated GitHub username and user data
            try {
                const githubUsername = owner?.login;
                const shouldSendTelemetry = onboardingCall === 'true';
                
                if (githubUsername && shouldSendTelemetry) {
                    const https = require('https');
                    const params = new URLSearchParams();
                    params.append('github', githubUsername);
                    if (email) params.append('email', email);
                    if (firstName) params.append('firstName', firstName);
                    if (lastName) params.append('lastName', lastName);
                    
                    const url = `https://telemetry.terrateam.io/event/terrateam-setup/opt-in?${params.toString()}`;
                    
                    https.get(url, (telemetryRes) => {
                        // Telemetry sent
                    }).on('error', (error) => {
                        app.log.error('Telemetry request failed:', error);
                    });
                } else if (githubUsername) {
                    // User opted out of telemetry
                }
            } catch (telemetryError) {
                app.log.error('Telemetry error:', telemetryError);
            }
            
            // Retrieve tunnel data from session if available
            let tunnelUrl = null;
            if (sessionId) {
                const tunnelCredentials = applicationState.tunnelCredentials.get(sessionId);
                if (tunnelCredentials && tunnelCredentials.tunnel_url) {
                    tunnelUrl = tunnelCredentials.tunnel_url;
                    
                    // Also update .env file with tunnel credentials if not already done
                    if (tunnelCredentials.api_key && !tunnelConfig) {
                        let envContent = env_file.toString();
                        
                        // Check if TERRATUNNEL_API_KEY already exists
                        if (!envContent.includes('TERRATUNNEL_API_KEY=')) {
                            // Remove extra blank lines
                            envContent = envContent.replace(/\n\s*\n/g, '\n');
                            
                            // Add the new keys
                            if (!envContent.endsWith('\n')) {
                                envContent += '\n';
                            }
                            envContent += `TERRATUNNEL_API_KEY=${tunnelCredentials.api_key}\n`;
                            
                            // Add TERRAT_UI_BASE with proper protocol handling
                            let tunnelUrl = tunnelCredentials.tunnel_url;
                            // Ensure we don't double-add https://
                            if (!tunnelUrl.startsWith('https://') && !tunnelUrl.startsWith('http://')) {
                                tunnelUrl = `https://${tunnelUrl}`;
                            }
                            envContent += `TERRAT_UI_BASE=${tunnelUrl}\n`;
                            
                            env_file = envContent;
                            
                            // Write updated .env file
                            fs.writeFileSync(path_1.default.join(process.cwd(), ".env"), env_file);
                        }
                    }
                }
            }
            
            // Extract TERRAT_UI_BASE from env_file if tunnelUrl is not set
            if (!tunnelUrl) {
                const envContent = env_file.toString();
                const terratUiBaseMatch = envContent.match(/^TERRAT_UI_BASE=(.+)$/m);
                if (terratUiBaseMatch) {
                    tunnelUrl = terratUiBaseMatch[1];
                }
            }
            
            res.render("success.handlebars", { env_file, html_url, id, client_id, client_secret, webhook_secret, pem, tunnelUrl });
        }
        catch (e) {
            app.log.error(e);
            res.status(500).send('GitHub app creation failed');
        }
    });
    route.get("/", (req, res, next) => res.redirect("/probot"));
};

exports.setupAppFactory = setupAppFactory;

function printWelcomeMessage(app, host, port) {
    app.log.info("Welcome to the Terrateam Setup!");
    if (process.env.TERRATEAM_DEV_MODE === 'true') {
        app.log.info("Development Mode is ENABLED");
        app.log.info(`   - Visit http://${host}:${port}/probot/dev for development mode options`);
        app.log.info(`   - Direct success page: http://${host}:${port}/probot/success`);
    }
}

function getBaseUrl(req) {
    const protocols = req.headers["x-forwarded-proto"] || req.protocol;
    const protocol = typeof protocols === "string" ? protocols.split(",")[0] : protocols[0];
    const host = req.headers["x-forwarded-host"] || req.get("host");
    const baseUrl = `${protocol}://${host}`;
    return baseUrl;
}
//# sourceMappingURL=setup.js.map
