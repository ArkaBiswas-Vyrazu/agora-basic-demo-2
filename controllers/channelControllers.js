import { generate } from "random-words";
import { PrismaClient, Prisma } from "../generated/prisma/client.js";
const prisma = new PrismaClient();

async function registerChannel(req, res) {
    try {
        const channelName = req.body.channel || generate({ exactly: 3, formatter: (word) => word.toUpperCase() }).join("-");

        const channel = await prisma.channels.create({
            data: {
                name: channelName,
                host: req.body.host
            }
        });

        res.redirect("/");
    } catch (err) {
        console.log(err);
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") res.status(400).send("Channel already exists for this host");
        else throw err;
    }
}

async function listChannels(req, res) {
    const channels = await prisma.channels.findMany({
        where: {
            host: req.query.host
        }
    });

    res.status(200).json(channels);
}


export const channelControllers = {
    registerChannel,
    listChannels
};
