import type { Task } from '../../generated/prisma/client.js';
import { getPrismaClient } from '../db/client.js';

const MULTIPLIER = 1.5;
const LENGTH_MAP = {
  m: 60000,
  h: 3600000,
  d: 86400000,
};

export const parseLength = (length: string): number | null => {
  const match = length.match(/^(\d+)([mhd])$/);
  if (!match) {
    return null;
  }
  const value = parseInt(match[1]!, 10);
  const unit = match[2] as keyof typeof LENGTH_MAP;
  return value * LENGTH_MAP[unit];
};

export const getCurrentTask = async (userId: string): Promise<Task | null> => {
  const prisma = getPrismaClient();
  const now = new Date();
  const task = await prisma.task.findFirst({
    where: {
      user_id: userId,
      ends_at: {
        gt: now,
      },
      completed: false,
    },
  });
  return task;
};

export const calculateNewVaultAmount = (
  currentAmount: number,
  taskAmount: number,
  isCompleted: boolean,
): number => {
  if (isCompleted) {
    return Math.max(currentAmount - taskAmount * MULTIPLIER, 0);
  }
  return currentAmount + taskAmount;
};
