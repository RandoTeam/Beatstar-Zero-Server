import { AllInOneLoginReq } from "@externaladdress4401/beatstar-protobuf/protos/AllInOneLoginReq";
import { AllInOneLoginResp } from "@externaladdress4401/beatstar-protobuf/protos/AllInOneLoginResp";
import {
  createAllInOneLoginResp,
  createServerClientMessageHeader,
} from "@externaladdress4401/beatstar-protobuf/responses";
import { Client } from "../Client.js";
import { Packet } from "../Packet.js";
import { BaseService } from "./BaseService.js";
import { ProfileStore } from "../models/ProfileStore.js";
import Logger from "../../lib/Logger.js";

export class UserService extends BaseService {
  name = "userservice";

  async handlePacket(packet: Packet, client: Client) {
    let payload: any;
    try {
      payload = packet.parsePayload(AllInOneLoginReq);
    } catch (e: any) {
      Logger.log(`[UserService] Error parsing AllInOneLoginReq: ${e.message}`);
      return;
    }

    let cinta = payload?.reqAllInOneLogin?.cinta || "";
    cinta = cinta.trim();

    const profile = ProfileStore.getProfile();
    if (!cinta) {
      cinta = profile.uuid;
    }

    client.setUser(profile.id, cinta);
    Logger.log(`[UserService] Login successful for cinta: ${cinta}`);

    const response = await packet.buildResponse(
      createServerClientMessageHeader({}),
      createAllInOneLoginResp({
        "{clide}": cinta,
        "{cinta}": cinta,
        "{expiryTime}": Date.now() + 1000000000,
        "{authenticationTicket}":
          "VCS1axRWJeq4jFJdpI3RFfnaIPjAV3ksi8W3cc3VYedwSiQFozfoIZpRN663Tmn4oswsBRTRcz6r8E+aDLuhDzh6xg/vB0e6SqjD2fpd/N1oY/4ulGb8qQ4qc2cGwuS4dPAPnGFW1WjP7SZ3MRJI0WRo2iHbz5Qlg21ssolAo0MTDWYPh0dtYg==",
      }),
      AllInOneLoginResp
    );

    client.write(response);
  }
}
