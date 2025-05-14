import Router from "express";
import { validators } from "../validators/validators.js";
import { validationResult } from "express-validator";
import { controllers } from "../controllers/controllers.js";
import fetch from "node-fetch";
const agoraRouter = Router();

agoraRouter.post('/token/host/create', validators.agoraValidators.createHostTokenValidator, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) res.status(400).json(errors.array());
        else await controllers.agoraControllers.createHostToken(req, res);
    } catch (err) {
        console.log(err);
        res.status(500).send(err);
    }
});

agoraRouter.post('/token/audience/create', validators.agoraValidators.createAudienceTokenValidator, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) res.status(400).json(errors.array());
        else await controllers.agoraControllers.createAudienceToken(req, res);
    } catch (err) {
        console.log(err);
        res.status(500).json(err);
    }
});

agoraRouter.post('/chat/token/create/user', validators.agoraValidators.createAgoraChatUserTokenValidator, async (req, res) => {
    console.log(req.body);
    const errors = validationResult(req);
    console.log(errors);
    if (!errors.isEmpty()) res.status(400).json(errors.array());
    else await controllers.agoraControllers.getAgoraChatUserToken(req, res);
});

agoraRouter.post('/chat/token/create/app', validators.agoraValidators.createAgoraChatAppTokenValidator, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) res.status(400).json(errors.array());
    else await controllers.agoraControllers.getAgoraChatAppToken(req, res);
});

agoraRouter.post('/chat/register/user', async (req, res) => {
    // DEV-NOTE: This works in browser console, in node REPL, and in Postman. Why doesn't it work here?!!!!!!!!!!!

    const url = `https://${process.env.AGORA_CHAT_HOST}/${process.env.AGORA_CHAT_ORG_NAME}/${process.env.AGORA_CHAT_APP_KEY}/users`
    console.log(req.body.token);
    const options = {
        method: "POST",
        headers: {
            Authorization: "Bearer " + req.body.token.trim(),
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        body: JSON.stringify({ username: req.body.username })
    }

    console.log(options);
    let registerResponse = await fetch(url, options)
        .then(response => response.json())
        .then(data => data);
    console.log(registerResponse);
    res.status(200).json(registerResponse);
});

agoraRouter.post('/ncsNotify', async (req, res) => {
    await controllers.agoraControllers.notifyAudienceStatus(req, res);
});

agoraRouter.get("/events", async (req, res) => {
    await controllers.agoraControllers.handleAgoraAudienceEventStream(req, res);
});

agoraRouter.get("/screen/check", async (req, res) => {
    await controllers.agoraControllers.checkScreenUid(req, res);
});

export { agoraRouter };
