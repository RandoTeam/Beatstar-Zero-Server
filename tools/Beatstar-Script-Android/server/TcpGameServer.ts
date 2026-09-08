import net from "net";
import { Client } from "./Client.js";
import { BaseService } from "./services/BaseService.js";
import { UserService } from "./services/UserService.js";
import { CMSService } from "./services/CMSService.js";
import { GameService } from "./services/GameService.js";
import { PingService } from "./services/PingService.js";
import {
  NotificationService,
  PaymentService,
  AnalyticsProxyService,
  ReadOnlyGameService,
  AnalyticsProxyServiceV2,
} from "./services/StubServices.js";
import { ClientServerMessageHeaderMap } from "@externaladdress4401/beatstar-protobuf/protos/ClientServerMessageHeader";
import Logger from "../lib/Logger.js";

export class TcpGameServer {
  private static server: net.Server | null = null;
  private static services: Map<string, BaseService> = new Map();
  private static clients: Map<net.Socket, Client> = new Map();

  static start(port: number = 3000): void {
    if (this.server) return;

    const servicesList: BaseService[] = [
      new UserService(),
      new CMSService(),
      new GameService(),
      new PingService(),
      new NotificationService(),
      new PaymentService(),
      new AnalyticsProxyService(),
      new ReadOnlyGameService(),
      new AnalyticsProxyServiceV2(),
    ];

    for (const s of servicesList) {
      this.services.set(s.name, s);
    }

    try {
      this.server = net.createServer((socket: net.Socket) => {
        Logger.log(`[TcpGameServer] New client connected from ${socket.remoteAddress}:${socket.remotePort}`);
        const client = new Client(socket);
        this.clients.set(socket, client);

        socket.on("data", async (data: Buffer) => {
          try {
            client.handlePacket(data);
            const packets = client.extractPackets();

            for (const packet of packets) {
              const header = packet.parseHeader(ClientServerMessageHeaderMap);
              const service = this.services.get(header.service);
              if (service) {
                await service.handlePacket(packet, client);
              } else {
                Logger.log(`[TcpGameServer] Warning: Unhandled service ${header.service}`);
              }
            }
            client.reset();
          } catch (err: any) {
            Logger.log(`[TcpGameServer] Packet error: ${err.message}`);
          }
        });

        socket.on("close", () => {
          this.clients.delete(socket);
        });

        socket.on("error", (err: Error) => {
          Logger.log(`[TcpGameServer] Socket error: ${err.message}`);
          this.clients.delete(socket);
        });
      });

      this.server.listen(port, "127.0.0.1", () => {
        Logger.log(`[TcpGameServer] SpaceApe Sharpla TCP server listening on 127.0.0.1:${port}`);
      });
    } catch (e: any) {
      Logger.log(`[TcpGameServer] Error starting TCP server: ${e.message}`);
    }
  }

  // A singleton client for direct memory bridging
  private static directClient: Client | null = null;

  static handleDirectPacket(data: Buffer, replyCallback: (responseBuffer: Buffer) => void) {
    if (!this.directClient) {
      // Initialize a single persistent direct client
      this.directClient = new Client(null, replyCallback);
    }
    // Update the callback in case it changes (e.g. new NetworkConnection instances)
    this.directClient.writeCallback = replyCallback;

    try {
      this.directClient.handlePacket(data);
      const packets = this.directClient.extractPackets();

      for (const packet of packets) {
        const header = packet.parseHeader(ClientServerMessageHeaderMap);
        const service = this.services.get(header.service);
        if (service) {
          // Process packets synchronously/asynchronously. The service calls client.write()
          // which will trigger replyCallback synchronously within this tick, or later if awaited.
          Logger.log(`[TcpGameServer] Dispatching packet to service: ${service.name}`);
          service.handlePacket(packet, this.directClient).catch((err: any) => {
            Logger.log(`[TcpGameServer] Service error in ${service.name}: ${err.message}`);
          });
        } else {
          Logger.log(`[TcpGameServer] Warning: Unhandled service ${header.service}`);
        }
      }
      this.directClient.reset();
    } catch (err: any) {
      Logger.log(`[TcpGameServer] Direct Packet error: ${err.message}`);
    }
  }
}
