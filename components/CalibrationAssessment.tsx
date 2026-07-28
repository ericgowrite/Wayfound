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
  ctaLabel = "Save my style →",
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
        <p className="text-xs text-[#9BB0C1] dark:text-[#6B8299] uppercase tracking-widest text-center mb-5">
          Quick check
        </p>
        <h3 className="text-base font-semibold text-[#2C3E50] dark:text-white text-center mb-6 leading-snug">
          {SELF_AWARENESS_QUESTION.prompt}
        </h3>
        <div className="space-y-3 mb-8">
          {(["A", "B"] as const).map((side) => {
            const text = side === "A" ? SELF_AWARENESS_QUESTION.a : SELF_AWARENESS_QUESTION.b;
            return (
              <button
                key={side}
                onClick={() => handleSelfAwareness(side === "A")}
                className="w-full text-left px-4 py-4 rounded-xl border border-[#E0E8ED] dark:border-[#3D5A6E] bg-white dark:bg-[#2a3f52] text-[#3D5A6E] dark:text-[#B8D4E3] hover:border-[#5B8BA0] hover:bg-[#5B8BA0]/5 dark:hover:bg-[#5B8BA0]/8 transition-all text-sm leading-relaxed"
              >
                {text}
              </button>
            );
          })}
        </div>
        <div className="text-center">
          <button
            className="text-xs text-[#9BB0C1] dark:text-[#6B8299] hover:text-[#6B8299] dark:hover:text-[#B8D4E3] transition-colors"
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
      <div className="flex flex-col h-full justify-center px-6 py-10">
        <div className="text-center mb-6">
          <p className="text-xs text-[#E8A87C] uppercase tracking-widest font-semibold mb-2">
            {result.name}
          </p>
          {typeChanged ? (
            <>
              <h2 className="text-2xl font-bold text-[#2C3E50] dark:text-white mb-3 leading-snug">
                Actually, you&apos;re {result.name}.
              </h2>
              <p className="text-sm text-[#6B8299] dark:text-[#9BB0C1] leading-relaxed mb-1">
                {result.headline}
              </p>
              <p className="text-xs text-[#9BB0C1] dark:text-[#6B8299] leading-relaxed mt-3">
                {originalResult.name} was close — this is a better fit. ViyaWay will find things with that in mind.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-[#2C3E50] dark:text-white mb-3 leading-snug">
                Confirmed — you&apos;re {result.name}.
              </h2>
              <p className="text-sm text-[#6B8299] dark:text-[#9BB0C1] leading-relaxed mb-1">
                {result.headline}
              </p>
              <p className="text-xs text-[#9BB0C1] dark:text-[#6B8299] leading-relaxed mt-3">
                ViyaWay knows you a little better now.
              </p>
            </>
          )}
        </div>

        <div className="space-y-2">
          <button
            className="w-full py-2.5 bg-[#5B8BA0] hover:bg-[#4A7A8F] text-white text-sm font-medium rounded-xl transition-colors"
            onClick={handleAccept}
          >
            {ctaLabel}
          </button>
          <div className="text-center">
            <button
              className="text-xs text-[#9BB0C1] dark:text-[#6B8299] hover:text-[#6B8299] dark:hover:text-[#B8D4E3] transition-colors"
              onClick={onSkip}
            >
              {typeChanged ? "Keep my original style" : "Done"}
            </button>
          </div>
        </div>
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
          <p className="text-sm text-center text-[#5B8BA0] dark:text-[#7DBAD4] font-medium">
            {ackMessage}
          </p>
        ) : (
          <div style={{ opacity: visible ? 1 : 0, transition: "opacity 0.18s ease" }}>
            <p className="text-xs text-[#9BB0C1] dark:text-[#6B8299] uppercase tracking-widest text-center mb-5">
              Which resonates more?
            </p>
            <div className="space-y-3">
              {(["A", "B"] as const).map((side) => {
                const text = side === "A" ? q.a : q.b;
                const chosen = answers[idx] === side;
                return (
                  <button
                    key={side}
                    onClick={() => handleAnswer(side)}
                    disabled={animating}
                    className={`w-full text-left px-4 py-4 rounded-xl border transition-all text-sm leading-relaxed ${
                      chosen
                        ? "border-[#5B8BA0] bg-[#5B8BA0]/8 dark:bg-[#5B8BA0]/15 text-[#2C3E50] dark:text-[#B8D4E3]"
                        : "border-[#E0E8ED] dark:border-[#3D5A6E] bg-white dark:bg-[#2a3f52] text-[#3D5A6E] dark:text-[#B8D4E3] hover:border-[#5B8BA0] hover:bg-[#5B8BA0]/5 dark:hover:bg-[#5B8BA0]/8"
                    }`}
                  >
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider mr-2 ${
                        chosen ? "text-[#5B8BA0]" : "text-[#9BB0C1] dark:text-[#6B8299]"
                      }`}
                    >
                      {side}
                    </span>
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
