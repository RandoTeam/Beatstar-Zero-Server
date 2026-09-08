import Logger from "../lib/Logger.js";


export const customServer = () => {
  try {
    const netImg = Il2Cpp.domain.assembly("SpaceApe.Network")?.image;
    if (netImg) {
      const epc = netImg.class("EndPointConfig");
      if (epc) {
        Logger.log("[customServer] Hooking EndPointConfig methods...");
        
        try {
          const mHost = epc.method("get_Host");
          if (mHost) {
            mHost.implementation = function () {
              return Il2Cpp.string("127.0.0.1");
            };
          }
        } catch (e) {}

        try {
          const mPort = epc.method("get_Port");
          if (mPort) {
            mPort.implementation = function () {
              return 3000;
            };
          }
        } catch (e) {}

        try {
          const mSsl = epc.method("get_UseSsl");
          if (mSsl) {
            mSsl.implementation = function () {
              return false;
            };
          }
        } catch (e) {}

        try {
          const mMock = epc.method("get_IsMock");
          if (mMock) {
            mMock.implementation = function () {
              try { this.field("host").value = Il2Cpp.string("127.0.0.1"); } catch(e) {}
              try { this.field("<Host>k__BackingField").value = Il2Cpp.string("127.0.0.1"); } catch(e) {}
              try { this.field("port").value = 3000; } catch(e) {}
              try { this.field("<Port>k__BackingField").value = 3000; } catch(e) {}
              try { this.field("useSsl").value = false; } catch(e) {}
              try { this.field("<UseSsl>k__BackingField").value = false; } catch(e) {}
              return false;
            };
          }
        } catch (e) {}
      }

      // Also hook NetworkConnection if available
      // Hook NetworkConnection for Direct Memory Bridge
      try {
        const netConn = netImg.class("com.spaceape.network.NetworkConnection") || netImg.class("NetworkConnection");
        if (netConn) {
          Logger.log("[customServer] Hooking NetworkConnection for Direct Memory Bridge...");
          
          // We let Connect() run normally to our local dummy TCP server (127.0.0.1:3000)
          // so the C# socket state is valid and doesn't throw exceptions.
          const connMethod = netConn.method("Connect");
          if (connMethod) {
            connMethod.implementation = function (...args: any[]) {
              Logger.log("[customServer] NetworkConnection.Connect called -> forcing 127.0.0.1:3000");
              return this.method("Connect").invoke(...args);
            };
          }
          
          // Intercept Send to bypass local TCP overhead and Frida event loop deadlocks
          const sendMethod = netConn.method("Send");
          if (sendMethod) {
            sendMethod.implementation = function (payloadArg: any) {
              try {
                // payloadArg is Il2Cpp.Array (System.Byte[])
                const payloadArray = new Il2Cpp.Array(payloadArg);
                const len = payloadArray.length;
                // Buffer is required directly here to prevent esbuild aliasing collisions
                const { Buffer: BufClass } = require("buffer");
                const buffer = BufClass.alloc(len);
                for (let i = 0; i < len; i++) {
                  buffer[i] = payloadArray.get(i) as number;
                }
                Logger.log(`[customServer] NetworkConnection.Send intercepted! Size: ${buffer.length} bytes`);
                
                // Directly pass to our offline server instance (TcpGameServer will now act as a router)
                // We will add a static handleDirectPacket method to TcpGameServer.
                const TcpGameServerModule = require("../server/TcpGameServer");
                
                if (TcpGameServerModule && TcpGameServerModule.TcpGameServer) {
                  // handleDirectPacket should synchronously or asynchronously process the buffer
                  // and return a Buffer (or array of Buffers) to inject back.
                  TcpGameServerModule.TcpGameServer.handleDirectPacket(buffer, (responseBuffer: Buffer) => {
                     // Inject the response directly into the C# ReceivedQueue
                     try {
                       const receivedQueue = this.field("ReceivedQueue").value;
                       if (!receivedQueue.isNull()) {
                         const il2cppResponse = Il2Cpp.array(Il2Cpp.corlib.class("System.Byte"), responseBuffer.length - 4);
                         for (let i = 0; i < responseBuffer.length - 4; i++) {
                           il2cppResponse.set(i, responseBuffer[i + 4]);
                         }
                         receivedQueue.method("Enqueue").invoke(il2cppResponse);
                         Logger.log(`[customServer] Injected response of ${responseBuffer.length} bytes into ReceivedQueue`);
                       }
                     } catch (err: any) {
                       Logger.log(`[customServer] Error injecting response: ${err.message}`);
                     }
                  });
                }
                
                // Return a completed Task so the game thinks Send succeeded
                const TaskClass = Il2Cpp.corlib.class("System.Threading.Tasks.Task");
                const completedTaskMethod = TaskClass.method("get_CompletedTask");
                if (completedTaskMethod) {
                  return completedTaskMethod.invoke();
                }
              } catch (e: any) {
                Logger.log(`[customServer] Send hook error: ${e.message}`);
              }
              // Fallback to original send if hook fails
              return this.method("Send").invoke(payloadArg);
            };
          }
        }
      } catch (e) {}
    }

    // LoginPicker.Mock() was removed — it bypasses TCP entirely.
    // EndPointConfig hooks above already redirect to 127.0.0.1:3000.
    Logger.log("[customServer] EndPointConfig hooked to 127.0.0.1:3000 (no Mock).");
  } catch (e: any) {
    Logger.log(`[customServer] Exception: ${e.message}`);
  }
};
