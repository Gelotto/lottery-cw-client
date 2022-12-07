import type { Config } from "@jest/types";

// Sync object
const config: Config.InitialOptions = {
  verbose: true,
  testTimeout: 60 * 1000,
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
};

export default config;
