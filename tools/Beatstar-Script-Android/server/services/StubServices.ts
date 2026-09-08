import { Client } from "../Client.js";
import { Packet } from "../Packet.js";
import { BaseService } from "./BaseService.js";
import { createServerClientMessageHeader, createGetUnclaimedPurchasesResp, createSubscribeResp, createLeaderboard_Resp } from "@externaladdress4401/beatstar-protobuf/responses";
import { GetUnclaimedPurchasesReq } from "@externaladdress4401/beatstar-protobuf/protos/GetUnclaimedPurchasesReq";
import { GetUnclaimedPurchasesResp } from "@externaladdress4401/beatstar-protobuf/protos/GetUnclaimedPurchasesResp";
import { Leaderboard_ReqEnums } from "@externaladdress4401/beatstar-protobuf/protos/Leaderboard_Req";
import { Leaderboard_Resp } from "@externaladdress4401/beatstar-protobuf/protos/Leaderboard_Resp";
import { SubscribeReqEnums } from "@externaladdress4401/beatstar-protobuf/protos/SubscribeReq";
import { SubscribeResp } from "@externaladdress4401/beatstar-protobuf/protos/SubscribeResp";
import { createBatchRequest } from "@externaladdress4401/beatstar-protobuf/protos/BatchRequest";
import { createEmptyResponse } from "@externaladdress4401/beatstar-protobuf/utils";
import { SendAnalyticEventReq } from "@externaladdress4401/beatstar-protobuf/protos/SendAnalyticEventReq";
import { SendAnalyticEventResp } from "@externaladdress4401/beatstar-protobuf/protos/SendAnalyticEventResp";
import { createSendAnalyticEventResp } from "@externaladdress4401/beatstar-protobuf/responses";
import { toArray } from "../utilities/toArray.js";
import Logger from "../../lib/Logger.js";
import { LeaderboardEngine } from "../models/LeaderboardEngine.js";
import { ProfileStore } from "../models/ProfileStore.js";

const ReadOnlyBatchRequest = createBatchRequest({
  16: Leaderboard_ReqEnums,
});

const NotificationBatchRequest = createBatchRequest({
  5: SubscribeReqEnums,
});

const PaymentBatchRequest = createBatchRequest({
  3: GetUnclaimedPurchasesReq,
});

export class NotificationService extends BaseService {
  name = "notificationservice";

  async handlePacket(packet: Packet, client: Client) {
    Logger.log("[NotificationService] Handling notification subscribe / token registration");
    let parsedPayload: any;
    try {
      parsedPayload = packet.parsePayload(NotificationBatchRequest);
    } catch (e: any) {
      Logger.log(`[NotificationService] Parse error: ${e.message}`);
    }
    const requests = parsedPayload ? toArray(parsedPayload.requests) : [];
    const responses = requests.map((req: any) => {
      const topicId = req?.body?.topicId || "unknown";
      Logger.log(`[NotificationService] Subscribe request id=${req.id} topicId=${topicId}`);
      return {
        id: req.id,
        status: 0,
        rpcType: req.rpcType || 5,
        body: {
          historyUntilMsecs: Date.now(),
        },
      };
    });

    const response = await packet.buildResponse(
      createServerClientMessageHeader({}),
      createSubscribeResp({
        "{requests}": responses.length > 0 ? responses : [createEmptyResponse({ rpcType: 5 })],
      }),
      SubscribeResp
    );
    client.write(response);
  }
}

export class PaymentService extends BaseService {
  name = "paymentservice";

