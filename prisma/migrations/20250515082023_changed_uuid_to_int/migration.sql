/*
  Warnings:

  - The primary key for the `channels` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `channels` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.
  - Changed the type of `host` on the `channels` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `host` on the `subscriptions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `subscriber` on the `subscriptions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `uuid` on the `users` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "channels" DROP CONSTRAINT "channels_host_fkey";

-- DropForeignKey
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_host_fkey";

-- DropForeignKey
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_subscriber_fkey";

-- AlterTable
ALTER TABLE "channels" DROP CONSTRAINT "channels_pkey",
-- ALTER COLUMN "id" SET DATA TYPE SERIAL,
DROP COLUMN "host",
ADD COLUMN     "host" INTEGER NOT NULL,
ADD CONSTRAINT "channels_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "subscriptions" DROP COLUMN "host",
ADD COLUMN     "host" INTEGER NOT NULL,
DROP COLUMN "subscriber",
ADD COLUMN     "subscriber" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "uuid",
ADD COLUMN     "uuid" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "channels_name_host_key" ON "channels"("name", "host");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_host_subscriber_key" ON "subscriptions"("host", "subscriber");

-- CreateIndex
CREATE UNIQUE INDEX "users_uuid_key" ON "users"("uuid");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_host_fkey" FOREIGN KEY ("host") REFERENCES "users"("uuid") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_subscriber_fkey" FOREIGN KEY ("subscriber") REFERENCES "users"("uuid") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "channels" ADD CONSTRAINT "channels_host_fkey" FOREIGN KEY ("host") REFERENCES "users"("uuid") ON DELETE CASCADE ON UPDATE NO ACTION;
