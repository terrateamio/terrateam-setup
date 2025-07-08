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

const setupAppFactory = (host, port) => async function setupApp(app, { getRouter }) {
    const setup = new manifest_creation_1.ManifestCreation();
    const route = getRouter();
    route.use((0, logging_middleware_1.getLoggingMiddleware)(app.log));
    route.use(body_parser_1.default.urlencoded({ extended: true }));
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
                        <li><a href="/probot/success">Success Page (Dev Mode)</a> - Direct access to success page with mock data</li>
                        <li><a href="/probot/app-setup">App Setup Page</a> - App creation form</li>
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
    route.get("/probot/app-setup", async (req, res) => {
        // Second screen - GitHub app creation
        const baseUrl = getBaseUrl(req);
        const pkg = setup.pkg;
        const manifest = setup.getManifest(pkg, baseUrl);
        const baseCreateAppUrl = setup.baseCreateAppUrl;
        const orgName = process.env.GH_ORG || '';
        res.render("app-setup.handlebars", { pkg, baseCreateAppUrl, manifest, orgName });
    });
    route.get("/probot/success", async (req, res) => {
        const { code, firstName, lastName, email, onboardingCall } = req.query;
        
        // Development mode - allow direct access without GitHub code
        if (process.env.TERRATEAM_DEV_MODE === 'true' && !code) {
            app.log.info('Development mode: Rendering success page with mock data');
            try {
                const response = await setup.createAppFromCode('dev-mock-code');
                const { html_url, id, client_id, client_secret, webhook_secret, pem, owner } = response.data;
                const env_file = fs.readFileSync((path_1.default.join(process.cwd(), ".env")));
                
                res.render("success.handlebars", { env_file, html_url, id, client_id, client_secret, webhook_secret, pem });
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
            const env_file = fs.readFileSync((path_1.default.join(process.cwd(), ".env")));
            
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
            
            res.render("success.handlebars", { env_file, html_url, id, client_id, client_secret, webhook_secret, pem });
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
