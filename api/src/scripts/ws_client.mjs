import { io } from "socket.io-client";

function getArg(name, def = undefined) {
    const idx = process.argv.indexOf(`--${name}`);
    if (idx === -1) return def;
    const v = process.argv[idx + 1];
    return v === undefined ? def : v;
}

const url = getArg("url", "http://localhost:3001");
const token = getArg("token", "");
const severitiesRaw = getArg("severities", ""); // e.g. "LOW,HIGH"
const severities = severitiesRaw
    ? severitiesRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

const socket = io(url, {
    transports: ["websocket"],
    auth: token ? { token } : {},
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 200,
    reconnectionDelayMax: 2000,
    timeout: 5000,
});

socket.on("connect", () => {
    console.log(`[client] connected id=${socket.id}`);
    if (severities.length) {
        socket.emit("subscribe", { severities }, (resp) => {
            console.log("[client] subscribe ack:", resp);
        });
    }
});

socket.on("hello", (msg) => {
    console.log("[client] hello:", msg);
});

socket.on("alert", (a) => {
    const rt = a && a._rt ? a._rt : {};
    const lag = rt.kafkaLagMs;
    console.log(`[client] alert severity=${a?.severity} alertId=${a?.alertId} kafkaLagMs=${lag}`);
});

socket.on("connect_error", (err) => {
    console.log("[client] connect_error:", err?.message || err);
});

socket.on("disconnect", (reason) => {
    console.log("[client] disconnected:", reason);
});
