-- Case-insensitive text type for User.username.
CREATE EXTENSION IF NOT EXISTS citext;

-- CreateEnum
CREATE TYPE "ProfileVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "AnnotationVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "RatingStyle" AS ENUM ('STARS_WHOLE', 'STARS_HALF', 'STARS_QUARTER', 'DECIMAL_10', 'HUNDRED');

-- CreateEnum
CREATE TYPE "ProgressStyle" AS ENUM ('PAGES', 'PERCENT');

-- CreateEnum
CREATE TYPE "Locale" AS ENUM ('en', 'es');

-- CreateEnum
CREATE TYPE "Theme" AS ENUM ('SYSTEM', 'LIGHT', 'DARK');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "defaultAnnotationVisibility" "AnnotationVisibility" NOT NULL DEFAULT 'PRIVATE',
ADD COLUMN     "locale" "Locale" NOT NULL DEFAULT 'en',
ADD COLUMN     "onboardingCompletedAt" TIMESTAMPTZ(3),
ADD COLUMN     "profileVisibility" "ProfileVisibility" NOT NULL DEFAULT 'PUBLIC',
ADD COLUMN     "progressStyle" "ProgressStyle" NOT NULL DEFAULT 'PAGES',
ADD COLUMN     "ratingStyle" "RatingStyle" NOT NULL DEFAULT 'STARS_HALF',
ADD COLUMN     "reminderEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reminderTime" TEXT,
ADD COLUMN     "theme" "Theme" NOT NULL DEFAULT 'SYSTEM',
ADD COLUMN     "timeZone" TEXT NOT NULL DEFAULT 'UTC',
ADD COLUMN     "username" CITEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
