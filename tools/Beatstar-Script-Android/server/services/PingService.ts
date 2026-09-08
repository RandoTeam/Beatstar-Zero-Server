import { ProtobufHandler } from "@externaladdress4401/beatstar-protobuf/ProtobufHandler";
import { ServerClientMessageHeaderMap } from "@externaladdress4401/beatstar-protobuf/protos/ServerClientMessageHeader";
import { createServerClientMessageHeader } from "@externaladdress4401/beatstar-protobuf/responses";
import { Client } from "../Client.js";
import { Packet } from "../Packet.js";
import { BaseService } from "./BaseService.js";

export class PingService extends BaseService {
  name = "ping";

  async handlePacket(packet: Packet, client: Client) {
    const response = await this.buildResponse(
      createServerClientMessageHeader({})
    );
    client.write(response);
  }

  private async buildResponse(headerFile: any): Promise<Buffer> {
    const headerJson = headerFile;

    headerJson.version = "1";
    headerJson.timestamp = Date.now();
    headerJson.tokenId = "ping";

    const preparedHeader = await new ProtobufHandler("WRITE").writeProto(
      headerJson,
      ServerClientMessageHeaderMap
    );

    const packetHandler = new ProtobufHandler("WRITE");
    packetHandler.writeIntBE(preparedHeader.length + 4);
    packetHandler.writeIntBE(preparedHeader.length);
    packetHandler.writeBuffer(preparedHeader);

    return packetHandler.getUsed();
  }
}
