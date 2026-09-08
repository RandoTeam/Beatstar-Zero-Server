import net from "net";
import { Packet } from "./Packet.js";
import { ProtobufHandler } from "@externaladdress4401/beatstar-protobuf/ProtobufHandler";
import Logger from "../lib/Logger.js";
import { Buffer } from "buffer";

export class Client {
  buffer: Buffer = Buffer.alloc(0);
  packet: Packet | null = null;
  socket: net.Socket | null;
  writeCallback?: (buffer: Buffer) => void;
  
  user: { id: number | null; clide: string | null } = {
    id: null,
    clide: null,
  };

  constructor(socket: net.Socket | null, writeCallback?: (buffer: Buffer) => void) {
    this.socket = socket;
    this.writeCallback = writeCallback;
  }

  setUser(id: number | undefined, clide: string) {
    if (id !== undefined && clide !== "") {
      this.user = { id, clide };
    }
  }

  handlePacket(data: Buffer) {
    this.buffer = Buffer.concat([this.buffer, data]);
  }

  extractPackets(): Packet[] {
    const packets: Packet[] = [];
    while (true) {
      const handler = new ProtobufHandler("READ", this.buffer);
      if (!handler.hasMore()) {
        break;
      }
      if (handler.buffer.length < 4) {
        break;
      }
      const length = handler.readIntBE() + 4;
      if (handler.buffer.length >= length) {
        handler.index -= 4;
        packets.push(new Packet(handler.slice(length)));
        this.buffer = this.buffer.subarray(length);
      } else {
        break;
      }
    }
    return packets;
  }

  reset() {
    this.packet = null;
  }

  write(buffer: Buffer) {
    if (this.writeCallback) {
      this.writeCallback(buffer);
    } else if (this.socket) {
      this.socket.write(buffer);
    }
  }

  hasUserId(): boolean {
    return !!this.user.id;
  }
}
