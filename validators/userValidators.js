import { body } from "express-validator";
import { PrismaClient } from "../generated/prisma/client.js";
const prisma = new PrismaClient();

const registerUserValidator = [
    body("name")
    .notEmpty().withMessage("Please provide a name")
    .isLength({min: 4}).withMessage("Name should have atleast 4 characters")
    .isAlphanumeric().withMessage("Name can only contain alphabets and numbers")
    .custom(async value => {
        const user = await prisma.users.findFirst({where: {name: value}});
        if (user) throw new Error("Username already exists"); 
    }),

    body("password")
    .notEmpty().withMessage("Please provide a password")
    .isLength({min: 8}).withMessage("Password length should be atleast 8 characters")
];

const subscribeUserValidator = [
    body("host")
    .notEmpty().withMessage("Please provide a valid host uuid")
    .trim()
    .custom(async value => {
        const user = await prisma.users.findFirst({where: {uuid: parseInt(value)}});
        if (!user) throw new Error("Provided Host uuid does not exist");
    }),

    body("subscriber")
    .notEmpty().withMessage("Please provide a valid subscriber uuid")
    .trim()
    .custom(async value => {
        const user = await prisma.users.findFirst({where: {uuid: parseInt(value)}});
        if (!user) throw new Error("Provided Subscriber uuid does not exist");
    })
]


export const userValidators = {
    registerUserValidator,
    subscribeUserValidator
};
