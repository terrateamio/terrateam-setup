"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = void 0;
const pkg_conf_1 = __importDefault(require("pkg-conf"));
const index_1 = require("./index");
const setup_1 = require("./apps/setup");
const get_log_1 = require("./helpers/get-log");
const read_cli_options_1 = require("./bin/read-cli-options");
const read_env_options_1 = require("./bin/read-env-options");
const server_1 = require("./server/server");
const default_1 = require("./apps/default");
const resolve_app_function_1 = require("./helpers/resolve-app-function");
const is_production_1 = require("./helpers/is-production");
/**
 *
 * @param appFnOrArgv set to either a probot application function: `(app) => { ... }` or to process.argv
 */
async function run(appFnOrArgv, additionalOptions) {
    require("dotenv").config();
    const envOptions = (0, read_env_options_1.readEnvOptions)(additionalOptions === null || additionalOptions === void 0 ? void 0 : additionalOptions.env);
    const cliOptions = Array.isArray(appFnOrArgv)
        ? (0, read_cli_options_1.readCliOptions)(appFnOrArgv)
        : {};
    const { 
    // log options
    logLevel: level, logFormat, logLevelInString, logMessageKey, sentryDsn, 
    // server options
    host, port, webhookPath, webhookProxy, 
    // probot options
    appId, privateKey, redisConfig, secret, baseUrl, 
    // others
    args, } = { ...envOptions, ...cliOptions };
    const logOptions = {
        level,
        logFormat,
        logLevelInString,
        logMessageKey,
        sentryDsn,
    };
    const log = (0, get_log_1.getLog)(logOptions);
    const probotOptions = {
        appId,
        privateKey,
        redisConfig,
        secret,
        baseUrl,
        log: log.child({ name: "probot" }),
    };
    const serverOptions = {
        host,
        port,
        webhookPath,
        webhookProxy,
        log: log.child({ name: "server" }),
        Probot: index_1.Probot.defaults(probotOptions),
    };
    let server;
    server = new server_1.Server({
        ...serverOptions,
        Probot: index_1.Probot.defaults({
            ...probotOptions,
            appId: 1,
            privateKey: "dummy value for setup, see #1512",
        }),
    });
    await server.load((0, setup_1.setupAppFactory)(host, port));
    await server.start();
    return server;
}
exports.run = run;
//# sourceMappingURL=run.js.map
