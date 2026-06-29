import type { RequestHandler } from 'express';
import { getPrismaClient } from '../db/client.js';
import { authMiddleware } from '../auth/middleware.js';

const TASK_EXPIRY_LENGTH = 24 * 60 * 60 * 1000; // The deadline before a task expires

async function updateInactiveTask(userId: string) {
  const now = new Date();
  const prisma = getPrismaClient();
  await prisma.task.updateMany({
    where: {
      user_id: userId,
      ends_at: {
        lt: now,
      },
      completed: false,
    },
    data: {
      completed: true,
      finished: false,
    },
    limit: 1,
  });
}
async function updateExpiredTask(userId: string) {
  const now = new Date();
  const prisma = getPrismaClient();
  await prisma.$transaction(async (prisma) => {
    const count =
      (
        await prisma.task.aggregate({
          where: {
            user_id: userId,
            ends_at: {
              lt: new Date(now.getTime() - TASK_EXPIRY_LENGTH),
            },
            deductible_amount: {
              not: 0,
            },
          },
          _sum: { deductible_amount: true },
        })
      )._sum.deductible_amount || 0;

    await prisma.task.updateMany({
      where: {
        ends_at: {
          lt: new Date(now.getTime() - TASK_EXPIRY_LENGTH),
        },
        deductible_amount: {
          not: 0,
        },
      },
      data: {
        deductible_amount: 0,
      },
    });

    await prisma.user.update({
      where: { id: userId },
      data: {
        vault_amount: {
          decrement: count,
        },
      },
    });
  });
}

export function vaultMiddleware(handler: RequestHandler): RequestHandler {
  return authMiddleware(async (req, res, next) => {
    const userId = res.locals.userId;
    await updateInactiveTask(userId);
    await updateExpiredTask(userId);
    return handler(req, res, next);
  });
}
