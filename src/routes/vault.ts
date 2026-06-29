import type { RequestHandler } from 'express';
import {
  calculateDeduction,
  deductFromTasks,
  getCurrentTask,
  isTaskValid,
  parseLength,
} from '../utils/vault/utils.js';
import { getPrismaClient } from '../utils/db/client.js';
import {
  cancelPayment,
  capturePayment,
  createPaymentIntent,
  isPaymentIntentSuccessful,
} from '../utils/payments/utils.js';

const PAGE_SIZE = 10;
export const createVault: RequestHandler = async (req, res) => {
  const { title, length, amount } = req.body;
  if (!length || !amount) {
    console.log('Missing fields:', { length, amount });
    return res
      .status(400)
      .json({ success: false, error: 'error.missing_fields' });
  }

  const task = await getCurrentTask(res.locals.userId);
  if (task) {
    console.log('Active task exists:', task);
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
    !isTaskValid(vaultAmount?.vault_amount ?? Infinity, amount)
  ) {
    return res
      .status(400)
      .json({ success: false, error: 'error.invalid_fields' });
  }

  const parsedLength = parseLength(req.body.length);
  if (!parsedLength) {
    console.log('Invalid length:', req.body.length);
    return res
      .status(400)
      .json({ success: false, error: 'error.invalid_fields' });
  }

  const endTime = new Date(Date.now() + parsedLength);
  const intent = await createPaymentIntent(amount);
  const prisma = getPrismaClient();
  await prisma.task.create({
    data: {
      user_id: res.locals.userId,
      title: title || 'Untitled Vault',
      ends_at: endTime,
      length: parsedLength,
      deductible_amount: 0,
      amount,
      payment_intent: intent.id,
      payment_intent_client_secret: intent.client_secret,
      payment_status: 'UNPAID',
    },
  });
  return res.status(200).json({ success: true, intent });
};

export const payVault: RequestHandler = async (req, res) => {
  const { intent } = req.body;
  if (!intent) {
    return res
      .status(400)
      .json({ success: false, error: 'error.missing_fields' });
  }
  if (!(await isPaymentIntentSuccessful(intent))) {
    return res
      .status(400)
      .json({ success: false, error: 'error.payment_not_successful' });
  }
  const task = await getPrismaClient().task.findFirst({
    where: { payment_intent: intent, user_id: res.locals.userId },
  });
  if (!task) {
    return res
      .status(404)
      .json({ success: false, error: 'error.task_not_found' });
  }
  await getPrismaClient().$transaction([
    getPrismaClient().task.update({
      where: {
        id: task.id,
      },
      data: {
        payment_status: 'AUTHORISED',
        deductible_amount: task.amount,
      },
    }),
    getPrismaClient().user.update({
      where: { id: res.locals.userId },
      data: { vault_amount: { increment: task.amount } },
    }),
  ]);
  return res.status(200).json({ success: true });
};

export const listVault: RequestHandler = async (req, res) => {
  const page = req.query.page ? parseInt(req.query.page as string) : 0;
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
      finished: true,
    },
    orderBy: { ends_at: isUnfinished ? 'asc' : 'desc' },
    ...(!isUnfinished && {
      take: PAGE_SIZE,
      skip: page * PAGE_SIZE,
    }),
  });
  const length = await getPrismaClient().task.count({
    where: {
      user_id: res.locals.userId,
      ...(isUnfinished && { completed: true, deductible_amount: { not: 0 } }),
    },
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
    if (
      task.completed ||
      ['CANCELLED', 'CAPTURED'].includes(task.payment_status)
    ) {
      return res
        .status(400)
        .json({ success: false, error: 'error.task_already_completed' });
    }
    if (task.payment_status === 'UNPAID') {
      return res
        .status(400)
        .json({ success: false, error: 'error.payment_not_completed' });
    }
    const prisma = getPrismaClient();
    if (finished) {
      await cancelPayment(task.payment_intent);
    } else {
      await capturePayment(task.payment_intent);
    }
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
      payment_intent: task.payment_intent,
      payment_intent_client_secret: task.payment_intent_client_secret,
      payment_status: task.payment_status,
    },
  });
};
