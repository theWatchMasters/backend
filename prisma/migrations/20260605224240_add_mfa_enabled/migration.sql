-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "avatar_id" TEXT NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'SYSTEM',
    "mfa_token" TEXT,
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "vault_amount" REAL NOT NULL DEFAULT 0
);
INSERT INTO "new_User" ("avatar_id", "email", "id", "mfa_token", "password", "theme", "vault_amount") SELECT "avatar_id", "email", "id", "mfa_token", "password", "theme", "vault_amount" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
