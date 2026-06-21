const isDev = import.meta.env.DEV;
const isProd = import.meta.env.PROD;

export const API_URL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") ||
  (isProd ? "/api" : "http://localhost:5000/api");

export const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL?.replace(/\/$/, "") ||
  (isProd ? "" : "http://localhost:5000");

export const CLERK_PUBLISHABLE_KEY =
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || "";

export const APP_ENV = import.meta.env.MODE || "development";
export const IS_DEV = isDev;
export const IS_PROD = isProd;
