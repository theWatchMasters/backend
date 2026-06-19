import { PrismaClient } from '../../generated/prisma/client.js';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
const once = <T>(f: () => T) => {
  let instance: T | null = null;
  return () => instance ?? (instance = f());
};

// Currently, we use SQLite3 in development
const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL?.replace('file:', '') || './dev.db',
});
export const getPrismaClient = once(() => new PrismaClient({ adapter }));
