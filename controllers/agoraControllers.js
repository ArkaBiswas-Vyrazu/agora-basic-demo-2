import pkg from "agora-token";
import { PrismaClient } from "../generated/prisma/client.js";
const { RtcTokenBuilder, RtcRole } = pkg;
import { generate } from "random-words";
import { events } from "../events.js";
const prisma = new PrismaClient();

async function createHostToken(req, res) {
    const channelName = req.body.channel || generate({ exactly: 3, formatter: (word) => word.toUpperCase() }).join("-");

    const channel = await prisma.channels.findFirst({
        where: {
            name: channelName,
            host: req.body.host
        }
    });

    if (!channel) {
        await prisma.channels.create({
            data: {
                name: channelName,
                host: req.body.host
            }
        });
    }

    const token = RtcTokenBuilder.buildTokenWithUid(
        process.env.AGORA_APP_ID,
        process.env.AGORA_APP_CERTIFICATE,
        channelName,
        req.body.host,
        RtcRole.PUBLISHER,
        600,
        600
    );

    res.status(200).json({host: req.body.host, channel: channelName, token});
}

async function createAudienceToken(req, res) {
    const token = RtcTokenBuilder.buildTokenWithUid(
        process.env.AGORA_APP_ID,
        process.env.AGORA_APP_CERTIFICATE,
        req.body.channel,
        req.body.user,
        RtcRole.SUBSCRIBER,
        600,
        600
    );

    res.status(200).json({user: req.body.user, channel: req.body.channel, token});
}

let status = null;
async function notifyAudienceStatus(req, res) {
    const headers = new Headers({
        "Keep-Alive": "timeout=10, max=100"
    });

    if (req.body.eventType !== status) {
        console.log("Status Right Now ===> ", status);
        status = await req.body.eventType;

        // WARNING: This can lead to an event leak.... should find alternate ways of doing this
        events.agoraAudienceJoinLeaveEvent.emit("agora-audience-joined-or-left", req.body);
    }

    res.setHeaders(headers);
    res.status(200).json({ status: true, msg: "Notification Received" });
}

async function handleAgoraAudienceEventStream(req, res) {
    console.log("Event was started");

    const headers = new Headers({
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
    });

    res.setHeaders(headers);

    // WARNING: This can lead to an event leak.... should find alternate ways of doing this
    events.agoraAudienceJoinLeaveEvent.on("agora-audience-joined-or-left", async (body) => {
        const user = await prisma.users.findFirst({
            where: {
                uuid: body.payload.account
            },
            select: {
                name: true
            }
        });

        res.write(`data: Audience Member ${user.name} ${(body.eventType == 105) ? "joined": "left"}\n\n`);
    });

    req.on("close", () => {
        console.log("Event was ended");
        res.end();
    });
}

export const agoraControllers = {
    createHostToken,
    createAudienceToken,
    notifyAudienceStatus,
    handleAgoraAudienceEventStream
}
