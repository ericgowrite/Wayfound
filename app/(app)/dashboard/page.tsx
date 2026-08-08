"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Profile, TripWorkspace } from "@/types";
import WorkspaceView from "@/components/WorkspaceView";
import ProfileEditor from "@/components/ProfileEditor";
import AddProfileModal from "@/components/AddProfileModal";
import FitLegendModal from "@/components/FitLegendModal";
import TravelAssessment from "@/components/TravelAssessment";
import { AssessmentResult, CORE_ARCHETYPES, getTopAxes } from "@/lib/assessment";
import { useTheme } from "@/lib/useTheme";
import { useAuth } from "@/lib/AuthContext";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import DashboardTour from "@/components/DashboardTour";
import { useTourState } from "@/lib/useTourState";
import { CATEGORY_META } from "@/lib/categories";
import HomeScreen from "@/components/HomeScreen";
import { TYPE_INFO } from "@/lib/typeInfo";
import CalibrationAssessment from "@/components/CalibrationAssessment";

export default function Home() {
  const { dark, toggle } = useTheme();
  const { user, logout } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [workspaces, setWorkspaces] = useState<TripWorkspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [showAddProfile, setShowAddProfile] = useState(false);
  const [showNewWorkspace, setShowNewWorkspace] = useState(false);
  const [workspaceError, setWorkspaceError] = useState("");
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDest, setNewDest] = useState("");
  const [newTravelers, setNewTravelers] = useState<string[]>([]);
  const [showAddTraveler, setShowAddTraveler] = useState(false);
  const [addingTravelerForWorkspace, setAddingTravelerForWorkspace] = useState(false);
  const [addingTravelerToExistingWorkspace, setAddingTravelerToExistingWorkspace] = useState(false);
  const [activeSearchId, setActiveSearchId] = useState<string | null>(null);
  const [deleteWorkspaceId, setDeleteWorkspaceId] = useState<string | null>(null);
  const [pendingAutoSearch, setPendingAutoSearch] = useState<{ workspaceId: string; query: string; category: import("@/types").SearchCategory; intent?: string } | null>(null);
  const [deleteProfileId, setDeleteProfileId] = useState<string | null>(null);
  const [showFitLegend, setShowFitLegend] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [calibratingProfile, setCalibratingProfile] = useState<Profile | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profilesOpen, setProfilesOpen] = useState(true);
  const [profilesLoaded, setProfilesLoaded] = useState(false);
  const [firstRunError, setFirstRunError] = useState("");
  const { isDone: tourDone, markDone: markTourDone } = useTourState("dashboard");
  const [showTour, setShowTour] = useState(false);

  // Wait for the Firebase user to be confirmed before fetching — ensures
  // the ID token is available when fetchWithAuth runs.
  // Use user?.uid (not the full User object) so this only re-runs when the
  // actual identity changes, not on token refreshes. Explicitly reset all
  // user-specific state first so stale data from a previous session is never
  // visible while the new fetch is in-flight. This is a multi-field reset
  // tied to identity change + kicks off async fetches right after — a
  // legitimate effect, not state derived from a single prop.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProfiles([]);
    setWorkspaces([]);
    setActiveWorkspaceId(null);
    setProfilesLoaded(false);

    if (!user) return;

    fetchWithAuth("/api/profiles").then((r) => r.json()).then((ps: Profile[]) => {
      if (!Array.isArray(ps)) { setProfilesLoaded(true); return; }
      setProfiles(ps);
      // Primary profile is always included in createWorkspace — don't pre-add to newTravelers
      // or it renders twice (once as "(you)" row, once in the travelers list).
      setProfilesLoaded(true);
    });
    fetchWithAuth("/api/workspaces").then((r) => r.json()).then((ws: TripWorkspace[]) => {
      if (!Array.isArray(ws)) return;
      setWorkspaces(ws);
      // Don't auto-select a workspace — HomeScreen is the entry point
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // Reset to first search of the newly active workspace when the workspace switches.
  useEffect(() => {
    const ws = workspaces.find((w) => w.id === activeWorkspaceId);
    setActiveSearchId(ws?.searches[0]?.id ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspaceId]);

  // Auto-start dashboard tour once profiles are loaded and the user hasn't seen it.
  // Don't start when profiles.length === 0 — first-run onboarding is already showing.
  useEffect(() => {
    if (profilesLoaded && profiles.length > 0 && !tourDone) {
      setShowTour(true);
    }
  }, [profilesLoaded, profiles.length, tourDone]);

  async function handleTourDone() {
    setShowTour(false);
    await markTourDone();
  }

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? null;
  const defaultProfile = profiles.find((p) => p.isDefault) ?? profiles[0] ?? null;

  // Resolve the full Profile objects for the active workspace's travelers
  const travelerProfiles: Profile[] = activeWorkspace
    ? activeWorkspace.travelers
        .map((id) => profiles.find((p) => p.id === id))
        .filter((p): p is Profile => !!p)
    : defaultProfile
    ? [defaultProfile]
    : [];

  // Fall back to defaultProfile if the workspace's traveler IDs don't resolve
  // (e.g. created before profile existed, or profile was deleted)
  const effectiveTravelers = travelerProfiles.length > 0
    ? travelerProfiles
    : defaultProfile
    ? [defaultProfile]
    : [];

  async function createWorkspace() {
    if (!newName.trim() || !newDest.trim()) return;
    setCreatingWorkspace(true);
    const defaultId = profiles[0]?.id;
    const travelers = [defaultId, ...newTravelers].filter((id): id is string => !!id && id !== undefined).filter((id, i, arr) => arr.indexOf(id) === i);
    try {
      const res = await fetchWithAuth("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          destination: newDest,
          travelers,
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        console.error("[createWorkspace] failed:", err);
        setWorkspaceError(`Failed to create experience (${res.status}). Please try again.`);
        return;
      }
      const ws: TripWorkspace = await res.json();
      setWorkspaceError("");
      setWorkspaces((prev) => [ws, ...prev]);
      setActiveWorkspaceId(ws.id);
      setShowNewWorkspace(false);
      setNewName("");
      setNewDest("");
      setNewTravelers([]);
      setShowAddTraveler(false);


    } catch (e) {
      console.error("[createWorkspace] threw:", e);
      setWorkspaceError(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setCreatingWorkspace(false);
    }
  }

  async function deleteWorkspace(id: string) {
    await fetchWithAuth(`/api/workspaces/${id}`, { method: "DELETE" });
    const updated = workspaces.filter((w) => w.id !== id);
    setWorkspaces(updated);
    if (activeWorkspaceId === id) setActiveWorkspaceId(updated[0]?.id ?? null);
    setDeleteWorkspaceId(null);
  }

  async function deleteProfile(id: string) {
    await fetchWithAuth(`/api/profiles/${id}`, { method: "DELETE" });
    setProfiles((prev) => prev.filter((p) => p.id !== id));
    setDeleteProfileId(null);
  }

  function handleWorkspaceChange(updated: TripWorkspace) {
    setWorkspaces((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
  }

  async function handleFirstRunAssessment(result: AssessmentResult, name: string) {
    setFirstRunError("");
    const typeKey = String(result.type);
    try {
      const res = await fetchWithAuth("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || "Traveler",
          enneagramType: typeKey,
          description: result.description,
          axisWeights: result.axisWeights,
          thresholds: {},
          dealbreakers: [],
          isDefault: true,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error("[handleFirstRunAssessment] profile creation failed:", res.status, body);
        setFirstRunError(body.error || `Couldn't save your profile (${res.status}). Please try again.`);
        return;
      }
      const profile: Profile = await res.json();
      setProfiles([profile]);
      setNewTravelers([profile.id]);
    } catch (e) {
      console.error("[handleFirstRunAssessment] threw:", e);
      setFirstRunError(e instanceof Error ? e.message : "Something went wrong saving your profile.");
    }
  }

  function handleProfileUpdate(updated: Profile) {
    setProfiles((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  function handleProfileSaved(updated: Profile) {
    setProfiles((prev) => {
      const idx = prev.findIndex((p) => p.id === updated.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = updated; return next; }
      return [...prev, updated];
    });
    if (addingTravelerForWorkspace) {
      // New workspace creation flow — add to newTravelers
      setNewTravelers((prev) => prev.includes(updated.id) ? prev : [...prev, updated.id]);
      setAddingTravelerForWorkspace(false);
    } else if (addingTravelerToExistingWorkspace && activeWorkspaceId) {
      // Existing workspace flow — update workspace.travelers and save
      setWorkspaces((prev) => prev.map((w) => {
        if (w.id !== activeWorkspaceId) return w;
        const travelers = [...new Set([...(w.travelers ?? []), updated.id])];
        const updatedWs = { ...w, travelers };
        fetchWithAuth(`/api/workspaces/${updatedWs.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedWs),
        }).catch(() => {});
        return updatedWs;
      }));
      setAddingTravelerToExistingWorkspace(false);
    }
    setEditingProfile(null);
    setShowAddProfile(false);
  }

  async function handleCalibrationComplete(
    profile: Profile,
    newResult: AssessmentResult,
    meta: { answeredAspirrationally: boolean }
  ) {
    const updated: Profile = {
      ...profile,
      enneagramType: String(newResult.type),
      description: newResult.description,
      axisWeights: newResult.axisWeights,
      calibrationCount: (profile.calibrationCount ?? 0) + 1,
      lastCalibratedAt: new Date().toISOString(),
      calibrationPath: "fresh",
      answeredAspirrationally: meta.answeredAspirrationally,
    };
    try {
      const res = await fetchWithAuth(`/api/profiles/${profile.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      if (res.ok) {
        const saved: Profile = await res.json();
        handleProfileSaved(saved);
      }
    } catch {
      // Optimistically update local state even on network error
      handleProfileSaved(updated);
    }
    setCalibratingProfile(null);
  }

  function toggleTraveler(id: string) {
    setNewTravelers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const inputCls = "bg-[#FAF8F5] text-[#2C3E50] border-[#E8E8E8] focus:border-[#2C3E50]";
  const btnSecondary = "bg-[#E8E8E8] text-[#2C3E50] hover:bg-[#E0DDD9]";
  const modalCls = "bg-[#FAF8F5] border-[#E8E8E8]";

  // Still fetching
  if (!profilesLoaded) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#FAF8F5] text-[#888888]">
        Loading…
      </div>
    );
  }

  // First-run: no profiles yet — show full-screen assessment
  if (profilesLoaded && profiles.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#FAF8F5] p-4">
        <div className="w-full max-w-md bg-[#FAF8F5] border border-[#E8E8E8] rounded-2xl shadow-xl overflow-hidden">
          <div className="px-6 pt-6 pb-0 border-b border-[#E8E8E8]">
            <div className="flex items-center justify-between mb-3">
              <Link href="/" style={{ fontFamily: 'var(--font-lexend-giga), ui-sans-serif, sans-serif', fontWeight: 400, fontSize: 14, color: '#2C3E50', textDecoration: 'none', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                WAY<span style={{ color: '#C4956A' }}>FOUND</span>
              </Link>
              <span className="text-xs text-[#888888]">Welcome</span>
            </div>
          </div>
          {firstRunError && (
            <p className="text-red-500 text-xs px-6 pt-3">{firstRunError}</p>
          )}
          <div style={{ minHeight: 520 }}>
            <TravelAssessment
              onComplete={handleFirstRunAssessment}
              onSkip={() => setShowAddProfile(true)}
            />
          </div>
        </div>
        {showAddProfile && (
          <AddProfileModal isSelf onSave={handleProfileSaved} onClose={() => setShowAddProfile(false)} workspaceId={activeWorkspaceId ?? undefined} />
        )}
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#FAF8F5] text-[#2C3E50] overflow-hidden">
      {/* Mobile backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar — fixed drawer on mobile, static column on desktop */}
      <div className={`${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 transition-transform duration-200 ease-in-out fixed md:relative inset-y-0 left-0 z-50 w-72 md:w-56 flex-shrink-0 bg-[#FAF8F5] border-r border-[#E8E8E8] flex flex-col`}>
        {/* App header */}
        <div className="flex items-start justify-between px-4 py-4 border-b border-[#E8E8E8]">
          <div>
            <Link href="/" style={{ fontFamily: 'var(--font-lexend-giga), ui-sans-serif, sans-serif', fontWeight: 400, fontSize: 14, color: '#2C3E50', textDecoration: 'none', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              WAY<span style={{ color: '#C4956A' }}>FOUND</span>
            </Link>
            <p className="text-xs text-[#2C3E50] mt-0.5">Travel that fits who you are.</p>
            <button
              id="tour-trigger"
              className="text-xs text-[#2C3E50] hover:underline mt-1"
              onClick={() => setShowTour(true)}
            >
              Take a tour
            </button>
          </div>
          <button
            className="md:hidden text-[#888888] hover:text-[#2C3E50] text-xl leading-none mt-0.5 transition-colors"
            onClick={() => setMobileMenuOpen(false)}
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          {/* Profiles section */}
          <div className="mt-2">
            <button
              id="tour-travelers"
              className="w-full flex items-center justify-between px-4 py-2 text-xs text-[#888888] uppercase font-medium tracking-wide hover:text-[#2C3E50] transition-colors"
              onClick={() => setProfilesOpen((o) => !o)}
            >
              <span>Travelers</span>
              <span className="flex items-center gap-1">
                <span
                  id="tour-add-traveler"
                  className="text-[#888888] hover:text-[#2C3E50] transition-colors"
                  onClick={(e) => { e.stopPropagation(); setShowAddProfile(true); }}
                  title="Add traveler"
                >
                  +
                </span>
                <span className="text-[#888888]">{profilesOpen ? "▴" : "▾"}</span>
              </span>
            </button>

            {profilesOpen && (
              <div className="px-2 pb-2">
                {/* Defensive filter: a malformed entry (e.g. an error payload that
                    slipped through a failed API call) should never crash this list */}
                {profiles.filter((p) => p && typeof p.name === "string" && p.name.length > 0).map((p) => (
                  <div
                    key={p.id}
                    className="group flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-[#FAF8F5] transition-colors"
                    onClick={() => setEditingProfile(p)}
                  >
                    <div className="w-6 h-6 rounded-full bg-[#2C3E50] flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                      {p.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[#2C3E50] truncate">{p.name}</p>
                      {TYPE_INFO[p.enneagramType] && (
                        <p className="text-[10px] text-[#888888] truncate leading-tight">{TYPE_INFO[p.enneagramType].name}</p>
                      )}
                    </div>
                    {!p.isDefault && (
                      <button
                        className="opacity-0 group-hover:opacity-100 text-[#888888] hover:text-red-500 text-xs transition-all"
                        onClick={(e) => { e.stopPropagation(); setDeleteProfileId(p.id); }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <p className="px-4 pb-3 pt-0.5 text-[10px] text-[#888888] leading-relaxed">
              Select a traveler to view or update their style.
            </p>
          </div>

          {/* Divider */}
          <div className="border-t border-[#E8E8E8] mx-4" />

          {/* Trips section */}
          <div id="tour-trips" className="flex items-center justify-between px-4 pt-4 pb-3">
            <span style={{ fontFamily: 'var(--font-noto-serif), Georgia, ui-serif, serif', fontWeight: 600, fontSize: 15, color: '#2C3E50' }}>
              Experiences
            </span>
            <button
              id="tour-create-trip"
              onClick={() => setShowNewWorkspace(true)}
              style={{ border: '1px solid #2C3E50', borderRadius: 999, padding: '5px 10px', fontSize: 11, color: '#2C3E50', fontWeight: 600, background: 'transparent', cursor: 'pointer', lineHeight: 1 }}
            >
              + New
            </button>
          </div>

          <div className="px-4">
            {workspaces.length === 0 ? (
              <div style={{ paddingTop: 20, paddingBottom: 20, textAlign: 'center' }}>
                <p style={{ fontFamily: 'var(--font-noto-serif), Georgia, ui-serif, serif', fontWeight: 500, fontSize: 15, color: '#2C3E50' }}>
                  No experiences yet.
                </p>
                <p style={{ fontSize: 12, color: '#888888', marginTop: 8, lineHeight: 1.5 }}>
                  Each experience is its own space — start one whenever you&apos;re ready.
                </p>
                <button
                  onClick={() => setShowNewWorkspace(true)}
                  style={{ border: '1px solid #2C3E50', borderRadius: 999, padding: '9px 14px', fontSize: 12, color: '#2C3E50', fontWeight: 600, background: 'transparent', cursor: 'pointer', marginTop: 14 }}
                >
                  + New experience
                </button>
              </div>
            ) : (
              workspaces.map((w) => {
                const travelerProfiles = (w.travelers ?? []).map(id => profiles.find(p => p.id === id)).filter((p): p is Profile => !!p);
                const travelerNames = travelerProfiles.map(p => p.name);
                const travelerStr = travelerNames.slice(0, 2).join(', ');
                const savedCount = w.savedOptions.length;
                const isBooked = w.savedOptions.some(s => s.journeyState === 'booked');

                const subtitleParts: string[] = [];
                if (isBooked) {
                  subtitleParts.push('Booked');
                  if (w.dates?.start) {
                    const d = new Date(w.dates.start);
                    subtitleParts.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
                  }
                } else if (savedCount > 0) {
                  subtitleParts.push('Planning');
                  subtitleParts.push(`${savedCount} saved`);
                } else {
                  subtitleParts.push('Just started');
                }
                if (travelerStr) subtitleParts.push(`with ${travelerStr}`);

                return (
                  <div key={w.id}>
                    {/* Workspace row */}
                    <div
                      className="group"
                      style={{ borderBottom: '1px solid #E8E8E8', padding: '14px 0', cursor: 'pointer' }}
                      onClick={() => setActiveWorkspaceId(w.id)}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <p className="truncate" style={{ fontFamily: 'var(--font-noto-serif), Georgia, ui-serif, serif', fontWeight: 500, fontSize: 14, color: isBooked ? '#888888' : '#2C3E50', lineHeight: 1.3, flexGrow: 1, minWidth: 0 }}>
                          {w.name || w.destination || 'Untitled'}
                        </p>
                        <button
                          className="opacity-0 group-hover:opacity-100 flex-shrink-0 ml-1"
                          style={{ color: '#888888', fontSize: 14, background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1, padding: 0 }}
                          onClick={(e) => { e.stopPropagation(); setDeleteWorkspaceId(w.id); }}
                        >
                          ×
                        </button>
                      </div>
                      <p style={{ fontSize: 12, color: '#888888', marginTop: 3, lineHeight: 1.4 }}>
                        {subtitleParts.join(' · ')}
                      </p>
                      <button
                        onClick={(e) => { e.stopPropagation(); setActiveWorkspaceId(w.id); }}
                        style={{ fontSize: 13, color: isBooked ? '#888888' : '#2C3E50', textDecoration: 'underline', background: 'none', border: 'none', padding: 0, cursor: 'pointer', marginTop: 6 }}
                      >
                        {isBooked ? 'View →' : 'Continue →'}
                      </button>
                    </div>

                    {/* Search sub-list — only under the active workspace */}
                    {w.id === activeWorkspaceId && w.searches.length > 0 && (
                      <div className="mb-1 border-l border-[#E8E8E8] pl-2 space-y-0.5 mt-1">
                        {w.searches.map((s) => {
                          const meta = CATEGORY_META[s.category] ?? { icon: "🔍", label: s.category, hint: "" };
                          const isActiveSearch = s.id === activeSearchId;
                          return (
                            <button
                              key={s.id}
                              className={`w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-left transition-colors text-xs ${
                                isActiveSearch
                                  ? "text-[#2C3E50] font-medium"
                                  : "text-[#888888] hover:bg-[#FAF8F5]"
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveSearchId(s.id);
                                setMobileMenuOpen(false);
                              }}
                            >
                              <span className="flex-shrink-0">{meta.icon}</span>
                              <span className="truncate flex-1">{s.query}</span>
                              <span className="flex-shrink-0 text-[#888888]">
                                {s.scoredResults.length}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="px-4 pt-3 pb-4 border-t border-[#E8E8E8]">
          <button
            className="text-xs text-[#888888] hover:text-[#2C3E50] transition-colors w-full text-left flex items-center gap-1.5"
            onClick={() => setShowSettings(true)}
          >
            <span style={{ fontSize: 13 }}>⚙</span> Settings
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Mobile top bar — hamburger + current trip name */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-[#FAF8F5] border-b border-[#E8E8E8] flex-shrink-0">
          <button
            className="text-[#2C3E50] text-xl leading-none"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open menu"
          >
            ☰
          </button>
          <span style={{ fontFamily: 'var(--font-lexend-giga), ui-sans-serif, sans-serif', fontWeight: 400, fontSize: 14, color: '#2C3E50', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            WAY<span style={{ color: '#C4956A' }}>FOUND</span>
          </span>
          {activeWorkspace && (
            <span className="text-sm text-[#888888] truncate">· {activeWorkspace.name}</span>
          )}
        </div>
        <div className="flex-1 overflow-hidden">
        {activeWorkspace && effectiveTravelers.length > 0 ? (
          <WorkspaceView
            key={activeWorkspace.id}
            workspace={activeWorkspace}
            travelers={effectiveTravelers}
            allProfiles={profiles}
            onChange={handleWorkspaceChange}
            onProfileUpdate={handleProfileUpdate}
            onOpenProfile={effectiveTravelers[0] ? () => setEditingProfile(effectiveTravelers[0]) : undefined}
            onNewTraveler={() => { setAddingTravelerToExistingWorkspace(true); setShowAddProfile(true); }}
            activeSearchId={activeSearchId}
            onSearchChange={(id) => { setActiveSearchId(id); setPendingAutoSearch(null); }}
            autoSearch={pendingAutoSearch?.workspaceId === activeWorkspace.id ? pendingAutoSearch : undefined}
          />
        ) : (
          <HomeScreen
            profiles={profiles}
            workspaces={workspaces}
            onWorkspaceCreated={(workspace, autoSearch) => {
              setWorkspaces((prev) => [workspace, ...prev]);
              setActiveWorkspaceId(workspace.id);
              setPendingAutoSearch(autoSearch);
            }}
            onSelectWorkspace={(id) => setActiveWorkspaceId(id)}
            onSelectSearch={(workspaceId, searchId) => {
              setActiveWorkspaceId(workspaceId);
              setActiveSearchId(searchId);
            }}
          />
        )}
        </div>
      </div>

      {/* New workspace modal */}
      {showNewWorkspace && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div style={{ background: '#FFFFFF', border: '1px solid #E8E8E8', borderRadius: 4, padding: '28px 32px', width: '100%', maxWidth: 480, fontFamily: "var(--font-encode), ui-sans-serif, system-ui, sans-serif" }}>

            <button
              onClick={() => { setShowNewWorkspace(false); setWorkspaceError(""); setNewName(""); setNewDest(""); setNewTravelers([]); setShowAddTraveler(false); setAddingTravelerForWorkspace(false); }}
              style={{ fontSize: 13, color: '#888888', textDecoration: 'underline', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            >
              ← Back
            </button>

            <div style={{ fontFamily: 'var(--font-noto-serif), Georgia, ui-serif, serif', fontWeight: 600, fontSize: 22, color: '#2C3E50', marginTop: 16 }}>
              What are we planning?
            </div>

            <input
              placeholder={"Costa Rica, Sonoma, \"Sam's 30th\"…"}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createWorkspace()}
              autoFocus
              style={{ border: '1px solid #E8E8E8', borderRadius: 4, padding: '13px 16px', fontSize: 14, color: '#1A1A1A', width: '100%', marginTop: 16, boxSizing: 'border-box', outline: 'none' }}
            />

            <div style={{ display: 'flex', gap: 16, marginTop: 24 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#888888', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Where</div>
                <input
                  placeholder="e.g. Tuscany, Italy"
                  value={newDest}
                  onChange={(e) => setNewDest(e.target.value)}
                  style={{ border: '1px solid #E8E8E8', borderRadius: 4, padding: '12px 14px', fontSize: 13, color: '#1A1A1A', width: '100%', marginTop: 8, boxSizing: 'border-box', outline: 'none' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#888888', textTransform: 'uppercase', letterSpacing: '0.06em' }}>When (optional)</div>
                <input
                  placeholder="Flexible"
                  style={{ border: '1px solid #E8E8E8', borderRadius: 4, padding: '12px 14px', fontSize: 13, color: '#1A1A1A', width: '100%', marginTop: 8, boxSizing: 'border-box', outline: 'none' }}
                />
              </div>
            </div>

            <div style={{ borderTop: '1px solid #E8E8E8', marginTop: 24, paddingTop: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#888888', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Who&apos;s joining you
              </div>

              {profiles[0] && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#2C3E50', color: '#fff', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {profiles[0].name[0]}
                  </div>
                  <span style={{ fontSize: 13, color: '#1A1A1A' }}>{profiles[0].name} (you)</span>
                </div>
              )}

              {newTravelers.filter(id => id !== profiles[0]?.id).map(id => {
                const p = profiles.find(pr => pr.id === id);
                if (!p) return null;
                return (
                  <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#C4956A', color: '#fff', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {p.name[0]}
                    </div>
                    <span style={{ fontSize: 13, color: '#1A1A1A', flex: 1 }}>{p.name}</span>
                    <button onClick={() => toggleTraveler(id)} style={{ fontSize: 16, color: '#888888', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1, padding: 0 }}>×</button>
                  </div>
                );
              })}

              <div style={{ marginTop: 12 }}>
                {/* Picker for existing profiles */}
                {showAddTraveler && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                    {profiles.filter(p => p.id !== profiles[0]?.id && !newTravelers.includes(p.id)).map(p => (
                      <button
                        key={p.id}
                        onClick={() => { toggleTraveler(p.id); setShowAddTraveler(false); }}
                        style={{ border: '1px solid #E8E8E8', borderRadius: 4, padding: '6px 12px', fontSize: 12, color: '#2C3E50', background: '#fff', cursor: 'pointer' }}
                      >
                        {p.name}
                      </button>
                    ))}
                    {profiles.filter(p => p.id !== profiles[0]?.id && !newTravelers.includes(p.id)).length === 0 && (
                      <span style={{ fontSize: 12, color: '#888888' }}>All travelers added.</span>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  {/* Add existing traveler — only show if there are unadded profiles */}
                  {profiles.filter(p => p.id !== profiles[0]?.id && !newTravelers.includes(p.id)).length > 0 && !showAddTraveler && (
                    <button
                      onClick={() => setShowAddTraveler(true)}
                      style={{ fontSize: 13, color: '#888888', textDecoration: 'underline', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                    >
                      + Add someone
                    </button>
                  )}
                  {/* Create a brand-new traveler profile */}
                  <button
                    onClick={() => { setAddingTravelerForWorkspace(true); setShowAddProfile(true); }}
                    style={{ fontSize: 13, color: '#888888', textDecoration: 'underline', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                  >
                    + New traveler
                  </button>
                </div>
              </div>
            </div>

            {workspaceError && (
              <p style={{ fontSize: 12, color: '#B5654A', marginTop: 12 }}>{workspaceError}</p>
            )}

            <button
              onClick={createWorkspace}
              disabled={!newName.trim() || !newDest.trim() || creatingWorkspace}
              style={{ background: '#2C3E50', color: '#fff', textAlign: 'center', fontSize: 15, fontWeight: 600, padding: 15, borderRadius: 999, marginTop: 28, width: 220, border: 'none', cursor: newName.trim() && newDest.trim() && !creatingWorkspace ? 'pointer' : 'not-allowed', opacity: !newName.trim() || !newDest.trim() || creatingWorkspace ? 0.6 : 1, display: 'block' }}
            >
              {creatingWorkspace ? 'Creating…' : "Let's go →"}
            </button>
          </div>
        </div>
      )}

      {/* Delete workspace confirm */}
      {deleteWorkspaceId && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className={`${modalCls} rounded-xl border w-full max-w-sm p-6`}>
            <h2 className="text-lg font-semibold text-[#2C3E50] mb-2">Delete Experience?</h2>
            <p className="text-[#888888] text-sm mb-4">
              This will permanently delete &quot;{workspaces.find((w) => w.id === deleteWorkspaceId)?.name}&quot; and all its searches.
            </p>
            <div className="flex gap-2 justify-end">
              <button className={`px-4 py-2 text-sm rounded ${btnSecondary}`} onClick={() => setDeleteWorkspaceId(null)}>Cancel</button>
              <button className="px-4 py-2 text-sm rounded bg-red-600 text-white hover:bg-red-500" onClick={() => deleteWorkspace(deleteWorkspaceId)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete profile confirm */}
      {deleteProfileId && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className={`${modalCls} rounded-xl border w-full max-w-sm p-6`}>
            <h2 className="text-lg font-semibold text-[#2C3E50] mb-2">Remove Traveler?</h2>
            <p className="text-[#888888] text-sm mb-4">
              Remove &quot;{profiles.find((p) => p.id === deleteProfileId)?.name}&quot; from your profiles?
            </p>
            <div className="flex gap-2 justify-end">
              <button className={`px-4 py-2 text-sm rounded ${btnSecondary}`} onClick={() => setDeleteProfileId(null)}>Cancel</button>
              <button className="px-4 py-2 text-sm rounded bg-red-600 text-white hover:bg-red-500" onClick={() => deleteProfile(deleteProfileId)}>Remove</button>
            </div>
          </div>
        </div>
      )}

      {/* Profile editor */}
      {editingProfile && !calibratingProfile && (() => {
        const activeWs = workspaces.find(w => w.id === activeWorkspaceId);
        const wsProfiles = activeWs
          ? (activeWs.travelers ?? []).map(id => profiles.find(p => p.id === id)).filter((p): p is Profile => !!p && p.id !== editingProfile.id)
          : undefined;
        return (
          <ProfileEditor
            profile={editingProfile}
            onSave={handleProfileSaved}
            onClose={() => setEditingProfile(null)}
            onRetakeAssessment={() => { setEditingProfile(null); setShowAddProfile(true); }}
            onCalibrate={() => setCalibratingProfile(editingProfile)}
            workspaceProfiles={wsProfiles && wsProfiles.length > 0 ? wsProfiles : undefined}
          />
        );
      })()}

      {/* Calibration modal (Entry Point 2 — from ProfileEditor) */}
      {calibratingProfile && (() => {
        const typeNum = parseInt(calibratingProfile.enneagramType ?? "1", 10);
        const arch = CORE_ARCHETYPES[typeNum];
        if (!arch) return null;
        const scores = Array(10).fill(0) as number[];
        scores[typeNum] = 3;
        const originalResult: AssessmentResult = {
          ...arch,
          typeScores: scores,
          topAxes: getTopAxes(arch.axisWeights),
          confidence: "medium",
          runnerUpTypes: [],
        };
        return (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-[#FAF8F5] border border-[#E8E8E8] rounded-2xl w-full max-w-md shadow-xl overflow-hidden" style={{ minHeight: 480 }}>
              <div className="px-6 pt-5 pb-0 border-b border-[#E8E8E8] flex items-center justify-between">
                <span className="text-sm font-semibold text-[#2C3E50]">Refine your style</span>
                <button className="text-[#888888] hover:text-[#888888] text-2xl leading-none" onClick={() => setCalibratingProfile(null)}>×</button>
              </div>
              <CalibrationAssessment
                calibrationPath="fresh"
                originalResult={originalResult}
                onComplete={(newResult, meta) => handleCalibrationComplete(calibratingProfile, newResult, meta)}
                onSkip={() => setCalibratingProfile(null)}
                ctaLabel="Update my style →"
              />
            </div>
          </div>
        );
      })()}

      {/* Add profile modal */}
      {showAddProfile && (
        <AddProfileModal
          onSave={handleProfileSaved}
          onClose={() => setShowAddProfile(false)}
          workspaceId={activeWorkspaceId ?? workspaces[0]?.id ?? undefined}
        />
      )}

      {/* Fit legend modal */}
      {showFitLegend && <FitLegendModal onClose={() => setShowFitLegend(false)} />}

      {/* Settings modal */}
      {showSettings && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowSettings(false)}
        >
          <div
            className="bg-[#FAF8F5] border border-[#E8E8E8] rounded-2xl w-full max-w-sm shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#E8E8E8]">
              <h2 style={{ fontFamily: 'var(--font-noto-serif), Georgia, ui-serif, serif', fontWeight: 600, fontSize: 18, color: '#2C3E50' }}>
                Settings
              </h2>
              <button
                className="text-[#888888] hover:text-[#2C3E50] text-2xl leading-none transition-colors"
                onClick={() => setShowSettings(false)}
              >
                ×
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Account */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#888888] mb-3">Account</p>
                {user?.email && (
                  <p className="text-sm text-[#2C3E50] mb-3">{user.email}</p>
                )}
                <button
                  className="text-sm text-[#888888] hover:text-red-500 transition-colors"
                  onClick={() => { setShowSettings(false); logout(); }}
                >
                  Log out →
                </button>
              </div>

              {/* App */}
              <div className="border-t border-[#E8E8E8] pt-5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#888888] mb-3">App</p>
                <button
                  className="text-sm text-[#2C3E50] hover:text-[#C4956A] transition-colors block"
                  onClick={() => { setShowSettings(false); setShowFitLegend(true); }}
                >
                  What do fit scores mean? →
                </button>
                <p className="text-xs text-[#888888] mt-3">Version 2.0</p>
              </div>

              {/* Legal */}
              <div className="border-t border-[#E8E8E8] pt-5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#888888] mb-3">Legal</p>
                <div className="space-y-2">
                  <a
                    href="/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-sm text-[#888888] hover:text-[#2C3E50] transition-colors"
                  >
                    Privacy Policy ↗
                  </a>
                  <a
                    href="/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-sm text-[#888888] hover:text-[#2C3E50] transition-colors"
                  >
                    Terms of Service ↗
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Product tour */}
      {showTour && <DashboardTour onDone={handleTourDone} />}
    </div>
  );
}
