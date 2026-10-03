"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import SimulatorV2Experience from "@/app/simulator/SimulatorV2Experience";

export default function StandaloneTutorial({ initialDeckId, returnPath }) {
  const router = useRouter();
  const returnToInstructions = useCallback(() => {
    router.replace(returnPath);
  }, [returnPath, router]);

  return (
    <SimulatorV2Experience
      initialDeckId={initialDeckId}
      initialTutorial
      onExitTutorial={returnToInstructions}
    />
  );
}
