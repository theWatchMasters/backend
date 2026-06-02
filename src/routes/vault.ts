import type { RequestHandler } from "express";
import { verifyJWT } from "../utils/auth/jwt.js";
import { calculateNewVaultAmount, getCurrentTask, parseLength } from "../utils/vault/utils.js";
import { getPrismaClient } from "../utils/db/client.js";

const MAX_AMOUNT = 100;
const PAGE_SIZE = 10;
export const CreateVault: RequestHandler = async (req, res) => {
    const jwt = verifyJWT(req.cookies?.__session || '');
    if (!jwt) {
        return res.status(401).json({ success: false, error: "error.unauthorized" });
    }

    const { title, length, amount } = req.body;
    if (!length || !amount) {
        return res.status(400).json({ success: false, error: "error.missing_fields" });
    }

    const task = await getCurrentTask(jwt.id);
    if (task) {
        return res.status(400).json({ success: false, error: "error.active_task_exists" });
    }

    if (amount <= 0 || amount > MAX_AMOUNT) {
        return res.status(400).json({ success: false, error: "error.invalid_amount" });
    }

    const parsedLength = parseLength(req.body.length);
    if (!parsedLength) {
        return res.status(400).json({ success: false, error: "error.invalid_length" });
    }

    const endTime = new Date(Date.now() + parsedLength);
    const prisma = getPrismaClient();
    await prisma.$transaction([
        prisma.task.create({
            data: {
                user_id: jwt.id,
                title: title || "Untitled Vault",
                ends_at: endTime,
                length,
                amount
            }
        }),
        prisma.user.update({
            where: { id: jwt.id },
            data: { vault_amount: { increment: amount } }
        })
    ]);
    return res.status(200).json({ success: true });
}

export const ListVault: RequestHandler = async (req, res) => {
    const jwt = verifyJWT(req.cookies?.__session || '');
    if (!jwt) {
        return res.status(401).json({ success: false, error: "error.unauthorized" });
    }

    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    if (isNaN(page) || page < 0) {
        return res.status(400).json({ success: false, error: "error.invalid_page" });
    }

    const tasks = await getPrismaClient().task.findMany({
        where: { user_id: jwt.id },
        orderBy: { ends_at: 'desc' },
        take: page * PAGE_SIZE,
        skip: (page - 1) * PAGE_SIZE
    });
    res.json({ success: true, tasks });
}

const CompleteVault: ((arg0: boolean) => RequestHandler) = finished => async (req, res) => {
    const jwt = verifyJWT(req.cookies?.__session || '');
    if (!jwt) {
        return res.status(401).json({ success: false, error: "error.unauthorized" });
    }

    const { id } = req.body;
    if (!id) {
        return res.status(400).json({ success: false, error: "error.missing_fields" });
    }

    const task = await getPrismaClient().task.findUnique({ where: { id } });
    if (!task || task.user_id !== jwt.id) {
        return res.status(404).json({ success: false, error: "error.task_not_found" });
    }

    if (task.completed) {
        return res.status(400).json({ success: false, error: "error.task_already_completed" });
    }
    const { vault_amount } = await getPrismaClient().user.findUniqueOrThrow({ where: { id: jwt.id }, select: { vault_amount: true } });

    const prisma = getPrismaClient();
    await prisma.$transaction([
        prisma.task.update({
            where: { id },
            data: { completed: true, finished }
        }),
        prisma.user.update({
            where: { id: jwt.id },
            data: { vault_amount: calculateNewVaultAmount(vault_amount, task.amount, finished) }
        })
    ]);
    res.json({ success: true });
}

export const FinishVault = CompleteVault(true);
export const UnfinishedVault = CompleteVault(false);

export const ActiveVault: RequestHandler = async (req, res) => {
    const jwt = verifyJWT(req.cookies?.__session || '');
    if (!jwt) {
        return res.status(401).json({ success: false, error: "error.unauthorized" });
    }
    return res.json({ success: true, task: await getCurrentTask(jwt.id) });
}