import { freeRestarts } from "../hacks/freeRestarts.js";
import { noFail } from "../functions/noFail.js";
import { autoplay } from "../functions/autoplay.js";
import { forcePlayableSongs } from "../hacks/forcePlayableSongs.js";
import { hookOnDeviceBundles } from "../customs/hookOnDeviceBundles.js";
import { ignoreBundleHash } from "../customs/ignoreBundleHash.js";
import { hookRemoteBundles } from "../customs/hookRemoteBundles.js";
import { bypassTutorialBlock } from "../hacks/bypassTutorialBlock.js";

export const activateMod = () => {
  freeRestarts();
  noFail();
  autoplay();
  forcePlayableSongs();
  hookOnDeviceBundles();
  ignoreBundleHash();
  hookRemoteBundles();
  bypassTutorialBlock();
};
