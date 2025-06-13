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
                    app.log.info(`Telemetry sent for ${firstName || ''} ${lastName || ''} (${email || githubAccount}), status: ${telemetryRes.statusCode}`);
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
        const createAppUrl = setup.baseCreateAppUrl;
        const orgName = process.env.GH_ORG || '';
        res.render("app-setup.handlebars", { pkg, createAppUrl, manifest, orgName });
    });
    route.get("/probot/success", async (req, res) => {
        const { code, firstName, lastName, email, onboardingCall } = req.query;
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
                        app.log.info(`Telemetry sent for GitHub user: ${githubUsername} (${firstName || ''} ${lastName || ''}, ${email || 'no email'}), status: ${telemetryRes.statusCode}`);
                    }).on('error', (error) => {
                        app.log.error('Telemetry request failed:', error);
                    });
                } else if (githubUsername) {
                    app.log.info(`GitHub user ${githubUsername} opted out of telemetry`);
                }
            } catch (telemetryError) {
                app.log.error('Telemetry error:', telemetryError);
            }
            
            res.render("success.handlebars", { env_file, html_url, id, client_id, client_secret, webhook_secret, pem });
        }
        catch (e) {
            app.log.error(e);
        }
    });
    route.get("/", (req, res, next) => res.redirect("/probot"));
};

exports.setupAppFactory = setupAppFactory;

function printWelcomeMessage(app, host, port) {
    app.log.info("Welcome to the Terrateam Setup!");
}

function getBaseUrl(req) {
    const protocols = req.headers["x-forwarded-proto"] || req.protocol;
    const protocol = typeof protocols === "string" ? protocols.split(",")[0] : protocols[0];
    const host = req.headers["x-forwarded-host"] || req.get("host");
    const baseUrl = `${protocol}://${host}`;
    return baseUrl;
}
//# sourceMappingURL=setup.js.map
