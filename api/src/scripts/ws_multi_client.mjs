import { io } from "socket.io-client";

function getArg(name, def = undefined) {
    const idx = process.argv.indexOf(`--${name}`);
    if (idx === -1) return def;
    const v = process.argv[idx + 1];
    return v === undefined ? def : v;
}

const url = getArg("url", "http://localhost:3001");
const token = getArg("token", "");
const clients = Math.max(1, Math.min(500, Number(getArg("clients", "15")) || 15));
const severitiesRaw = getArg("severities", ""); // e.g. "LOW,MEDIUM,HIGH"
const severities = severitiesRaw
    ? severitiesRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

let totalAlerts = 0;
let connected = 0;

const sockets = [];

for (let i = 0; i < clients; i++) {
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
        connected++;
        console.log(
            `[multi] client#${i} connected id=${socket.id} connected=${connected}/${clients}`
        );

        if (severities.length) {
            socket.emit("subscribe", { severities }, (ack) => {
                console.log(
                    `[multi] client#${i} subscribed severities=${severities.join(
                        ","
                    )} ack=${JSON.stringify(ack ?? null)}`
                );
            });
        }
    });

    socket.on("alert", (a) => {
        totalAlerts++;
        const rt = a && a._rt ? a._rt : {};
        const kafkaLagMs = rt.kafkaLagMs;

        // print first few, then sample every 50
        if (totalAlerts <= 5 || totalAlerts % 50 === 0) {
            console.log(
                `[multi] alert#${totalAlerts} id=${a?.alertId} sev=${a?.severity} kafkaLagMs=${kafkaLagMs} connected=${connected}/${clients}`
            );
        }
    });

    socket.on("connect_error", (err) => {
        console.error(`[multi] client#${i} connect_error:`, err?.message || err);
    });

    socket.on("disconnect", (reason) => {
        connected = Math.max(0, connected - 1);
        console.log(
            `[multi] client#${i} disconnected reason=${reason} connected=${connected}/${clients}`
        );
    });

    sockets.push(socket);
}

console.log(
    `[multi] started clients=${clients} url=${url} severities=${severities.join(",") || "ALL"}`
);

process.on("SIGINT", () => {
    console.log("[multi] closing...");
    for (const s of sockets) s.close();
    process.exit(0);
});
