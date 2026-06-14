import type { RequestHandler } from 'express';
import {
  calculateNewVaultAmount,
  getCurrentTask,
  parseLength,
} from '../utils/vault/utils.js';
import { getPrismaClient } from '../utils/db/client.js';

const MAX_AMOUNT = 100;
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

  if (amount <= 0 || amount > MAX_AMOUNT) {
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
  if (isNaN(page) || page < 0) {
    return res
      .status(400)
      .json({ success: false, error: 'error.invalid_page' });
  }

  const tasks = await getPrismaClient().task.findMany({
    where: { user_id: res.locals.userId },
    orderBy: { ends_at: 'desc' },
    take: page * PAGE_SIZE,
    skip: (page - 1) * PAGE_SIZE,
  });
  res.json({ success: true, tasks });
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
    const { vault_amount } = await getPrismaClient().user.findUniqueOrThrow({
      where: { id: res.locals.userId },
      select: { vault_amount: true },
    });

    const prisma = getPrismaClient();
    await prisma.$transaction([
      prisma.task.update({
        where: { id },
        data: { completed: true, finished },
      }),
      prisma.user.update({
        where: { id: res.locals.userId },
        data: {
          vault_amount: calculateNewVaultAmount(
            vault_amount,
            task.amount,
            finished,
          ),
        },
      }),
    ]);
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
