-- CreateTable
CREATE TABLE "ExternalCache" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExternalCache_key_key" ON "ExternalCache"("key");

-- CreateIndex
CREATE INDEX "ExternalCache_expiresAt_idx" ON "ExternalCache"("expiresAt");
