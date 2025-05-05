import Router from "express";
import { validators } from "../validators/validators.js";
import { validationResult } from "express-validator";
import { controllers } from "../controllers/controllers.js";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { PrismaClient } from "../generated/prisma/client.js";
import bcrypt from "bcryptjs";
import path from "path";

const userRouter = Router();
const prisma = new PrismaClient();

userRouter.set("views", path.join(import.meta.dirname, "..", "views"));
userRouter.set("view engine", "ejs");

passport.use(new LocalStrategy(async (username, password, done) => {
    try {
        const user = await prisma.users.findFirst({
            where: {
                name: username
            }
        });

        if (!user) return done(null, false, { message: "Username and/or password does not exist" });
        if (!await bcrypt.compare(password, user.password)) return done(null, false, { message: "Username and/or password does not exist" });

        return done(null, user);
    } catch (err) {
        return done(err);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.uuid);
});

passport.deserializeUser(async (uuid, done) => {
    try {
        const user = await prisma.users.findFirst({
            where: {
                uuid: uuid
            }
        });

        if (!user) return done(null, false, { message: "User was not found, try logging in again" });
        return done(null, user);
    } catch (err) {
        return done(err);
    }
});

userRouter.get("/login", (req, res) => res.render("login"));
userRouter.post("/login", passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/user/login"
}));

userRouter.get("/logout", async (req, res, next) => {
    req.logOut((err) => {
        if (err) return next(err);

        res.redirect("/");
    })
});

userRouter.get("/register", (req, res) => res.render("sign-up-form"));
userRouter.post("/register", validators.userValidators.registerUserValidator, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) res.status(400).json(errors.array());

    await controllers.userControllers.registerUser(req, res);
});

userRouter.get("/list", async (req, res) => {
    await controllers.userControllers.listUsers(req, res);
});

userRouter.get("/logged_in", (req, res) => {
    res.status(200).json(req.user);
});

export { userRouter };
