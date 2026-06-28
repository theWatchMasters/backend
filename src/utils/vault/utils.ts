import type { Task } from '../../generated/prisma/client.js';
import { getPrismaClient } from '../db/client.js';

const MULTIPLIER = 1.5; // When a task is finished, the vault amount is reduced by taskAmount * MULTIPLIER. This incentivizes users to complete their vaults on time.
const LENGTH_MAP = {
  m: 60000,
  h: 3600000,
  d: 86400000,
};

/**
 * Parses a length string into milliseconds.
 * @param length The length string (e.g., "5m", "2h", "1d")
 * @returns The length in milliseconds, or null if the string is invalid.
 */
export const parseLength = (length: string): number | null => {
  const match = length.match(/^(\d+)([mhd])$/);
  if (!match) {
    return null;
  }
  const value = parseInt(match[1]!, 10);
  const unit = match[2] as keyof typeof LENGTH_MAP;
  return value * LENGTH_MAP[unit];
};

/**
 * Retrieves the current task for a user.
 * @param userId The ID of the user
 * @returns A promise that resolves to the current task or null if no task is found.
 */
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

/**
 * Calculates the new vault amount based on the current amount, task amount, and finished status.
 * @param currentAmount The current vault amount
 * @param taskAmount The amount associated with the task
 * @param isFinished Whether the task is finished
 * @returns The new vault amount
 */
export const calculateNewVaultAmount = (
  currentAmount: number,
  taskAmount: number,
  isFinished: boolean,
): number => {
  if (isFinished) {
    return Math.max(currentAmount - taskAmount * MULTIPLIER, 0);
  }
  return currentAmount + taskAmount;
};
