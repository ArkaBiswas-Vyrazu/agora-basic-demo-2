import Router from "express";
import { validators } from "../validators/validators.js";
import { validationResult } from "express-validator";
import { controllers } from "../controllers/controllers.js";
const agoraRouter = Router();

agoraRouter.post('/token/host/create', validators.agoraValidators.createHostTokenValidator, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) res.status(400).json(errors.array());

        await controllers.agoraControllers.createHostToken(req, res);
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

agoraRouter.post('/ncsNotify', async (req, res) => {
    await controllers.agoraControllers.notifyAudienceStatus(req, res);
})

export { agoraRouter };
