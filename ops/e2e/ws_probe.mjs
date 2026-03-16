#!/usr/bin/env node
import { io } from "socket.io-client";

function arg(name, def) {
    const i = process.argv.indexOf(name);
    return i >= 0 ? process.argv[i + 1] : def;
}

const url = arg("--url", "http://localhost:3001");
const seconds = Number(arg("--seconds", "15"));

let n = 0;
const samples = [];

function msFromIso(s) {
    const t = Date.parse(String(s || ""));
    return Number.isFinite(t) ? t : null;
}

const s = io(url, {
    transports: ["websocket"],
    timeout: 8000,
});

s.on("connect", () => {
    console.log("[ws] connected", s.id);
    s.emit("subscribeAll", {}, () => {});
});

s.on("connect_error", (e) => {
    console.log("[ws] connect_error", e?.message || e);
    process.exit(2);
});

s.on("alert", (a) => {
    n++;
    const now = Date.now();

    const createdAtMs = msFromIso(a?.createdAt);
    const txTsMs = msFromIso(a?.txTimestamp); // <- needs patch

    const alert_to_client = createdAtMs !== null ? (now - createdAtMs) : null;
    const tx_to_client = txTsMs !== null ? (now - txTsMs) : null;

    if (tx_to_client !== null) samples.push(tx_to_client);

    if (n % 20 === 0) {
        console.log("[ws] received", n, "tx_to_client_ms(last)", tx_to_client, "alert_to_client_ms(last)", alert_to_client);
    }
});

setTimeout(() => {
    s.disconnect();

    if (!samples.length) {
        console.log("[ws] no txTimestamp samples (patch missing or no alerts)");
        process.exit(0);
    }

    samples.sort((a,b)=>a-b);
    const p = (q) => samples[Math.min(samples.length-1, Math.floor(q * samples.length))];

    console.log("[ws] tx_to_client_ms count=", samples.length);
    console.log("[ws] p50=", p(0.50), "p90=", p(0.90), "p99=", p(0.99), "max=", samples[samples.length-1]);

    // enforce 2s SLA on p90 (better than single max)
    const ok = p(0.90) < 2000;
    console.log("[ws] SLA(p90<2000ms) =", ok ? "PASS" : "FAIL");
    process.exit(ok ? 0 : 1);
}, seconds * 1000);
