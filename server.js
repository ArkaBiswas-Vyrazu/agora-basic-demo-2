import express from "express";
import { config } from "dotenv";
import { middlewares } from "./middlewares/middlewares.js";
import { routes } from "./routers/routers.js";
import path from "path";
import session from "express-session";
import passport from "passport";
config();

const app = express();
const HOSTNAME = process.env.HOSTNAME || "localhost";
const PORT = process.env.PORT || 5000;
let start_timestamp = 0;

app.use(express.json());
app.use(express.urlencoded());
app.use(express.static("public"));
for (const middleware of Object.keys(middlewares)) app.use(middlewares[middleware]);

app.set("views", path.join(import.meta.dirname, "views"));
app.set("view engine", "ejs");

app.use(session({ secret: process.env.SESSION_SECRET_KEY || "cats", saveUninitialized: false, resave: false }));
app.use(passport.initialize());
app.use(passport.session());

app.use("/user", routes.userRouter);
app.get("/", (req, res) => res.render("index", { user: req.user }));

app.use("*splat", async (req, res) => res.status(404).send("This path was not found"));
app.use(async (err, req, res, next) => {
    if (!err) {
        console.log(await err.toString());
        res.status(500).json(await err);
    } else return next();
})

app.listen(PORT, HOSTNAME, () => {
    start_timestamp = Date.now();
    console.log(`Server is running on host ${HOSTNAME} at port ${PORT}`);
});

process.on("SIGINT", () => {
    console.log(`\nServer Runtime Duration: ${Date.now() - start_timestamp}s`);
    process.exit();
});
