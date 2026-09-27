import { Pool, PoolConfig } from 'pg';

const poolConfig: PoolConfig = {
  connectionString: process.env.DATABASE_URL || undefined,
  ...(process.env.DATABASE_URL
    ? {}
    : {
        user: process.env.DB_USER || 'postgres.fvqeeriisoediuwbftvh',
        host: process.env.DB_HOST || 'aws-1-eu-west-1.pooler.supabase.com',
        database: process.env.DB_NAME || 'postgres',
        password: process.env.DATABASE_PASSWORD,
        port: Number(process.env.DB_PORT || 6543),
        ssl: { rejectUnauthorized: false },
      }),
};

export const dbPool = new Pool(poolConfig);
