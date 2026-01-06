import { Server as IOServer, Socket } from "socket.io";
import {normalizeSeverity, RealtimeConfig } from "./config";

type SubscribePayload = {
    severities?: string[];
}

function roomForSeverity(cfg: RealtimeConfig, sev: string): string{
    return `${cfg.roomSeverityPrefix}${normalizeSeverity(sev)}`;
}

function currentSeverityRooms(cfg: RealtimeConfig, socket: Socket): string[] {
    const rooms: string[] = [];
    for(const r of socket.rooms.values()) {
        if (r.startsWith(cfg.roomSeverityPrefix)) rooms.push(r);
    }

    return rooms;
}

async function switchToAll(cfg: RealtimeConfig, socket: Socket): Promise<void> {
    for (const r of currentSeverityRooms(cfg, socket)){
        await socket.leave(r);
    }
    await socket.join(cfg.roomAll);
}

async function switchToSeverities(cfg: RealtimeConfig, socket: Socket, severities: string[]): Promise<string[]>{
    await socket.leave(cfg.roomAll);

    for(const r of currentSeverityRooms(cfg, socket)){
        await socket.leave(r);
    }

    const normalized = severities
        .map((s) => normalizeSeverity(s))
        .filter((s) => s.length > 0);

    const unique = Array.from(new Set(normalized));
    for(const sev of unique){
        await socket.join(roomForSeverity(cfg, sev));
    }

    if(unique.length === 0) {
        await socket.join(cfg.roomAll);
    }

    return unique;
}

export function configureSocketHandlers(io: IOServer, cfg: RealtimeConfig){
    io.use((socket, next) => {
        const count = io.engine.clientsCount || 0;
        if(count >= cfg.wsMaxClients) return next(new Error("server_full"));
        return next();
    });

    io.use((socket, next) => {
        if(!cfg.wsAuthToken) return next();

        const token = (socket.handshake.auth && (socket.handshake.auth as any).token) ||
            (socket.handshake.headers["authorization"] || "").toString().replace(/^Bearer\s+/i,"").trim();

        if(token && token === cfg.wsAuthToken) return next();
        return next(new Error("unauthorized"));
    });

    io.on("connection", (socket) => {
        void socket.join(cfg.roomAll);

        socket.emit("hello", {
            serverTime: new Date().toISOString(),
            mode: "all",
            wsMaxClients: cfg.wsMaxClients,
        });

        socket.on("subscribe", async (payload: SubscribePayload, ack?: (resp: any) => void) => {
            try{
                const severities = Array.isArray(payload?.severities) ? payload.severities : [];
                const joined = await switchToSeverities(cfg, socket, severities);

                const mode = joined.length ? "severity" : "all";
                ack?.({ok: true, mode, severities: joined});
            } catch (err: any){
                ack?.({ok: false, error: err?.message || "subscribe_failed"});
            }
        });

        socket.on("subscribeAll", async (_payload: any, ack?: (resp: any) => void) => {
            try{
                await switchToAll(cfg, socket);
                ack?.({ok: true, mode: "all"});
            } catch (err: any){
                ack?.({ok: false, error: err?.message || "subscribeAll_failed"});
            }
        });

        socket.on("disconnect", (reason) => {
           console.log(`[ws] disconnect id=${socket.id} reason=${reason}`);
        });

        console.log(`[ws] connect id=${socket.id} clients=${io.engine.clientsCount}`);

    });
}

export function emitAlert(io: IOServer, cfg: RealtimeConfig, alert: any): void {
    const sev = normalizeSeverity(alert?.severity);
    const payload = {
        ...alert,
        _rt: {
            ...(alert?._rt || {}),
            serverTs: Date.now(),
        },
    };
    io.to(cfg.roomAll).emit("alert", payload);
    io.to(roomForSeverity(cfg, sev)).emit("alert", payload);
}