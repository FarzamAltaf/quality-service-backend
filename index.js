import express from "express";
import "dotenv/config";
import connectDB from "./configuration/database.js";
import morgan from "morgan";
import cors from "cors";
import UserRouter from "./routes/users.js";
import VisitorRouter from "./routes/visitors.js";
import configuration from "./configuration/index.js";
import AuthRouter from "./routes/auth.routes.js";
import cookieParser from "cookie-parser";
import ModuleRouter from "./routes/modules.js";
import DefaultsRouter from "./routes/defaults.js";
import RoleRouter from "./routes/roles.js";
import "./cronjobs/expiredToken.js";
import "./cronjobs/expireOtp.js";
import RoleManagementRouter from "./routes/roleManagement.js";
import ContactRouter from "./routes/contact.js";

const app = express();
connectDB();

app.use(morgan("tiny"));
app.use(express.json());
app.use(cookieParser());

const allowedOrigins = configuration.frontendUrl.split(",");

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    // origin: "http://localhost:5173/",
    methods: ["POST", "GET", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization", "uid", "x-requested-with"],
    credentials: true
}));

app.get('/', (req, res) => {
    res.status(200).json({
        name: "FA Internationals API",
        version: "1.0.0",
        modules: 1,
        status: "Running"
    });
});

app.use("/user", UserRouter);
app.use("/visitor", VisitorRouter);
app.use("/api/auth", AuthRouter);
app.use("/module", ModuleRouter);
app.use("/role", RoleRouter);
app.use("/defaults", DefaultsRouter);
app.use("/contact", ContactRouter);
app.use("/role-management", RoleManagementRouter);

//#region Self Ping
const SELF_URL = "https://quality-service-backend.onrender.com";

const pingSelf = async () => {
    try {
        const res = await axios.get(SELF_URL + "/");
        console.log("Self-ping successful:", new Date().toISOString());
    } catch (err) {
        console.error("Self-ping failed:", err.message);
    }
};

pingSelf();

setInterval(pingSelf, 10 * 60 * 1000);
//#endregion

app.listen(configuration.port, () => {
    console.log(`Server is listening on port: http://localhost:${configuration.port}`)
})