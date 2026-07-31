"use client";

import { useState } from "react";
import { QUESTIONS, scoreAssessment, AssessmentResult, getArchetypeForType, getTopAxes } from "@/lib/assessment";
import { TYPE_INFO } from "@/lib/typeInfo";
import CalibrationAssessment from "@/components/CalibrationAssessment";

interface Props {
  prefilledName?: string;
  isSelf?: boolean; // true = primary user (I/me/my), false = another traveler (they/them/their)
  onComplete: (result: AssessmentResult, name: string, pastTripContext?: string) => void;
  onSkip: () => void;
}

type Phase = "intro" | "questions" | "past_trips" | "result" | "alternatives";

const ACK_MESSAGES = ["Good to know.", "Makes sense.", "Got it.", "Noted."];

const CONFIDENCE_LABEL = {
  high:   { text: "Strong match",        color: "text-green-600" },
  medium: { text: "Good match",          color: "text-yellow-600" },
  low:    { text: "Close call — see alternatives", color: "text-orange-600" },
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
  const [showAlternativesInline, setShowAlternativesInline] = useState(false);
  const [calibratingPath, setCalibratingPath] = useState<"wing" | "fresh" | null>(null);

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
    setCalibratingPath(null);
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
      <div className="flex flex-col items-center justify-center h-full px-6 py-12 text-center">
        <p
          className="font-semibold text-[#2C3E50] leading-snug mb-4"
          style={{ fontFamily: 'var(--font-lora, "Lora", Georgia, serif)', fontSize: 30, maxWidth: 420 }}
        >
          {isSelf
            ? "Great experiences are everywhere. The right ones are specific to you."
            : `Great experiences are everywhere. The right ones are specific to ${displayName}.`}
        </p>
        <p className="text-sm text-[#888888] leading-relaxed mb-7" style={{ maxWidth: 380 }}>
          A few questions and we&apos;ll know which ones those are.
        </p>
        <button
          className="bg-[#2C3E50] text-white text-sm font-semibold rounded-full transition-opacity hover:opacity-90 w-full"
          style={{ maxWidth: 260, paddingTop: 15, paddingBottom: 15 }}
          onClick={() => setPhase("questions")}
        >
          Let&apos;s go →
        </button>
        <p className="text-xs text-[#888888] mt-4">Takes about 2 minutes</p>
        <button
          className="text-xs text-[#888888] underline mt-3 transition-opacity hover:opacity-70"
          onClick={onSkip}
        >
          I already know my type
        </button>
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
            className="text-xs text-[#888888] hover:text-[#2C3E50] transition-colors mb-3"
            onClick={() => setPhase("result")}
          >
            ← Back
          </button>
          <h3 className="text-base font-semibold text-[#2C3E50]">
            {isSelf ? "Your top results" : `${prefilledName || "Their"} top results`}
          </h3>
          <p className="text-sm text-[#888888] mt-0.5">
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
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "16px",
                  borderRadius: 12,
                  border: `1px solid ${isSelected ? "#2C3E50" : "#E8E8E8"}`,
                  background: isSelected ? "#FAF8F5" : "#fff",
                  transition: "all 0.15s",
                  display: "block",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#2C3E50]">{arch.name}</p>
                    <p className="text-xs mt-0.5 text-[#888888]">{arch.tagline}</p>
                    <p className="text-xs mt-2 leading-relaxed line-clamp-2 text-[#888888]">{arch.description}</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className={`text-lg font-bold tabular-nums ${isSelected ? "text-[#C4956A]" : "text-[#888888]"}`}>
                      {score}
                    </div>
                    <div className="text-xs text-[#888888]">pts</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="px-6 pb-6 space-y-2">
          <button
            className="w-full py-3 bg-[#2C3E50] text-white text-sm font-semibold rounded-full transition-opacity hover:opacity-90"
            onClick={() => setPhase("result")}
          >
            Use selected style →
          </button>
          <div className="text-center">
            <button
              className="text-xs text-[#888888] hover:opacity-70 transition-opacity"
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
        <h3 className="text-lg font-semibold text-[#2C3E50] mb-2">
          Tell us about an experience you loved.
        </h3>
        <p className="text-sm text-[#888888] leading-relaxed mb-5">
          Where was it, and what made it feel right for you? The more ViyaWay knows, the better your first results.
        </p>
        <textarea
          className="w-full text-[#2C3E50] text-sm rounded-xl px-3 py-2.5 focus:outline-none transition-colors resize-none"
          style={{ background: "#FAF8F5", border: "1px solid #E8E8E8" }}
          rows={4}
          maxLength={280}
          placeholder="e.g. A week in rural Japan — the quiet, the food, the feeling of being somewhere completely different from home."
          value={pastTripContext}
          onChange={(e) => setPastTripContext(e.target.value)}
        />
        <p className="text-xs text-[#888888] text-right mt-1">{pastTripContext.length}/280</p>
        <button
          className="mt-4 w-full py-3 bg-[#2C3E50] text-white text-sm font-semibold rounded-full transition-opacity hover:opacity-90"
          onClick={() => setPhase("result")}
        >
          Continue →
        </button>
        <div className="mt-2 text-center">
          <button
            className="text-xs text-[#888888] hover:opacity-70 transition-opacity"
            onClick={() => { setPastTripContext(""); setPhase("result"); }}
          >
            Skip for now →
          </button>
        </div>
      </div>
    );
  }

  // ── Calibration intercept (Entry Points 1 + 3) ──────────────────────────────
  if (phase === "result" && result && calibratingPath !== null) {
    return (
      <CalibrationAssessment
        calibrationPath={calibratingPath}
        originalResult={result}
        runnerUpType={result.runnerUpTypes[0]}
        onComplete={(newResult) => {
          setResult(newResult);
          setActiveType(newResult.type);
          setCalibratingPath(null);
        }}
        onSkip={() => setCalibratingPath(null)}
        ctaLabel={isSelf ? "This feels right — create my profile →" : `This feels right →`}
      />
    );
  }

  // ── Result screen ────────────────────────────────────────────────────────────
  if (phase === "result" && result && activeType !== null) {
    const displayed = activeType !== result.type ? getArchetypeForType(activeType) : result;
    const typeInfo = TYPE_INFO[String(activeType)];

    return (
      <div className="flex flex-col items-center justify-center h-full px-6 py-10 text-center">

        {/* Inline alternatives — low confidence only */}
        {showAlternativesInline && result.runnerUpTypes.length > 0 && (
          <div className="mb-6 w-full border border-[#E8E8E8] rounded p-4 text-left space-y-3">
            <p className="text-xs text-[#888888] leading-snug">
              You were close between a couple of types — here&apos;s what else came up:
            </p>
            {result.runnerUpTypes.slice(0, 2).map((type) => {
              const arch = getArchetypeForType(type);
              const info = TYPE_INFO[String(type)];
              return (
                <div key={type} className="border border-[#E8E8E8] rounded p-3">
                  <p className="text-sm font-semibold text-[#2C3E50]">{arch.name}</p>
                  {info && <p className="text-xs text-[#888888] mt-0.5 leading-snug">{info.descriptor}</p>}
                  <button
                    className="mt-2 text-xs text-[#2C3E50] underline font-medium"
                    onClick={() => { setActiveType(type); setShowAlternativesInline(false); }}
                  >
                    This sounds more like me →
                  </button>
                </div>
              );
            })}
            <button
              className="text-xs text-[#888888] underline"
              onClick={() => setShowAlternativesInline(false)}
            >
              Stay with {getArchetypeForType(result.type).name} →
            </button>
          </div>
        )}

        {/* Type name */}
        <p
          className="font-semibold text-[#2C3E50] leading-tight mb-2"
          style={{ fontFamily: 'var(--font-lora, "Lora", Georgia, serif)', fontSize: 32 }}
        >
          You&apos;re {displayed.name}.
        </p>

        {/* Descriptor */}
        <p className="text-sm text-[#888888] mb-5">
          {typeInfo?.descriptor ?? displayed.tagline}
        </p>

        {/* Bullets */}
        {typeInfo?.bullets && (
          <ul className="text-left text-sm text-[#1A1A1A] mb-6 space-y-1" style={{ maxWidth: 360, lineHeight: 1.8 }}>
            {typeInfo.bullets.map((b) => (
              <li key={b}>· {b}</li>
            ))}
          </ul>
        )}

        {/* Name input (only if not pre-filled) */}
        {!prefilledName && (
          <div className="w-full mb-5 text-left" style={{ maxWidth: 360 }}>
            <label className="block text-xs text-[#888888] uppercase tracking-wide mb-1.5">
              What should we call you?
            </label>
            <input
              className="w-full border border-[#E8E8E8] text-sm rounded px-3 py-2 text-[#1A1A1A] placeholder:text-[#888888] focus:outline-none focus:border-[#2C3E50] transition-colors"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAccept()}
              autoFocus
            />
          </div>
        )}

        {/* Primary CTA */}
        <button
          className="bg-[#2C3E50] text-white text-sm font-semibold rounded-full transition-opacity hover:opacity-90 disabled:opacity-40 w-full"
          style={{ maxWidth: 260, paddingTop: 15, paddingBottom: 15 }}
          onClick={handleAccept}
          disabled={!prefilledName && !name.trim()}
        >
          {isSelf ? "Start discovering →" : `Create ${prefilledName ? prefilledName + "'s" : "their"} profile →`}
        </button>

        {/* Entry Point 1 — Not quite right (Path B, fresh calibration) */}
        <button
          className="text-xs mt-4 transition-opacity hover:opacity-70"
          style={{ color: "#C4956A", textDecoration: "underline" }}
          onClick={() => setCalibratingPath("fresh")}
        >
          Not quite right? Answer a few more questions →
        </button>

        {/* Entry Point 3 — Low confidence (Path A, wing calibration) */}
        {result.confidence === "low" && result.runnerUpTypes.length > 0 && (
          <button
            className="text-xs mt-2 transition-opacity hover:opacity-70"
            style={{ color: "#C4956A", textDecoration: "underline" }}
            onClick={() => setCalibratingPath("wing")}
          >
            Want a more accurate result? Answer a few more questions →
          </button>
        )}

        {/* Secondary: see alternatives */}
        {result.runnerUpTypes.length > 0 && (
          <button
            className="text-xs text-[#888888] mt-3 transition-opacity hover:opacity-70"
            onClick={() => setShowAlternativesInline((v) => !v)}
          >
            {showAlternativesInline ? "Hide alternatives" : "See other types that came up →"}
          </button>
        )}
      </div>
    );
  }

  // ── Questions screen ─────────────────────────────────────────────────────────
  // Map N questions to 4 progress dots
  const filledDots = Math.min(4, Math.floor((idx / QUESTIONS.length) * 4) + 1);

  return (
    <div className="flex flex-col h-full px-6 py-8">
      {/* 4-dot progress indicator */}
      <div className="flex items-center justify-center gap-1.5 mb-8">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-full"
            style={{
              width: 6, height: 6,
              background: i < filledDots ? "#C4956A" : "#E8E8E8",
            }}
          />
        ))}
      </div>

      {/* Question */}
      <div className="flex-1 flex flex-col justify-center text-center">
        {ackMessage ? (
          <p className="text-sm text-[#888888] font-medium">{ackMessage}</p>
        ) : (
          <div style={{ opacity: visible ? 1 : 0, transition: "opacity 0.18s ease" }}>
            <p
              className="font-medium text-[#2C3E50] mb-8"
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
                      border: `1px solid ${chosen ? "#C4956A" : "#E8E8E8"}`,
                      borderRadius: 12,
                      padding: "18px 20px",
                      background: chosen ? "#FBF4EC" : "#fff",
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

      {/* Back link */}
      <div className="flex justify-between items-center pt-6">
        <button
          className="text-xs text-[#888888] transition-opacity disabled:opacity-0"
          onClick={handleBack}
          disabled={idx === 0}
        >
          ← Back
        </button>
        <button
          className="text-xs text-[#888888] underline"
          onClick={onSkip}
        >
          Skip
        </button>
      </div>
    </div>
  );
}
