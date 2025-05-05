import { PrismaClient } from "../generated/prisma/client.js";
import bcrypt from "bcryptjs";
const prisma = new PrismaClient();

async function registerUser(req, res) {
    const user = await prisma.users.create({
        data: {
            name: req.body.name,
            password: await bcrypt.hash(req.body.password, 12)
        }
    });

    if (!user) res.status(500).send("Error occured while trying to create user, please try again");
    else res.redirect("/");
}

export const userControllers = {
    registerUser
};
