export const BUILD_TARGET = (import.meta.env.VITE_BUILD_TARGET as string) || "web";
export const IS_MOBILE_BUILD = BUILD_TARGET === "mobile";
export const IS_WEB_BUILD = BUILD_TARGET === "web";

/** App name from env, with sensible defaults */
export const APP_NAME = (import.meta.env.VITE_APP_NAME as string) || (IS_MOBILE_BUILD ? "SmartClinic" : "SmartClinic Admin");
