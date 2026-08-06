"use client";

import { useState } from "react";
import { AssessmentResult, AssessmentQuestion } from "@/lib/assessment";
import {
  FRESH_CALIBRATION_QUESTIONS,
  SELF_AWARENESS_QUESTION,
  getWingCalibrationQuestions,
  scoreFreshCalibration,
  scoreWingCalibration,
} from "@/lib/typeCalibration";

interface Props {
  calibrationPath: "wing" | "fresh";
  originalResult: AssessmentResult;
  runnerUpType?: number; // required for Path A
  onComplete: (
    newResult: AssessmentResult,
    meta: { answeredAspirrationally: boolean }
  ) => void;
  onSkip: () => void;
  ctaLabel?: string;
}

type Phase = "self_awareness" | "questions" | "result";

const ACK_MESSAGES = ["Good to know.", "Makes sense.", "Got it.", "Noted."];

export default function CalibrationAssessment({
  calibrationPath,
  originalResult,
  runnerUpType,
  onComplete,
  onSkip,
  ctaLabel,
}: Props) {
  // Path A: wing questions for the original ↔ runner-up pairing.
  // Path B: full fresh question set.
  const questions: AssessmentQuestion[] =
    calibrationPath === "wing" && runnerUpType !== undefined
      ? getWingCalibrationQuestions(originalResult.type, runnerUpType)
      : FRESH_CALIBRATION_QUESTIONS;

  // Graceful fallback when Path A bank is empty (not yet written).
  const wingBankEmpty = calibrationPath === "wing" && questions.length === 0;

  // Path B always starts with self-awareness; Path A goes straight to questions.
  const [phase, setPhase] = useState<Phase>(
    calibrationPath === "fresh" ? "self_awareness" : "questions"
  );
  const [selfAwarenessHonest, setSelfAwarenessHonest] = useState(true);
  const [answers, setAnswers] = useState<Record<number, "A" | "B">>({});
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [idx, setIdx] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [visible, setVisible] = useState(true);
  const [ackMessage, setAckMessage] = useState<string | null>(null);

  function handleSelfAwareness(honest: boolean) {
    setSelfAwarenessHonest(honest);
    setPhase("questions");
  }

  function handleAnswer(choice: "A" | "B") {
    if (animating) return;
    const newAnswers = { ...answers, [idx]: choice };
    setAnswers(newAnswers);

    if (idx + 1 < questions.length) {
      const ack = ACK_MESSAGES[Math.floor(Math.random() * ACK_MESSAGES.length)];
      setAckMessage(ack);
      setAnimating(true);
      setTimeout(() => {
        setAckMessage(null);
        setVisible(false);
        setTimeout(() => {
          setIdx(idx + 1);
          setVisible(true);
          setAnimating(false);
        }, 180);
      }, 800);
    } else {
      const scored =
        calibrationPath === "wing"
          ? scoreWingCalibration(originalResult, newAnswers, questions)
          : scoreFreshCalibration(originalResult, newAnswers, selfAwarenessHonest);
      setResult(scored);
      setPhase("result");
    }
  }

  function handleBack() {
    if (idx === 0) return;
    setVisible(false);
    setAnimating(true);
    setTimeout(() => {
      setIdx(idx - 1);
      setVisible(true);
      setAnimating(false);
    }, 180);
  }

  function handleAccept() {
    if (!result) return;
    onComplete(result, { answeredAspirrationally: !selfAwarenessHonest });
  }

  const progress = Math.round((idx / questions.length) * 100);
  const q = questions[idx];
  const typeChanged = result ? result.type !== originalResult.type : false;

  // ── Wing bank empty fallback ─────────────────────────────────────────────────
  if (wingBankEmpty) {
    return (
      <div className="flex flex-col h-full justify-center px-6 py-10 text-center">
        <p className="text-sm font-semibold text-[#2C3E50] dark:text-white mb-2">
          Wing calibration coming soon
        </p>
        <p className="text-sm text-[#6B8299] dark:text-[#9BB0C1] leading-relaxed mb-6">
          Detailed wing questions are being written. In the meantime, try the 9-question style refresh for a more accurate result.
        </p>
        <button
          className="w-full py-2.5 bg-[#5B8BA0] hover:bg-[#4A7A8F] text-white text-sm font-medium rounded-xl transition-colors"
          onClick={onSkip}
        >
          Maybe later
        </button>
      </div>
    );
  }

  // ── Self-awareness question ──────────────────────────────────────────────────
  if (phase === "self_awareness") {
    return (
      <div className="flex flex-col h-full justify-center px-6 py-10">
        <p
          className="font-medium text-[#2C3E50] text-center mb-8"
          style={{ fontFamily: 'var(--font-lora, "Lora", Georgia, serif)', fontSize: 20, lineHeight: 1.4 }}
        >
          {SELF_AWARENESS_QUESTION.prompt}
        </p>
        <div className="flex flex-col gap-2.5 mb-8">
          {(["A", "B"] as const).map((side) => {
            const text = side === "A" ? SELF_AWARENESS_QUESTION.a : SELF_AWARENESS_QUESTION.b;
            return (
              <button
                key={side}
                onClick={() => handleSelfAwareness(side === "A")}
                className="w-full text-left text-sm text-[#1A1A1A] transition-all"
                style={{ border: "1px solid #2C3E50", borderRadius: 4, padding: "18px 20px", background: "transparent", lineHeight: 1.55 }}
              >
                {text}
              </button>
            );
          })}
        </div>
        <div className="text-center">
          <button
            className="text-xs text-[#888888] underline"
            onClick={onSkip}
          >
            Skip for now
          </button>
        </div>
      </div>
    );
  }

  // ── Result screen ────────────────────────────────────────────────────────────
  if (phase === "result" && result) {
    return (
      <div className="flex flex-col h-full justify-center px-6 py-10 text-center">
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#C4956A", marginBottom: 10 }}>
          {result.tagline}
        </p>
        {typeChanged ? (
          <>
            <p style={{ fontFamily: 'var(--font-lora, "Lora", Georgia, serif)', fontSize: 26, fontWeight: 500, color: "#2C3E50", lineHeight: 1.3, marginBottom: 10 }}>
              Actually, you&apos;re {result.name}.
            </p>
            <p style={{ fontSize: 14, color: "#888888", lineHeight: 1.6, marginBottom: 6 }}>
              {result.tagline}
            </p>
            <p style={{ fontSize: 13, color: "#888888", lineHeight: 1.6, marginBottom: 28 }}>
              {originalResult.name} was close. Here&apos;s what this means for how Wayfound finds things for you.
            </p>
          </>
        ) : (
          <>
            <p style={{ fontFamily: 'var(--font-lora, "Lora", Georgia, serif)', fontSize: 26, fontWeight: 500, color: "#2C3E50", lineHeight: 1.3, marginBottom: 10 }}>
              Confirmed — you&apos;re {result.name}.
            </p>
            <p style={{ fontSize: 14, color: "#888888", lineHeight: 1.6, marginBottom: 6 }}>
              {result.tagline}
            </p>
            <p style={{ fontSize: 13, color: "#888888", lineHeight: 1.6, marginBottom: 28 }}>
              Wayfound knows you a little better now.
            </p>
          </>
        )}

        <button
          className="w-full text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: "#2C3E50", borderRadius: 999, padding: "14px 20px", border: "none", cursor: "pointer", marginBottom: 12 }}
          onClick={handleAccept}
        >
          {ctaLabel ?? (typeChanged ? "Start discovering →" : "Back to discovering →")}
        </button>
        <button
          className="text-xs text-[#888888] underline"
          onClick={onSkip}
        >
          {typeChanged ? "Keep my original style" : "Done"}
        </button>
      </div>
    );
  }

  // ── Questions screen ─────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Progress */}
      <div className="px-6 pt-5 pb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-[#9BB0C1] dark:text-[#6B8299]">
            Question {idx + 1} of {questions.length}
          </span>
          <button
            className="text-xs text-[#9BB0C1] dark:text-[#6B8299] hover:text-[#6B8299] dark:hover:text-[#B8D4E3] transition-colors"
            onClick={onSkip}
          >
            Skip →
          </button>
        </div>
        <div className="h-1 bg-[#E0E8ED] dark:bg-[#2a3f52] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#E8A87C] rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="flex-1 flex flex-col justify-center px-6 pb-2">
        {ackMessage ? (
          <p className="text-sm text-center font-medium" style={{ color: "#888888" }}>
            {ackMessage}
          </p>
        ) : (
          <div style={{ opacity: visible ? 1 : 0, transition: "opacity 0.18s ease" }}>
            <p
              className="font-medium text-[#2C3E50] mb-8 text-center"
              style={{ fontFamily: 'var(--font-lora, "Lora", Georgia, serif)', fontSize: 22, lineHeight: 1.4 }}
            >
              {q.setup}
            </p>
            <div className="flex flex-col gap-2.5">
              {(["A", "B"] as const).map((side) => {
                const text = side === "A" ? q.a : q.b;
                const chosen = answers[idx] === side;
                return (
                  <button
                    key={side}
                    onClick={() => handleAnswer(side)}
                    disabled={animating}
                    className="w-full text-left text-sm text-[#1A1A1A] transition-all"
                    style={{
                      border: `1px solid ${chosen ? "#C4956A" : "#2C3E50"}`,
                      borderRadius: 4,
                      padding: "18px 20px",
                      background: chosen ? "#FBF4EC" : "transparent",
                      lineHeight: 1.55,
                    }}
                  >
                    {text}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Back */}
      <div className="px-6 pb-5 pt-2 flex justify-between items-center">
        <button
          className="text-xs text-[#9BB0C1] dark:text-[#6B8299] hover:text-[#6B8299] dark:hover:text-[#B8D4E3] transition-colors disabled:opacity-30"
          onClick={handleBack}
          disabled={idx === 0 || animating}
        >
          ← Back
        </button>
        <span className="text-xs text-[#B8D4E3] dark:text-[#3D5A6E] tabular-nums">
          {Object.keys(answers).length}/{questions.length} answered
        </span>
      </div>
    </div>
  );
}
