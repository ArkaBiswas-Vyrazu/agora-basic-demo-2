-- CreateTable
CREATE TABLE "channels" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "host" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "channels_name_host_key" ON "channels"("name", "host");

-- AddForeignKey
ALTER TABLE "channels" ADD CONSTRAINT "channels_host_fkey" FOREIGN KEY ("host") REFERENCES "users"("uuid") ON DELETE CASCADE ON UPDATE NO ACTION;
