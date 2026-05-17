import { getEnv } from "../utils/get-env";

const toBoolean = (value: string) => {
  const normalized = value.trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
};

const envConfig = () => {
  const nodeEnv = getEnv("NODE_ENV", "development");
  const isDevelopment = nodeEnv === "development";

  return {
    NODE_ENV: nodeEnv,

    PORT: getEnv("PORT", "8000"),
    BASE_PATH: getEnv("BASE_PATH", "/api"),
    MONGO_URI: getEnv(
      "MONGO_URI",
      isDevelopment ? "mongodb://127.0.0.1:27017/poket_planner" : undefined
    ),
    MONGO_FALLBACK_URI: getEnv(
      "MONGO_FALLBACK_URI",
      isDevelopment ? "mongodb://127.0.0.1:27017/poket_planner" : ""
    ),
    DB_FALLBACK_ENABLED: toBoolean(
      getEnv("DB_FALLBACK_ENABLED", isDevelopment ? "true" : "false")
    ),

    JWT_SECRET: getEnv("JWT_SECRET", "secert_jwt"),
    JWT_EXPIRES_IN: getEnv("JWT_EXPIRES_IN", "15m") as string,

    JWT_REFRESH_SECRET: getEnv("JWT_REFRESH_SECRET", "secert_jwt_refresh"),
    JWT_REFRESH_EXPIRES_IN: getEnv("JWT_REFRESH_EXPIRES_IN", "7d") as string,

    GEMINI_API_KEY: getEnv("GEMINI_API_KEY", ""),
    GEMINI_MODEL: getEnv("GEMINI_MODEL", "gemini-2.0-flash"),
    GROQ_API_KEY: getEnv("GROQ_API_KEY", ""),
    GROQ_MODEL: getEnv("GROQ_MODEL", "llama-3.2-11b-vision-preview"),
    OPENAI_API_KEY: getEnv("OPENAI_API_KEY", ""),
    OPENAI_MODEL: getEnv("OPENAI_MODEL", "gpt-4o-mini"),

    CLOUDINARY_CLOUD_NAME: getEnv("CLOUDINARY_CLOUD_NAME"),
    CLOUDINARY_API_KEY: getEnv("CLOUDINARY_API_KEY"),
    CLOUDINARY_API_SECRET: getEnv("CLOUDINARY_API_SECRET"),

    RESEND_API_KEY: getEnv("RESEND_API_KEY"),
    RESEND_MAILER_SENDER: getEnv("RESEND_MAILER_SENDER", ""),

    FRONTEND_ORIGIN: getEnv("FRONTEND_ORIGIN", "http://localhost:5173"),

    SEED_DEMO_USER: toBoolean(
      getEnv("SEED_DEMO_USER", isDevelopment ? "true" : "false")
    ),
    DEMO_USER_NAME: getEnv("DEMO_USER_NAME", "Demo User"),
    DEMO_USER_EMAIL: getEnv("DEMO_USER_EMAIL", "demo@pocketplanner.local"),
    DEMO_USER_PASSWORD: getEnv("DEMO_USER_PASSWORD", "Demo@12345"),
  };
};

export const Env = envConfig();
