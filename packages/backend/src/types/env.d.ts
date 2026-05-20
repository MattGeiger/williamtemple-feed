declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test';
      HOST?: string;
      PORT?: string;

      // Database Configuration
      DATABASE_URL: string;

      // Storage
      STORAGE_PATH?: string;

      // JWT Authentication
      JWT_SECRET?: string;
      JWT_EXPIRES_IN?: string;

      // Email (Resend)
      RESEND_API_KEY?: string;
      EMAIL_FROM?: string;

      // Application URLs
      APP_URL?: string;
      COOKIE_DOMAIN?: string;

      // Auth controls
      FORCE_AUTH?: string;
      AUTH_USERNAME?: string;
      AUTH_PASSWORD?: string;
    }
  }
}

export {};
