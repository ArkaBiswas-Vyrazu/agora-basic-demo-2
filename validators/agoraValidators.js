import { body } from "express-validator";
import { PrismaClient } from "../generated/prisma/client.js";
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

const createAudienceTokenValidator = [
    body("host")
    .trim()
    .notEmpty().withMessage("Please provide a valid host uuid")
    .custom(async value => {
        const host = await prisma.users.findFirst({
            where: {
                uuid: value
            }
        });

        if (!host) throw new Error("Provided host uuid does not exist");
    }),
    
    body("channel")
    .trim()
    .notEmpty().withMessage("Please provide channel name")
    .custom(async (value, { req }) => {
        const channel = await prisma.channels.findFirst({
            where: {
                name: value,
                host: req.body.host
            }
        });

        if (!channel) throw new Error(`No channel ${value} exists for provided host`);
    }),

    body("user")
    .trim()
    .notEmpty().withMessage("Please provide a valid user uuid. This user needs to be subscribed to provided host")
    .custom(async (value, { req }) => {
        const user = await prisma.users.findFirst({
            where: {
                uuid: value
            }
        });

        if (!user) throw new Error("Provided user uuid does not exist");

        const subscription = await prisma.subscriptions.findFirst({
            where: {
                subscriber: value,
                host: req.body.host
            }
        });

        if (!subscription) throw new Error("Provided user is not subscribed to provided host");
    })
]

export const agoraValidators = {
    createHostTokenValidator,
    createAudienceTokenValidator
};
