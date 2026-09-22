import * as Joi from 'joi';

/**
 * Every environment variable the app reads, validated at startup.
 * Missing/invalid values stop the process instead of failing later at runtime.
 */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  APP_ENV: Joi.string().default('local'),
  PORT: Joi.number().default(4000),
  TRUST_PROXY: Joi.number().default(0),
  WEB_ORIGIN: Joi.string().default('http://localhost:8081'),

  DB_HOST: Joi.string().required(),
  DB_REPLICA_HOST: Joi.string().optional(),
  DB_PORT: Joi.number().default(5432),
  DB_NAME: Joi.string().required(),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_SSL: Joi.boolean().default(false),

  REDIS_URL: Joi.string().required(),
  RMQ_URL: Joi.string().required(),

  S3_BUCKET: Joi.string().required(),
  S3_REGION: Joi.string().default('ap-southeast-1'),
  S3_ENDPOINT: Joi.string().optional(), // MinIO locally

  JWT_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_TTL: Joi.string().default('15m'),
  REFRESH_TTL_DAYS: Joi.number().default(30),
  SHUTDOWN_DRAIN_MS: Joi.number().default(20000),
  LINE_CHANNEL_SECRET: Joi.string().optional(),
  FB_APP_SECRET: Joi.string().optional(),
  SMTP_URL: Joi.string().optional(),
});
