"use client";

import { useEffect } from "react";
import { useRive, useStateMachineInput, Layout, Fit } from "@rive-app/react-canvas";

export type AvatarState = "idle" | "listening" | "thinking" | "talking";
export type Reaction = "impressed" | "skeptical" | "encouraging" | null;

/**
 * Wraps the Rive character (public/avatar.riv).
 *
 * Inputs on "State Machine 1" (discovered by inspecting the .riv):
 *   - Hear  (boolean)  — character listens (cups ear)
 *   - Talk  (boolean)  — character speaks (mouth animates)
 *   - Look  (number)   — gaze direction / variant
 *   - Check (trigger)  — fires a reaction
 *
 * We map our high-level state → these inputs.
 * For lip sync, the Talk state contains a built-in mouth animation.
 * For more accurate sync, you can wire AudioContext analyser amplitude
 * to a custom number input (e.g. "mouth_open") — see commented hook below.
 */
export default function InterviewerAvatar({
  state,
  reaction,
}: {
  state: AvatarState;
  reaction: Reaction;
}) {
  const { rive, RiveComponent } = useRive({
    src: "/avatar.riv",
    stateMachines: "State Machine 1",
    autoplay: true,
    layout: new Layout({ fit: Fit.Contain }),
  });

  const hearInput = useStateMachineInput(rive, "State Machine 1", "Hear");
  const talkInput = useStateMachineInput(rive, "State Machine 1", "Talk");
  const lookInput = useStateMachineInput(rive, "State Machine 1", "Look");
  const checkInput = useStateMachineInput(rive, "State Machine 1", "Check");

  // Map abstract state → Rive boolean inputs
  useEffect(() => {
    if (!hearInput || !talkInput) return;
    hearInput.value = state === "listening";
    talkInput.value = state === "talking";
  }, [state, hearInput, talkInput]);

  // Map reactions → Look direction + Check trigger
  useEffect(() => {
    if (!reaction || !lookInput) return;
    const lookValue =
      reaction === "impressed" ? 1 :
      reaction === "skeptical" ? 2 :
      reaction === "encouraging" ? 3 :
      0;
    lookInput.value = lookValue;
    checkInput?.fire();
    // Reset look after a beat
    const t = setTimeout(() => {
      if (lookInput) lookInput.value = 0;
    }, 1500);
    return () => clearTimeout(t);
  }, [reaction, lookInput, checkInput]);

  return (
    <div className="aspect-square w-full">
      <RiveComponent />
    </div>
  );
}
