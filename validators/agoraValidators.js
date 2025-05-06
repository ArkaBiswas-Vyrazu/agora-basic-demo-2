import { body } from "express-validator";
import { PrismaClient } from "../generated/prisma/client.js";
import { generate } from "random-words";
const prisma = new PrismaClient();

const createHostTokenValidator = [
    body("host")
    .trim()
    .notEmpty().withMessage("Please provide host uuid")
    .custom(async value => {
        const host = await prisma.users.findFirst({
            where: {
                uuid: value
            }
        });

        if (!host) throw new Error("Provided host uuid does not exist");
    }),

    body("channel")
    .optional()
    .trim()
    .notEmpty().withMessage("Please provide valid channel name. If name does not exist in our database, we create a new entry for you")
];

export const agoraValidators = {
    createHostTokenValidator
};