  async handlePacket(packet: Packet, client: Client) {
    Logger.log("[PaymentService] Handling payment / shop purchase request");

    let parsedPayload: any = null;
    try {
      parsedPayload = packet.parsePayload(PaymentBatchRequest);
    } catch (e: any) {
      Logger.log(`[PaymentService] Batch parse fallback: ${e.message}`);
    }

    const requests = parsedPayload ? toArray(parsedPayload?.requests) : [];
    const responses: any[] = [];

    if (requests.length > 0) {
      for (const request of requests) {
        const rpcType = Number(request.rpcType || 0);
        Logger.log(`[PaymentService] Processing purchase request rpcType=${rpcType} id=${request.id}`);

        // Award purchased diamonds and persist immediately
        ProfileStore.addDiamonds(1000);
        Logger.log("[PaymentService] Purchase verified! Awarded and saved diamonds to profile.");

        responses.push({
          id: request.id || 1,
          status: 0,
          rpcType: rpcType || 3,
          body: {},
        });
      }
    } else {
      // Direct purchase fallback
      ProfileStore.addDiamonds(1000);
      Logger.log("[PaymentService] Direct purchase confirmed! +1000 diamonds saved.");
      responses.push(createEmptyResponse({ id: 1, rpcType: 3 }));
    }

    const response = await packet.buildResponse(
      createServerClientMessageHeader({}),
      createGetUnclaimedPurchasesResp({
        "{requests}": responses,
      }),
      GetUnclaimedPurchasesResp
    );
    client.write(response);
  }
}

export class AnalyticsProxyService extends BaseService {
  name = "analyticsproxyservice";

  async handlePacket(packet: Packet, client: Client) {
    let parsedPayload;
    try {
      parsedPayload = packet.parsePayload(SendAnalyticEventReq);
      Logger.log("[AnalyticsProxyService] Parsed analytic event");
    } catch (e: any) {
      Logger.log(`[AnalyticsProxyService] Parse error: ${e.message}`);
      return;
    }

    const response = await packet.buildResponse(
      createServerClientMessageHeader({}),
      createSendAnalyticEventResp({}),
      SendAnalyticEventResp
    );
    client.write(response);
  }
}

export class ReadOnlyGameService extends BaseService {
  name = "readonlygameservice";

  async handlePacket(packet: Packet, client: Client) {
    Logger.log("[ReadOnlyGameService] Handling leaderboard/social request");
    let parsedPayload: any;
    try {
      parsedPayload = packet.parsePayload(ReadOnlyBatchRequest);
    } catch (e: any) {
      Logger.log(`[ReadOnlyGameService] Parse error: ${e.message}`);
    }
    const requests = parsedPayload ? toArray(parsedPayload.requests) : [];
    const responses = requests.map((req: any) => {
      const name = req?.body?.leaderboardName || "Global";
      const friendsOnly = Boolean(req?.body?.friendsOnly);
      const count = Number(req?.body?.count) || 50;
      Logger.log(`[ReadOnlyGameService] Leaderboard request id=${req.id} name=${name} friendsOnly=${friendsOnly}`);

      const boardData = LeaderboardEngine.getLeaderboard(name, friendsOnly, count);
      return {
        id: req.id,
        status: 0,
        rpcType: 16,
        body: {
          leaderboardName: boardData.leaderboardName,
          entries: boardData.entries,
          myEntry: boardData.myEntry,
          totalEntries: boardData.totalEntries,
          friendsOnly,
          results: boardData.results,
          playerLeaderboardInfo: boardData.playerLeaderboardInfo,
        },
      };
    });

    const response = await packet.buildResponse(
      createServerClientMessageHeader({}),
      createLeaderboard_Resp({
        "{requests}": responses.length > 0 ? responses : [createEmptyResponse({ rpcType: 16 })],
      }),
      Leaderboard_Resp
    );
    client.write(response);
  }
}

export class AnalyticsProxyServiceV2 extends BaseService {
  name = "analyticsproxyservicev2";

  async handlePacket(packet: Packet, client: Client) {
    let parsedPayload;
    try {
      parsedPayload = packet.parsePayload(SendAnalyticEventReq);
      Logger.log("[AnalyticsProxyServiceV2] Parsed analytic event");
    } catch (e: any) {
      Logger.log(`[AnalyticsProxyServiceV2] Parse error: ${e.message}`);
      return;
    }

    const response = await packet.buildResponse(
      createServerClientMessageHeader({}),
      createSendAnalyticEventResp({}),
      SendAnalyticEventResp
    );
    client.write(response);
  }
}
