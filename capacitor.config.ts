import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.clinicalassistant.hub",
  appName: "Clinical Assistant Hub",
  webDir: "dist/spa",
  bundledWebRuntime: false,
  server: {
    androidScheme: "https",
  },
};

export default config;

