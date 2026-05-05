"use client";

import { useState } from "react";
import { QUESTIONS, scoreAssessment, AssessmentResult, getArchetypeForType, getTopAxes } from "@/lib/assessment";

interface Props {
  prefilledName?: string;
  onComplete: (result: AssessmentResult, name: string) => void;
  onSkip: () => void;
}

type Phase = "questions" | "result" | "alternatives";

const CONFIDENCE_LABEL = {
  high:   { text: "Strong match",        color: "text-green-600 dark:text-green-400" },
  medium: { text: "Good match",          color: "text-yellow-600 dark:text-yellow-400" },
  low:    { text: "Close call — see alternatives", color: "text-orange-600 dark:text-orange-400" },
};

export default function TravelAssessment({ prefilledName, onComplete, onSkip }: Props) {
  const [phase, setPhase] = useState<Phase>("questions");
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, "A" | "B">>({});
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [activeType, setActiveType] = useState<number | null>(null); // overrides result.type
  const [name, setName] = useState(prefilledName ?? "");
  const [animating, setAnimating] = useState(false);
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
      setActiveType(r.type);
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
    setActiveType(null);
    setPhase("questions");
  }

  function handleAccept() {
    if (!result || activeType === null) return;
    const finalName = name.trim() || prefilledName || "Traveler";
    // If user picked an alternative type, synthesise a result for that type
    if (activeType !== result.type) {
      const alt = getArchetypeForType(activeType);
      const altResult: AssessmentResult = {
        ...alt,
        typeScores: result.typeScores,
        topAxes: getTopAxes(alt.axisWeights),
        confidence: result.confidence,
        runnerUpTypes: result.runnerUpTypes,
      };
      onComplete(altResult, finalName);
    } else {
      onComplete(result, finalName);
    }
  }

  const progress = Math.round((idx / QUESTIONS.length) * 100);
  const q = QUESTIONS[idx];

  // ── Alternatives screen ──────────────────────────────────────────────────────
  if (phase === "alternatives" && result) {
    const topThree = [result.type, ...result.runnerUpTypes].slice(0, 3);
    return (
      <div className="flex flex-col h-full">
        <div className="px-6 pt-5 pb-3">
          <button
            className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors mb-3"
            onClick={() => setPhase("result")}
          >
            ← Back
          </button>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Your top results</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Pick the one that feels most like you.</p>
        </div>

        <div className="flex-1 px-6 pb-4 space-y-3 overflow-auto">
          {topThree.map((type) => {
            const arch = getArchetypeForType(type);
            const score = result.typeScores[type];
            const isSelected = activeType === type;
            return (
              <button
                key={type}
                onClick={() => setActiveType(type)}
                className={`w-full text-left px-4 py-4 rounded-xl border transition-all ${
                  isSelected
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                    : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300 dark:hover:border-blue-700"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${isSelected ? "text-blue-900 dark:text-blue-100" : "text-gray-900 dark:text-white"}`}>
                      {arch.name}
                    </p>
                    <p className={`text-xs mt-0.5 ${isSelected ? "text-blue-700 dark:text-blue-300" : "text-gray-500 dark:text-gray-400"}`}>
                      {arch.tagline}
                    </p>
                    <p className={`text-xs mt-2 leading-relaxed line-clamp-2 ${isSelected ? "text-blue-800 dark:text-blue-200" : "text-gray-600 dark:text-gray-400"}`}>
                      {arch.description}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className={`text-lg font-bold tabular-nums ${isSelected ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-600"}`}>
                      {score}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-600">pts</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="px-6 pb-6 space-y-2">
          <button
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors"
            onClick={() => setPhase("result")}
          >
            Use selected style →
          </button>
          <div className="text-center">
            <button
              className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              onClick={handleRetake}
            >
              Retake assessment
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Result screen ────────────────────────────────────────────────────────────
  if (phase === "result" && result && activeType !== null) {
    const displayed = activeType !== result.type ? getArchetypeForType(activeType) : result;
    const displayedTopAxes = activeType !== result.type ? getTopAxes(displayed.axisWeights) : result.topAxes;
    const conf = CONFIDENCE_LABEL[result.confidence];

    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="text-center px-6 pt-6 pb-3">
          <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Your travel style</p>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{displayed.name}</h2>
          <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">{displayed.tagline}</p>
          <p className={`text-xs mt-2 ${conf.color}`}>
            {conf.text}
          </p>
        </div>

        {/* Description */}
        <div className="px-6 pb-4">
          <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed text-center">{displayed.description}</p>
        </div>

        {/* Top priorities */}
        <div className="px-6 pb-4">
          <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide text-center mb-3">What matters most to you</p>
          <div className="flex flex-col gap-2">
            {displayedTopAxes.map(({ axis, label }, i) => (
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
          <div className="px-6 pb-3">
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
              onClick={() => setPhase("alternatives")}
            >
              Not quite me — see alternatives
            </button>
            <span className="text-gray-300 dark:text-gray-700">·</span>
            <button
              className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              onClick={onSkip}
            >
              Set up manually
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

      {/* Back / counter */}
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
