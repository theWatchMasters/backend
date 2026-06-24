import type { RequestHandler } from 'express';
import { getPrismaClient } from '../utils/db/client.js';
import { generateDataExport } from '../utils/export/utils.js';
import { sendDataExport } from '../utils/email/utils.js';

const DATA_EXPORT_RATE_LIMIT = 7 * 24 * 3600 * 1000; // 7 days

/**
 * Handles the data export process for users. It
 * 1. Checks if the user has requested a data export within the last 7 days. If so, it returns a 429 status with an error message.
 * 2. It generates the data export and asynchronously sends it to the user's email address.
 * 3. Updates the user's last_exported_data timestamp in the database.
 * 4. Returns a success response.
 */
export const exportData: RequestHandler = async (req, res) => {
  const user = await getPrismaClient().user.findUnique({
    where: { id: res.locals.userId },
    select: {
      last_exported_data: true,
      email: true,
    },
  });
  const calculateDelta = (date: Date) => +new Date() - +date;
  if (user?.last_exported_data) {
    console.log(calculateDelta(user.last_exported_data));
  }
  if (
    user?.last_exported_data &&
    calculateDelta(user.last_exported_data) < DATA_EXPORT_RATE_LIMIT
  ) {
    return res
      .status(429)
      .json({ success: false, error: 'error.too_many_requests' });
  }

  const dataExport = await generateDataExport(res.locals.userId);
  // Intentionally not awaiting
  sendDataExport(dataExport, user!.email);
  await getPrismaClient().user.update({
    where: { id: res.locals.userId },
    data: { last_exported_data: new Date() },
  });
  return res.status(200).json({
    success: true,
  });
};
