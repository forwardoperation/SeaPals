"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Simulator from "@/app/simulator/Simulator";

export default function StandaloneTutorial({ storyModeData, returnPath, previewExperience = false }) {
  const router = useRouter();
  const returnToInstructions = useCallback(() => {
    router.replace(returnPath);
  }, [returnPath, router]);
  const storyMode = useMemo(
    () => ({ ...storyModeData, onExit: returnToInstructions }),
    [returnToInstructions, storyModeData],
  );

  return <Simulator storyMode={storyMode} previewExperience={previewExperience} />;
}
