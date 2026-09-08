import { createBatchRequest } from "@externaladdress4401/beatstar-protobuf/protos/BatchRequest";
import { GetCMSMetaInfoReq } from "@externaladdress4401/beatstar-protobuf/protos/GetCMSMetaInfoReq";
import { GetCMSMetaInfoResp } from "@externaladdress4401/beatstar-protobuf/protos/GetCMSMetaInfoResp";
import { PartialReq } from "@externaladdress4401/beatstar-protobuf/protos/reused/PartialReq";
import {
  createGetCMSMetaInfoResp,
  createServerClientMessageHeader,
} from "@externaladdress4401/beatstar-protobuf/responses";
import { Client } from "../Client.js";
import { Packet } from "../Packet.js";
import { BaseService } from "./BaseService.js";
import Logger from "../../lib/Logger.js";

const BatchRequest = createBatchRequest({
  1: GetCMSMetaInfoReq,
});

export const CMS_HASHES: Record<string, string> = {
  // IMPORTANT: These are MD5 hashes of DECOMPRESSED content, NOT of the .gz files.
  // The Beatstar client downloads .gz, decompresses, then hashes the raw bytes.
  AssetsPatchConfig: "e5ea44c2e921f34119460667a380be93",
  AudioConfig: "0c067c9d485d53d4bd40f71307db7942",
  FontFallbackConfig: "d2d397d25b820d894bdf4d6744e40d3d",
  GameConfig: "bbd51c2bc08035755c794cd31f2baf50",
  LangConfig: "4b88a6df6aa104e7be21b66b12f48919",
  LiveOpsCallingCardsConfig: "40fbbf75d29f1345814f36839426980d",
  LiveOpsEmojiConfig: "1bae085f81607940ac72df6be3974b78",
  LiveOpsLoadingScreenConfig: "8c8c39f292625ed69d1dc91bbaf16c27",
  LiveOpsProfileIconConfig: "94f70a6c2c6b2f63a97fb55c0bdb8425",
  LiveOpsTrackSkinConfig: "da37b8f0a089b8f92bc5b3968295b533",
  NotificationConfig: "cd61d74dce585cc31cd73dad485266ff",
  ScalingConfig: "31cbfb8d975f7af4b1d8ee560cc41be9",
  SongConfig: "a7111127e871bbff9a891ee725994d94",
};

export class CMSService extends BaseService {
  name = "cmsservice";

  async handlePacket(packet: Packet, client: Client) {
    let payload: any;
    try {
      payload = packet.parsePayload(BatchRequest);
    } catch (e: any) {
      Logger.log(`[CMSService] Parse error: ${e.message}`);
      return;
    }

    Logger.log("[CMSService] Handling GetCMSMetaInfo request");
    const serverUrl = "http://127.0.0.1:5000";

    const placeholders: Record<string, any> = {
      "{serverTime}": Date.now(),
    };

    for (const [key, hash] of Object.entries(CMS_HASHES)) {
      placeholders[`{${key}}`] = `${serverUrl}/cms/${key}.gz`;
      placeholders[`{${key}Checksum}`] = hash;
    }

    const response = await packet.buildResponse(
      createServerClientMessageHeader({}),
      createGetCMSMetaInfoResp(placeholders),
      GetCMSMetaInfoResp
    );

    client.write(response);
  }
}
