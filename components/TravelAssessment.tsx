"use client";

import { useState, useEffect } from "react";
import { QUESTIONS, scoreAssessment, AssessmentResult } from "@/lib/assessment";

interface Props {
  /** If provided, skips the name input on the result screen */
  prefilledName?: string;
  onComplete: (result: AssessmentResult, name: string) => void;
  onSkip: () => void;
}

type Phase = "questions" | "result";

export default function TravelAssessment({ prefilledName, onComplete, onSkip }: Props) {
  const [phase, setPhase] = useState<Phase>("questions");
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, "A" | "B">>({});
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [name, setName] = useState(prefilledName ?? "");
  const [animating, setAnimating] = useState(false);

  // Fade between questions
  const [visible, setVisible] = useState(true);

  function handleAnswer(choice: "A" | "B") {
    if (animating) return;
    const newAnswers = { ...answers, [idx]: choice };
    setAnswers(newAnswers);

    if (idx + 1 < QUESTIONS.length) {
      setVisible(false);
      setAnimating(true);
      setTimeout(() => {
        setIdx(idx + 1);
        setVisible(true);
        setAnimating(false);
      }, 180);
    } else {
      const r = scoreAssessment(newAnswers);
      setResult(r);
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

  function handleRetake() {
    setAnswers({});
    setIdx(0);
    setVisible(true);
    setAnimating(false);
    setResult(null);
    setPhase("questions");
  }

  function handleAccept() {
    if (!result) return;
    const finalName = name.trim() || prefilledName || "Traveler";
    onComplete(result, finalName);
  }

  const progress = Math.round(((idx) / QUESTIONS.length) * 100);
  const q = QUESTIONS[idx];

  // ── Result screen ────────────────────────────────────────────────────────────
  if (phase === "result" && result) {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="text-center px-6 pt-6 pb-4">
          <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Your travel style</p>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{result.name}</h2>
          <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">{result.tagline}</p>
        </div>

        {/* Description */}
        <div className="px-6 pb-4">
          <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed text-center">{result.description}</p>
        </div>

        {/* Top priorities */}
        <div className="px-6 pb-5">
          <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide text-center mb-3">What matters most to you</p>
          <div className="flex flex-col gap-2">
            {result.topAxes.map(({ axis, label }, i) => (
              <div
                key={axis}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-sm ${
                  i === 0
                    ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200"
                    : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  i === 0 ? "bg-blue-600 text-white" : "bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200"
                }`}>
                  {i + 1}
                </span>
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Name input (only if not pre-filled) */}
        {!prefilledName && (
          <div className="px-6 pb-4">
            <label className="block text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">
              What should we call you?
            </label>
            <input
              className="w-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-700 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAccept()}
              autoFocus
            />
          </div>
        )}

        {/* Actions */}
        <div className="px-6 pb-6 pt-1 flex flex-col gap-2 mt-auto">
          <button
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
            onClick={handleAccept}
            disabled={!prefilledName && !name.trim()}
          >
            This feels right — create my profile →
          </button>
          <div className="flex gap-3 justify-center">
            <button
              className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              onClick={handleRetake}
            >
              Retake assessment
            </button>
            <span className="text-gray-300 dark:text-gray-700">·</span>
            <button
              className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              onClick={onSkip}
            >
              Set up manually instead
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
          <span className="text-xs text-gray-400 dark:text-gray-500">
            Question {idx + 1} of {QUESTIONS.length}
          </span>
          <button
            className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            onClick={onSkip}
          >
            Skip →
          </button>
        </div>
        <div className="h-1 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div
        className="flex-1 flex flex-col justify-center px-6 pb-2"
        style={{ opacity: visible ? 1 : 0, transition: "opacity 0.18s ease" }}
      >
        <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-widest text-center mb-5">
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
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-100"
                    : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10"
                }`}
              >
                <span className={`text-[10px] font-bold uppercase tracking-wider mr-2 ${chosen ? "text-blue-500" : "text-gray-400 dark:text-gray-600"}`}>
                  {side}
                </span>
                {text}
              </button>
            );
          })}
        </div>
      </div>

      {/* Back / navigation */}
      <div className="px-6 pb-5 pt-2 flex justify-between items-center">
        <button
          className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-30"
          onClick={handleBack}
          disabled={idx === 0}
        >
          ← Back
        </button>
        <span className="text-xs text-gray-300 dark:text-gray-700 tabular-nums">
          {Object.keys(answers).length}/{QUESTIONS.length} answered
        </span>
      </div>
    </div>
  );
}
