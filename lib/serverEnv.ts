// Load local development secrets for this framework-neutral package. Hosted
// runtimes should inject the same variables through their secret manager.
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });
