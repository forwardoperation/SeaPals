"use client";

import AdventureGame from "../../../adventure/AdventureGame";
import { ADVENTURE_LOCAL_PREVIEW_ACCOUNT } from "../../../adventure/adventureLocalPreview.mjs";

export default function ReefboundLocalPlaytest() {
  return (
    <AdventureGame
      account={ADVENTURE_LOCAL_PREVIEW_ACCOUNT}
      localPreview
      onSignOut={() => window.location.assign("/dev/reefbound")}
    />
  );
}
