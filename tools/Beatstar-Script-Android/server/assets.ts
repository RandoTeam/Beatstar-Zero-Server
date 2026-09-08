import { HttpAssetServer } from "./HttpAssetServer.js";

export const startAssetServer = () => {
  HttpAssetServer.start(5000);
};
