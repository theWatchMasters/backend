import type {
  Prisma,
  PrismaClient,
  Task,
  User,
} from '../../generated/prisma/client.js';
import { Readable } from 'stream';
import { getPrismaClient } from '../db/client.js';

export type DataExport = {
  user: Omit<User, 'password' | 'mfa_token'>;
  tasks: Task[];
};

export async function generateDataExport(userId: string): Promise<Readable> {
  // TODO: make this lazy
  const [user, tasks] = await Promise.all([
    getPrismaClient().user.findUnique({
      where: { id: userId },
      omit: { password: true, mfa_token: true },
    }),
    getPrismaClient().task.findMany({ where: { user_id: userId } }),
  ]);
  return new Readable({
    read() {
      this.push(JSON.stringify({ user: user!, tasks } satisfies DataExport));
      this.push(null);
    },
  });
}
