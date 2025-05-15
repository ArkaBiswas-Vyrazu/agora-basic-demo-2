import pkg from "agora-token";
import { PrismaClient } from "../generated/prisma/client.js";
const { RtcTokenBuilder, RtcRole, ChatTokenBuilder } = pkg;
import { generate } from "random-words";
import { events } from "../events.js";
import https from "https";
const prisma = new PrismaClient();

let pseudoUuids = [];

async function createHostToken(req, res) {
    const channelName = req.body.channel || generate({ exactly: 3, formatter: (word) => word.toUpperCase() }).join("-");

    const channel = await prisma.channels.findFirst({
        where: {
            name: channelName,
            host: parseInt(req.body.host)
        }
    });

    if (!channel && req.body.no_create !== true) {
        await prisma.channels.create({
            data: {
                name: channelName,
                host: parseInt(req.body.host)
            }
        });
    }

    let pseudoUuid = ("screen_token" in req.body && req.body.screen_token) ? Math.floor(Math.random() * 10000).toString() : null
    if (pseudoUuid) pseudoUuids.push(pseudoUuid);

    const token = RtcTokenBuilder.buildTokenWithUid(
        process.env.AGORA_APP_ID,
        process.env.AGORA_APP_CERTIFICATE,
        channelName,
        (pseudoUuid) ? pseudoUuid : parseInt(req.body.host),
        RtcRole.PUBLISHER,
        600,
        600
    );

    res.status(200).json({host: parseInt(req.body.host), channel: channelName, token, ...(pseudoUuid && {generated: pseudoUuid})});
}

async function createAudienceToken(req, res) {
    const token = RtcTokenBuilder.buildTokenWithUid(
        process.env.AGORA_APP_ID,
        process.env.AGORA_APP_CERTIFICATE,
        req.body.channel,
        parseInt(req.body.user),
        RtcRole.SUBSCRIBER,
        600,
        600
    );

    res.status(200).json({user: parseInt(req.body.user), channel: req.body.channel, token});
}

let status = null;
async function notifyAudienceStatus(req, res) {
    const headers = new Headers({
        "Keep-Alive": "timeout=10, max=100"
    });

    if (req.body.eventType !== status) {
        // console.log("Status Right Now ===> ", status);
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
                uuid: parseInt(body.payload.account)
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

async function checkScreenUid(req, res) {
    // console.log(req.query.uid, pseudoUuids, pseudoUuids.includes(req.query.uid));
    res.status(200).json({ status: pseudoUuids.includes(req.query.uid)});
}

async function getAgoraChatUserToken(req, res) {
    const token = ChatTokenBuilder.buildUserToken(
        process.env.AGORA_APP_ID,
        process.env.AGORA_APP_CERTIFICATE,
        req.body.user,
        parseInt(req.query.expireTimeInSeconds) || 3600
    );
    console.log(token);
    res.status(200).json({user: req.body.user, token});
}

async function getAgoraChatAppToken(req, res) {
    const token = ChatTokenBuilder.buildAppToken(
        process.env.AGORA_APP_ID,
        process.env.AGORA_APP_CERTIFICATE,
        parseInt(req.query.expireTimeInSeconds) || 3600
    );
    res.status(200).json({token});
}

async function createMediaPushConverter(req, res) {
    const postData = JSON.stringify({
        converter: {
            name: `${req.user.uuid}_channel_${req.body.channel}_stream_converter`,
            rawOptions: {
                rtcChannel: req.body.channel,
                rtcStreamUid: req.user.uuid
            },
            rtmpUrl: process.env.RTMP_URL + '/' + `${req.user.uuid}_${req.body.channel}`
        }
    })

    // NOTE: Region name can be - cn, ap, na, eu. Refer to Media Push docs
    const options = {
        hostname: "api.agora.io",
        path: `/ap/v1/projects/${process.env.AGORA_APP_ID}/rtmp-converters`,
        method: "POST",
        headers: {
            "Authorization": Buffer.from(process.env.AGORA_REST_API_KEY + ":" + process.env.AGORA_REST_API_SECRET).toString("base64"),
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(postData),
            "X-Request-ID": `${req.user.uuid}_channel_${req.body.channel}_stream`
        }
    }

    let data = '';
    const apiReq = https.request(options, (apiRes) => {
        console.log(`STATUS: ${apiRes.statusCode}`);
        console.log(`HEADERS: ${JSON.stringify(apiRes.headers)}`);
        apiRes.setEncoding("utf-8");
        apiRes.on('data', (chunk) => {
            process.stdout.write("DATA: ", chunk);
            data += chunk;
        });
        apiRes.on('end', () => {
            res.status(200).json(data);
        });
    });

    apiReq.write(postData);
    apiReq.end();
}

export const agoraControllers = {
    createHostToken,
    createAudienceToken,
    notifyAudienceStatus,
    handleAgoraAudienceEventStream,
    checkScreenUid,
    getAgoraChatUserToken,
    getAgoraChatAppToken,
    createMediaPushConverter
}
