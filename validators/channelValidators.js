import { body, query } from "express-validator";
import { PrismaClient } from "../generated/prisma/client.js";
const prisma = new PrismaClient();

const registerChannelValidator = [
    body("host")
    .trim()
    .notEmpty().withMessage("Please provide a valid host uuid")
    .custom(async value => {
        const host = await prisma.users.findFirst({
            where: {
                uuid: value
            }
        });
        if (!host) throw new Error('Provided host uuid does not exist');
    }),

    body("channel")
    .trim()
    .custom(async (value, { req }) => {
        const channel = await prisma.channels.findFirst({
            where: {
                name: value,
                host: req.body.host
            }
        });

        if (channel) throw new Error(`Channel ${value} already exists for this user`);
    })
]

const listChannelValidator = [
    query("host")
    .trim()
    .notEmpty().withMessage("Please provide a valid host uuid")
    .custom(async value => {
        const host = await prisma.users.findFirst({
            where: {
                uuid: value
            }
        });
        if (!host) throw new Error('Provided host uuid does not exist');
    })
]

export const channelValidators = {
    registerChannelValidator,
    listChannelValidator
};
