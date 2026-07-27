"use client";

import { useState } from "react";
import { QUESTIONS, scoreAssessment, AssessmentResult, getArchetypeForType, getTopAxes } from "@/lib/assessment";

interface Props {
  prefilledName?: string;
  isSelf?: boolean; // true = primary user (I/me/my), false = another traveler (they/them/their)
  onComplete: (result: AssessmentResult, name: string, pastTripContext?: string) => void;
  onSkip: () => void;
}

type Phase = "intro" | "questions" | "past_trips" | "result" | "alternatives";

const ACK_MESSAGES = ["Good to know.", "Makes sense.", "Got it.", "Noted."];

const CONFIDENCE_LABEL = {
  high:   { text: "Strong match",        color: "text-green-600 dark:text-green-400" },
  medium: { text: "Good match",          color: "text-yellow-600 dark:text-yellow-400" },
  low:    { text: "Close call — see alternatives", color: "text-orange-600 dark:text-orange-400" },
};

export default function TravelAssessment({ prefilledName, isSelf = true, onComplete, onSkip }: Props) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, "A" | "B">>({});
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [activeType, setActiveType] = useState<number | null>(null); // overrides result.type
  const [name, setName] = useState(prefilledName ?? "");
  const [pastTripContext, setPastTripContext] = useState("");
  const [animating, setAnimating] = useState(false);
  const [visible, setVisible] = useState(true);
  const [ackMessage, setAckMessage] = useState<string | null>(null);

  function handleAnswer(choice: "A" | "B") {
    if (animating) return;
    const newAnswers = { ...answers, [idx]: choice };
    setAnswers(newAnswers);

    if (idx + 1 < QUESTIONS.length) {
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
      const r = scoreAssessment(newAnswers);
      setResult(r);
      setActiveType(r.type);
      setPhase("past_trips");
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
    setPastTripContext("");
    setPhase("intro");
  }

  function handleAccept() {
    if (!result || activeType === null) return;
    const finalName = name.trim() || prefilledName || "Traveler";
    const context = pastTripContext.trim() || undefined;
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
      onComplete(altResult, finalName, context);
    } else {
      onComplete(result, finalName, context);
    }
  }

  const progress = Math.round((idx / QUESTIONS.length) * 100);
  const q = QUESTIONS[idx];

  // ── Intro screen ─────────────────────────────────────────────────────────────
  if (phase === "intro") {
    const displayName = prefilledName || "them";
    return (
      <div className="flex flex-col h-full justify-center px-6 py-10">
        <h3 className="text-lg font-semibold text-[#2C3E50] dark:text-white mb-3">
          {isSelf ? "Let’s get to know you" : `Let’s get to know ${displayName}`}
        </h3>
        <p className="text-sm text-[#6B8299] dark:text-[#9BB0C1] leading-relaxed mb-3">
          {isSelf
            ? "The following questions help us understand how you experience travel. There are no right or wrong answers — just pick what feels more like you."
            : `The following questions help us understand how ${displayName} experiences travel. There are no right or wrong answers — just pick what feels more like ${displayName}.`}
        </p>
        <p className="text-xs text-[#9BB0C1] dark:text-[#6B8299] mb-8">10 questions. About 3 minutes.</p>
        <button
          className="w-full py-2.5 bg-[#5B8BA0] hover:bg-[#4A7A8F] text-white text-sm font-medium rounded-xl transition-colors"
          onClick={() => setPhase("questions")}
        >
          Begin →
        </button>
        <div className="mt-3 text-center">
          <button
            className="text-xs text-[#9BB0C1] dark:text-[#6B8299] hover:text-[#6B8299] dark:hover:text-[#B8D4E3] transition-colors"
            onClick={onSkip}
          >
            I already know my type
          </button>
        </div>
      </div>
    );
  }

  // ── Alternatives screen ──────────────────────────────────────────────────────
  if (phase === "alternatives" && result) {
    const topThree = [result.type, ...result.runnerUpTypes].slice(0, 3);
    return (
      <div className="flex flex-col h-full">
        <div className="px-6 pt-5 pb-3">
          <button
            className="text-xs text-[#9BB0C1] dark:text-[#6B8299] hover:text-[#6B8299] dark:hover:text-[#B8D4E3] transition-colors mb-3"
            onClick={() => setPhase("result")}
          >
            ← Back
          </button>
          <h3 className="text-base font-semibold text-[#2C3E50] dark:text-white">
            {isSelf ? "Your top results" : `${prefilledName || "Their"} top results`}
          </h3>
          <p className="text-sm text-[#6B8299] dark:text-[#9BB0C1] mt-0.5">
            {isSelf ? "Pick the one that feels most like you." : `Pick the one that feels most like ${prefilledName || "them"}.`}
          </p>
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
                    ? "border-[#5B8BA0] bg-[#5B8BA0]/8 dark:bg-[#5B8BA0]/15"
                    : "border-[#E0E8ED] dark:border-[#3D5A6E] bg-white dark:bg-[#2a3f52] hover:border-[#5B8BA0]/40 dark:hover:border-[#5B8BA0]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${isSelected ? "text-[#2C3E50] dark:text-[#B8D4E3]" : "text-[#2C3E50] dark:text-white"}`}>
                      {arch.name}
                    </p>
                    <p className={`text-xs mt-0.5 ${isSelected ? "text-[#5B8BA0] dark:text-[#7DBAD4]" : "text-[#6B8299] dark:text-[#9BB0C1]"}`}>
                      {arch.tagline}
                    </p>
                    <p className={`text-xs mt-2 leading-relaxed line-clamp-2 ${isSelected ? "text-[#3D5A6E] dark:text-[#B8D4E3]" : "text-[#6B8299] dark:text-[#9BB0C1]"}`}>
                      {arch.description}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className={`text-lg font-bold tabular-nums ${isSelected ? "text-[#5B8BA0] dark:text-[#7DBAD4]" : "text-[#9BB0C1] dark:text-[#6B8299]"}`}>
                      {score}
                    </div>
                    <div className="text-xs text-[#9BB0C1] dark:text-[#6B8299]">pts</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="px-6 pb-6 space-y-2">
          <button
            className="w-full py-2.5 bg-[#5B8BA0] hover:bg-[#4A7A8F] text-white text-sm font-medium rounded-xl transition-colors"
            onClick={() => setPhase("result")}
          >
            Use selected style →
          </button>
          <div className="text-center">
            <button
              className="text-xs text-[#9BB0C1] dark:text-[#6B8299] hover:text-[#6B8299] dark:hover:text-[#B8D4E3] transition-colors"
              onClick={handleRetake}
            >
              Retake assessment
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Past trips screen ────────────────────────────────────────────────────────
  if (phase === "past_trips") {
    return (
      <div className="flex flex-col h-full justify-center px-6 py-10">
        <h3 className="text-lg font-semibold text-[#2C3E50] dark:text-white mb-2">
          Tell us about a trip you loved.
        </h3>
        <p className="text-sm text-[#6B8299] dark:text-[#9BB0C1] leading-relaxed mb-5">
          Where was it, and what made it feel right for you? The more ViyaWay knows, the better your first results.
        </p>
        <textarea
          className="w-full bg-[#EEF4F8] dark:bg-[#2a3f52] text-[#2C3E50] dark:text-[#B8D4E3] border border-[#E0E8ED] dark:border-[#3D5A6E] text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#5B8BA0] transition-colors resize-none"
          rows={4}
          maxLength={280}
          placeholder="e.g. A week in rural Japan — the quiet, the food, the feeling of being somewhere completely different from home."
          value={pastTripContext}
          onChange={(e) => setPastTripContext(e.target.value)}
        />
        <p className="text-xs text-[#B8D4E3] dark:text-[#3D5A6E] text-right mt-1">{pastTripContext.length}/280</p>
        <button
          className="mt-4 w-full py-2.5 bg-[#5B8BA0] hover:bg-[#4A7A8F] text-white text-sm font-medium rounded-xl transition-colors"
          onClick={() => setPhase("result")}
        >
          Continue →
        </button>
        <div className="mt-2 text-center">
          <button
            className="text-xs text-[#9BB0C1] dark:text-[#6B8299] hover:text-[#6B8299] dark:hover:text-[#B8D4E3] transition-colors"
            onClick={() => { setPastTripContext(""); setPhase("result"); }}
          >
            Skip for now →
          </button>
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
          <p className="text-xs text-[#E8A87C] uppercase tracking-widest font-semibold mb-2">
            {displayed.name}
          </p>
          <h2 className="text-2xl font-bold text-[#2C3E50] dark:text-white mb-3 leading-snug">{displayed.headline}</h2>
          <p className={`text-xs ${conf.color}`}>
            {conf.text}
          </p>
        </div>

        {/* Description */}
        <div className="px-6 pb-4">
          <p className="text-[#6B8299] dark:text-[#9BB0C1] text-sm leading-relaxed text-center">{displayed.description}</p>
        </div>

        {/* Top priorities */}
        <div className="px-6 pb-4">
          <p className="text-xs text-[#9BB0C1] dark:text-[#6B8299] uppercase tracking-wide text-center mb-3">
            {isSelf ? "What matters most to you" : `What matters most to ${prefilledName || "them"}`}
          </p>
          <div className="flex flex-col gap-2">
            {displayedTopAxes.map(({ axis, label }, i) => (
              <div
                key={axis}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-sm ${
                  i === 0
                    ? "bg-[#5B8BA0]/8 dark:bg-[#5B8BA0]/15 border-[#5B8BA0]/30 dark:border-[#5B8BA0]/50 text-[#3D5A6E] dark:text-[#B8D4E3]"
                    : "bg-[#F8FAFB] dark:bg-[#2a3f52] border-[#E0E8ED] dark:border-[#3D5A6E] text-[#3D5A6E] dark:text-[#B8D4E3]"
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  i === 0 ? "bg-[#5B8BA0] text-white" : "bg-[#E0E8ED] dark:bg-[#4A7A8F] text-[#3D5A6E] dark:text-[#B8D4E3]"
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
            <label className="block text-xs text-[#6B8299] dark:text-[#9BB0C1] uppercase tracking-wide mb-1.5">
              What should we call you?
            </label>
            <input
              className="w-full bg-[#EEF4F8] dark:bg-[#2a3f52] text-[#2C3E50] dark:text-[#B8D4E3] border border-[#E0E8ED] dark:border-[#3D5A6E] text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#5B8BA0] transition-colors"
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
            className="w-full py-2.5 bg-[#5B8BA0] hover:bg-[#4A7A8F] text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
            onClick={handleAccept}
            disabled={!prefilledName && !name.trim()}
          >
            {isSelf ? "This feels right — create my profile →" : `This feels right — create ${prefilledName ? prefilledName + "'s" : "their"} profile →`}
          </button>
          <div className="flex gap-3 justify-center">
            <button
              className="text-xs text-[#9BB0C1] dark:text-[#6B8299] hover:text-[#6B8299] dark:hover:text-[#B8D4E3] transition-colors"
              onClick={() => setPhase("alternatives")}
            >
              {isSelf ? "Not quite me — see alternatives" : "Not quite right — see alternatives"}
            </button>
            <span className="text-[#B8D4E3] dark:text-[#3D5A6E]">·</span>
            <button
              className="text-xs text-[#9BB0C1] dark:text-[#6B8299] hover:text-[#6B8299] dark:hover:text-[#B8D4E3] transition-colors"
              onClick={onSkip}
            >
              I already know my type
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
            Question {idx + 1} of {QUESTIONS.length}
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
              {isSelf ? "Which resonates more?" : `Which resonates more for ${prefilledName || "them"}?`}
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
                    <span className={`text-[10px] font-bold uppercase tracking-wider mr-2 ${chosen ? "text-[#5B8BA0]" : "text-[#9BB0C1] dark:text-[#6B8299]"}`}>
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

      {/* Back / counter */}
      <div className="px-6 pb-5 pt-2 flex justify-between items-center">
        <button
          className="text-xs text-[#9BB0C1] dark:text-[#6B8299] hover:text-[#6B8299] dark:hover:text-[#B8D4E3] transition-colors disabled:opacity-30"
          onClick={handleBack}
          disabled={idx === 0}
        >
          ← Back
        </button>
        <span className="text-xs text-[#B8D4E3] dark:text-[#3D5A6E] tabular-nums">
          {Object.keys(answers).length}/{QUESTIONS.length} answered
        </span>
      </div>
    </div>
  );
}
