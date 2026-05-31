-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "avatar_id" TEXT NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'SYSTEM'
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
