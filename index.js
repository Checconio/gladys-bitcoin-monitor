import { GladysIntegration, logger } from "@gladysassistant/integration-sdk";
import { BitcoinMonitorIntegration } from "./src/integration.js";

const app = new BitcoinMonitorIntegration({ gladys: new GladysIntegration() });

app.start().catch((error) => {
  logger.error("Bitcoin Monitor failed to start", error);
  process.exitCode = 1;
});
