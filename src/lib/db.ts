import { Pool, PoolConfig } from 'pg';

let dbPool: Pool | null = null;

function getPoolConfig(): PoolConfig {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false,
      },
    };
  }

  return {
    user: process.env.DB_USER || 'postgres.fvqeeriisoediuwbftvh',
    host: process.env.DB_HOST || 'aws-1-eu-west-1.pooler.supabase.com',
    database: process.env.DB_NAME || 'postgres',
    password: process.env.DATABASE_PASSWORD,
    port: Number(process.env.DB_PORT || 6543),
    ssl: { rejectUnauthorized: false },
  };
}

export function getDbPool(): Pool {
  if (!dbPool) {
    dbPool = new Pool({
      ...getPoolConfig(),
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return dbPool;
}

export function isMissingTableError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '42P01';
}
