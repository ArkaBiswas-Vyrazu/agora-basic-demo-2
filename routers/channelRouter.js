import Router from "express";
import { validationResult } from "express-validator";
import { validators } from "../validators/validators.js";
import { controllers } from "../controllers/controllers.js";
const channelRouter = Router();

channelRouter.post("/register", validators.channelValidators.registerChannelValidator, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) res.status(500).json(errors.array());
    else await controllers.channelControllers.registerChannel(req, res);
});

channelRouter.get("/list", validators.channelValidators.listChannelValidator, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) res.status(500).json(errors.array());
        else await controllers.channelControllers.listChannels(req, res);
    } catch(err) {
        console.log(err);
        res.status(500).send(err);
    }
});

export {channelRouter};
