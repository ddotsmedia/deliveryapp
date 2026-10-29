import { buildApp } from "./bootstrap.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const { app, resources } = await buildApp(config);
await app.listen(config.API_PORT, "0.0.0.0");
resources.logger.info({ port: config.API_PORT }, "api listening");
