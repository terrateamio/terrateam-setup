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
    printWelcomeMessage(app, host, port);
    route.get("/probot", async (req, res) => {
        const baseUrl = getBaseUrl(req);
        const pkg = setup.pkg;
        const manifest = setup.getManifest(pkg, baseUrl);
        const createAppUrl = setup.createAppUrl;
        const orgName = process.env.GH_ORG || 'GitHub Organization not specified';
        // Pass the manifest to be POST'd
        res.render("setup.handlebars", { pkg, createAppUrl, manifest, orgName });
    });
    route.get("/probot/success", async (req, res) => {
        const { code } = req.query;
        try {
        		const response = await setup.createAppFromCode(code);
            const { html_url, id, client_id, client_secret, webhook_secret, pem } = response.data;
						const env_file = fs.readFileSync((path_1.default.join(process.cwd(), ".env")));
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
