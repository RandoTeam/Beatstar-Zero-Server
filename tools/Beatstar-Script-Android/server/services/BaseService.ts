import { Client } from "../Client.js";
import { Packet } from "../Packet.js";

export abstract class BaseService {
  abstract name: string;
  abstract handlePacket(packet: Packet, client: Client): Promise<void>;
}
