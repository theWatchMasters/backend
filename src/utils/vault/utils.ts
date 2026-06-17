import type { DefaultArgs } from '@prisma/client/runtime/client';
import type { PrismaClient, Task } from '../../generated/prisma/client.js';
import { getPrismaClient } from '../db/client.js';

const MULTIPLIER = 1.5;
const LENGTH_MAP = {
  m: 60000,
  h: 3600000,
  d: 86400000,
};
const MIN_AMOUNT = 1;
const MAX_TASK_AMOUNT = 100;
const MAX_VAULT_AMOUNT = 100;

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

export const isTaskValid = (
  vaultAmount: number,
  taskAmount: number,
): boolean => {
  return (
    vaultAmount + taskAmount <= MAX_VAULT_AMOUNT &&
    taskAmount <= MAX_TASK_AMOUNT
  );
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

export const deductFromTasks = async (
  userId: string,
  amount: number,
  prisma: Omit<
    PrismaClient<never, undefined, DefaultArgs>,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  >,
) => {
  const amountCopy = amount;
  const tasks = await prisma.task.findMany({
    where: {
      user_id: userId,
      deductible_amount: {
        gt: 0,
      },
    },
    orderBy: {
      ends_at: 'asc',
    },
    select: {
      id: true,
      deductible_amount: true,
      ends_at: true,
    },
    take: Math.ceil(MAX_TASK_AMOUNT / MIN_AMOUNT),
  });

  let maxDate = new Date(0);
  for (const task of tasks) {
    if (amount <= 0) break;
    if (task.deductible_amount >= amount) {
      await prisma.task.update({
        where: { id: task.id },
        data: {
          deductible_amount: task.deductible_amount - amount,
        },
      });
      break;
    }
    amount -= task.deductible_amount;
    maxDate = task.ends_at;
  }
  await prisma.task.updateMany({
    where: {
      user_id: userId,
      ends_at: {
        lte: maxDate,
      },
      deductible_amount: {
        gt: 0,
      },
    },
    data: {
      deductible_amount: 0,
    },
  });
  return amountCopy - amount;
};
