import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';
const once = <T>(f: () => T) => {
  let instance: T | null = null;
  return () => instance ?? (instance = f());
};

const connectionString = process.env.DATABASE_URL;
const adapter = new PrismaPg({ connectionString });
export const getPrismaClient = once(() => new PrismaClient({ adapter }));
