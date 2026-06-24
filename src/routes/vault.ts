import type { RequestHandler } from 'express';
import {
  calculateDeduction,
  deductFromTasks,
  getCurrentTask,
  isTaskValid,
  parseLength,
} from '../utils/vault/utils.js';
import { getPrismaClient } from '../utils/db/client.js';

const PAGE_SIZE = 10;
export const createVault: RequestHandler = async (req, res) => {
  const { title, length, amount } = req.body;
  if (!length || !amount) {
    return res
      .status(400)
      .json({ success: false, error: 'error.missing_fields' });
  }

  const task = await getCurrentTask(res.locals.userId);
  if (task) {
    return res
      .status(400)
      .json({ success: false, error: 'error.active_task_exists' });
  }
  const vaultAmount = await getPrismaClient().user.findUnique({
    where: {
      id: res.locals.userId,
    },
    select: {
      vault_amount: true,
    },
  });
  if (
    amount <= 0 ||
    !isTaskValid(vaultAmount?.vault_amount || Infinity, amount)
  ) {
    return res
      .status(400)
      .json({ success: false, error: 'error.invalid_fields' });
  }

  const parsedLength = parseLength(req.body.length);
  if (!parsedLength) {
    return res
      .status(400)
      .json({ success: false, error: 'error.invalid_fields' });
  }

  const endTime = new Date(Date.now() + parsedLength);
  const prisma = getPrismaClient();
  await prisma.$transaction([
    prisma.task.create({
      data: {
        user_id: res.locals.userId,
        title: title || 'Untitled Vault',
        ends_at: endTime,
        length: parsedLength,
        deductible_amount: amount,
        amount,
      },
    }),
    prisma.user.update({
      where: { id: res.locals.userId },
      data: { vault_amount: { increment: amount } },
    }),
  ]);
  return res.status(200).json({ success: true });
};

export const listVault: RequestHandler = async (req, res) => {
  const page = req.query.page ? parseInt(req.query.page as string) : 1;
  // If the query parameter "unfinished" is set to "true"
  // We're returning the vault tasks which still have a deductible amount
  const isUnfinished = req.query.unfinished === 'true';
  if (isNaN(page) || page < 0) {
    return res
      .status(400)
      .json({ success: false, error: 'error.invalid_page' });
  }
  const tasks = await getPrismaClient().task.findMany({
    where: {
      user_id: res.locals.userId,
      ...(isUnfinished && { completed: true, deductible_amount: { not: 0 } }),
    },  
    select: {
      id: true,
      title: true,
      amount: true,
      deductible_amount: true,
      length: true,
      ends_at: true,
      completed: true,
      finished: true
    },
    orderBy: { ends_at: isUnfinished ? 'asc' : 'desc' },
    take: PAGE_SIZE,
    skip: page * PAGE_SIZE,
  });
  const length = await getPrismaClient().task.count({
    where: {
      user_id: res.locals.userId,
      ...(isUnfinished && { completed: true, deductible_amount: { not: 0 } }),
    }
  });
  const pages = Math.ceil(length / PAGE_SIZE);
  res.json({ success: true, tasks, pages });
};

const completeVault: (arg0: boolean) => RequestHandler =
  (finished) => async (req, res) => {
    const { id } = req.body;
    if (!id) {
      return res
        .status(400)
        .json({ success: false, error: 'error.missing_fields' });
    }

    const task = await getPrismaClient().task.findUnique({ where: { id } });
    if (!task || task.user_id !== res.locals.userId) {
      return res
        .status(404)
        .json({ success: false, error: 'error.task_not_found' });
    }

    if (task.completed) {
      return res
        .status(400)
        .json({ success: false, error: 'error.task_already_completed' });
    }
    const prisma = getPrismaClient();
    await prisma.$transaction(async (prisma) => {
      await prisma.task.update({
        where: { id },
        data: {
          completed: true,
          finished,
          deductible_amount: finished ? 0 : task.amount,
        },
      });

      if (finished) {
        const vaultDeduction = await deductFromTasks(
          res.locals.userId,
          calculateDeduction(task.amount),
          id,
          prisma,
        );
        await prisma.user.update({
          where: { id: res.locals.userId },
          data: {
            vault_amount: {
              decrement: vaultDeduction + task.amount,
            },
          },
        });
      }
    });
    res.json({ success: true });
  };

export const finishVault = completeVault(true);
export const unfinishedVault = completeVault(false);

export const activeVault: RequestHandler = async (req, res) => {
  const task = await getCurrentTask(res.locals.userId);
  return res.json({
    success: true,
    task: task && {
      id: task.id,
      title: task.title,
      ends_at: task.ends_at.toISOString(),
    },
  });
};
