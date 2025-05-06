import { PrismaClient, Prisma } from "../generated/prisma/client.js";
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


async function listUsers(req, res) {
    try {
        const users = await prisma.users.findMany({
            select: {
                id: true,
                name: true,
                uuid: true,
                created_at: true,
                updated_at: true
            },
            where: {
                NOT: {
                    uuid: req.user.uuid
                }
            }
        });

        for (const user of users) {
            user['is_subscribed'] = false;
            try {
                const subscription = await prisma.subscriptions.findFirst({
                    where: {
                        host: user.uuid,
                        subscriber: req.user.uuid
                    }
                });

                user['is_subscribed'] = (subscription !== null);
            } catch (err) {
                console.log(err)
                continue;
            }
        }

        res.status(200).json(users);
    } catch (err) {
        console.log(err);
        res.status(500).send(err);
    }
}


async function subscribeUser(req, res) {
    try {
        const row = await prisma.subscriptions.create({
            data: {
                host: req.body.host,
                subscriber: req.body.subscriber
            }
        });

        res.redirect("/");
    } catch(err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError) {
            if (err.code === "P2002") res.status(400).json("This subscription already exists");
            else throw err; 
        }
    }
}


export const userControllers = {
    registerUser,
    listUsers,
    subscribeUser
};
