/*
  Warnings:

  - Added the required column `deductible_amount` to the `Task` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "title" TEXT,
    "amount" REAL NOT NULL,
    "deductible_amount" REAL NOT NULL,
    "length" INTEGER NOT NULL,
    "ends_at" DATETIME NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "finished" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Task_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("amount", "completed", "ends_at", "finished", "id", "length", "title", "user_id") SELECT "amount", "completed", "ends_at", "finished", "id", "length", "title", "user_id" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE INDEX "Task_deductible_amount_ends_at_idx" ON "Task"("deductible_amount", "ends_at");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
