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

export const calculateDeduction = (
  taskAmount: number
): number => {
  return taskAmount * (MULTIPLIER - 1);
};

/**
 * Deducts as much money as possible from the user's unfinished tasks,
 * starting with the ones that expire the soonest until the specified amount is deducted.
 * 
 * For example, imagine the tasks as a tuple of (deductible_amount, ends_at): [(10, 3pm), (20, 4pm), (30, 5pm)].
 * If we want to deduct 25, we would first deduct 10 from the first task, then 15 from the second task, leaving us with [(0, 3pm), (5, 4pm), (30, 5pm)].
 * 
 * @param userId The ID of the user
 * @param amount The amount to deduct
 * @param id The ID of the task that triggered the deduction. This is used to prevent deducting from the same task multiple times 
 * @param prisma An instance of the Prisma client to use for database operations. This is passed for interop with transactions
 * @return The actual amount deducted
 */
export const deductFromTasks = async (
  userId: string,
  amount: number,
  id: string,
  prisma: Omit<
    PrismaClient<never, undefined, DefaultArgs>,
    '$connect' | '$disconnect' | '$on' | '$use' | '$extends'
  >,
) => {
  // The maximum amount of tasks we would need to deduct from is amount / MIN_AMOUNT, 
  // since each task has a minimum deductible amount of MIN_AMOUNT. 
  const tasks = await prisma.task.findMany({
    where: {
      user_id: userId,
      deductible_amount: {
        gt: 0,
      },
      id: {
        not: id,
      }
    },
    orderBy: {
      ends_at: 'asc',
    },
    select: {
      id: true,
      deductible_amount: true,
      ends_at: true,
    },
    take: Math.ceil(amount / MIN_AMOUNT),
  });

  
  // We iterate over the tasks, and subtract as much as possible
  // We keep track of the maximum ends_at of the tasks we have deducted from, 
  // then we set the deductible_amount of all tasks that end before that date to 0
  // instead of manually updating each task one by one
  let amountLeft = amount;
  let maxDate = new Date(0);
  for (const task of tasks) {
    if (amountLeft <= 0) break;
    if (task.deductible_amount > amountLeft) {
      // If the current task can cover the remaining amount, we deduct the remaining amount from it and break the loop
      await prisma.task.update({
        where: { id: task.id },
        data: {
          deductible_amount: task.deductible_amount - amountLeft,
        },
      });
      amountLeft = 0;
      break;
    }
    amountLeft -= task.deductible_amount;
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
  // amountLeft now stores the difference between the original amount and actual amount deducted
  // Therefore, amount - amountLeft gives us the actual amount deducted
  return amount - amountLeft;
};
