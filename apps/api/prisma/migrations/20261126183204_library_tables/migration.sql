-- CreateEnum
CREATE TYPE "BookStatus" AS ENUM ('READING', 'READ', 'WANT_TO_READ', 'ABANDONED');

-- CreateEnum
CREATE TYPE "ReadingState" AS ENUM ('IN_PROGRESS', 'FINISHED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "InheritableVisibility" AS ENUM ('INHERIT', 'PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "TagColor" AS ENUM ('WINE', 'TOBACCO', 'BRASS', 'FOREST', 'NAVY', 'OXBLOOD', 'SLATE', 'SAND');

-- CreateTable
CREATE TABLE "UserBook" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "editionId" TEXT NOT NULL,
    "status" "BookStatus" NOT NULL,
    "rating" INTEGER,
    "hiddenFromProfile" BOOLEAN NOT NULL DEFAULT false,
    "annotationVisibility" "InheritableVisibility" NOT NULL DEFAULT 'INHERIT',
    "progressStyle" "ProgressStyle",
    "archivedAt" TIMESTAMPTZ(3),
    "addedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "UserBook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reading" (
    "id" TEXT NOT NULL,
    "userBookId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "state" "ReadingState" NOT NULL,
    "startedOn" DATE,
    "finishedOn" DATE,
    "currentPage" INTEGER,
    "percentBp" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Reading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" CITEXT NOT NULL,
    "color" "TagColor" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBookTag" (
    "userBookId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "UserBookTag_pkey" PRIMARY KEY ("userBookId","tagId")
);

-- CreateIndex
CREATE INDEX "UserBook_userId_status_idx" ON "UserBook"("userId", "status");

-- CreateIndex
CREATE INDEX "UserBook_workId_idx" ON "UserBook"("workId");

-- CreateIndex
CREATE INDEX "UserBook_editionId_idx" ON "UserBook"("editionId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBook_userId_workId_key" ON "UserBook"("userId", "workId");

-- CreateIndex
CREATE UNIQUE INDEX "Reading_userBookId_number_key" ON "Reading"("userBookId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Reading_userBookId_key" ON "Reading"("userBookId") WHERE (state = 'IN_PROGRESS');

-- CreateIndex
CREATE UNIQUE INDEX "Tag_userId_name_key" ON "Tag"("userId", "name");

-- CreateIndex
CREATE INDEX "UserBookTag_tagId_idx" ON "UserBookTag"("tagId");

-- AddForeignKey
ALTER TABLE "UserBook" ADD CONSTRAINT "UserBook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBook" ADD CONSTRAINT "UserBook_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBook" ADD CONSTRAINT "UserBook_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "Edition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reading" ADD CONSTRAINT "Reading_userBookId_fkey" FOREIGN KEY ("userBookId") REFERENCES "UserBook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBookTag" ADD CONSTRAINT "UserBookTag_userBookId_fkey" FOREIGN KEY ("userBookId") REFERENCES "UserBook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBookTag" ADD CONSTRAINT "UserBookTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Check constraints (hand-written; Prisma does not model them)
ALTER TABLE "UserBook" ADD CONSTRAINT "UserBook_rating_check" CHECK ("rating" IS NULL OR "rating" BETWEEN 0 AND 100);

ALTER TABLE "Reading" ADD CONSTRAINT "Reading_percentBp_check" CHECK ("percentBp" BETWEEN 0 AND 10000);

ALTER TABLE "Reading" ADD CONSTRAINT "Reading_currentPage_check" CHECK ("currentPage" IS NULL OR "currentPage" >= 0);
