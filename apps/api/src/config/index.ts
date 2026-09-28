import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(8080),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PREFIX: z.string().default('/api/v1'),
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/byteforge_omnicommerce?schema=public'),
  JWT_SECRET: z.string().default('dev-insecure-jwt-secret-byteforge-omnicommerce-2026-local'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  ENCRYPTION_KEY: z.string().default('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  SHOPIFY_API_VERSION: z.string().default('2025-01'),
  META_API_VERSION: z.string().default('v21.0'),
  META_DEFAULT_VERIFY_TOKEN: z.string().default('byteforge_meta_verify_token_dev'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment configuration:', parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;
