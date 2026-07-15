"use client";

import { useEffect, useState } from "react";
import { Profile, TripWorkspace } from "@/types";
import WorkspaceView from "@/components/WorkspaceView";
import ProfileEditor from "@/components/ProfileEditor";
import AddProfileModal from "@/components/AddProfileModal";
import FitLegendModal from "@/components/FitLegendModal";
import TravelAssessment from "@/components/TravelAssessment";
import { AssessmentResult } from "@/lib/assessment";
import { useTheme } from "@/lib/useTheme";
import { useAuth } from "@/lib/AuthContext";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import DashboardTour from "@/components/DashboardTour";
import { useTourState } from "@/lib/useTourState";
import { CATEGORY_META } from "@/lib/categories";

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
  const [activeSearchId, setActiveSearchId] = useState<string | null>(null);
  const [deleteWorkspaceId, setDeleteWorkspaceId] = useState<string | null>(null);
  const [deleteProfileId, setDeleteProfileId] = useState<string | null>(null);
  const [showFitLegend, setShowFitLegend] = useState(false);
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
      if (ps.length > 0) setNewTravelers([ps[0].id]);
      setProfilesLoaded(true);
    });
    fetchWithAuth("/api/workspaces").then((r) => r.json()).then((ws: TripWorkspace[]) => {
      if (!Array.isArray(ws)) return;
      setWorkspaces(ws);
      if (ws.length > 0) setActiveWorkspaceId(ws[0].id);
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

  async function createWorkspace() {
    if (!newName.trim()) return;
    setCreatingWorkspace(true);
    const travelers = newTravelers.length > 0 ? newTravelers : [profiles[0]?.id].filter(Boolean);
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
        setWorkspaceError(`Failed to create trip (${res.status}). Please try again.`);
        return;
      }
      const ws: TripWorkspace = await res.json();
      setWorkspaceError("");
      setWorkspaces((prev) => [ws, ...prev]);
      setActiveWorkspaceId(ws.id);
      setShowNewWorkspace(false);
      setNewName("");
      setNewDest("");


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
    setEditingProfile(null);
    setShowAddProfile(false);
  }

  function toggleTraveler(id: string) {
    setNewTravelers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const inputCls = "bg-[#EEF4F8] dark:bg-[#2a3f52] text-[#2C3E50] dark:text-[#B8D4E3] border-[#E0E8ED] dark:border-[#3D5A6E] focus:border-[#5B8BA0]";
  const btnSecondary = "bg-[#E0E8ED] dark:bg-[#3D5A6E] text-[#3D5A6E] dark:text-[#B8D4E3] hover:bg-[#D0DCE4] dark:hover:bg-[#4A7A8F]";
  const modalCls = "bg-white dark:bg-[#1e2d3d] border-[#E0E8ED] dark:border-[#3D5A6E]";

  // Still fetching
  if (!profilesLoaded) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#F8FAFB] dark:bg-[#0f1923] text-[#6B8299] dark:text-[#9BB0C1]">
        Loading…
      </div>
    );
  }

  // First-run: no profiles yet — show full-screen assessment
  if (profilesLoaded && profiles.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F8FAFB] dark:bg-[#0f1923] p-4">
        <div className="w-full max-w-md bg-white dark:bg-[#1e2d3d] border border-[#E0E8ED] dark:border-[#3D5A6E] rounded-2xl shadow-xl overflow-hidden">
          <div className="px-6 pt-6 pb-0 border-b border-[#E0E8ED] dark:border-[#2a3f52]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-[#2C3E50] dark:text-white">ViyaWay</span>
              <span className="text-xs text-[#9BB0C1] dark:text-[#6B8299]">Welcome</span>
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
          <AddProfileModal isSelf onSave={handleProfileSaved} onClose={() => setShowAddProfile(false)} />
        )}
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#F8FAFB] dark:bg-[#0f1923] text-[#2C3E50] dark:text-[#B8D4E3] overflow-hidden">
      {/* Mobile backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar — fixed drawer on mobile, static column on desktop */}
      <div className={`${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 transition-transform duration-200 ease-in-out fixed md:relative inset-y-0 left-0 z-50 w-72 md:w-56 flex-shrink-0 bg-white dark:bg-[#1e2d3d] border-r border-[#E0E8ED] dark:border-[#2a3f52] flex flex-col`}>
        {/* App header */}
        <div className="flex items-start justify-between px-4 py-4 border-b border-[#E0E8ED] dark:border-[#2a3f52]">
          <div>
            <h1 className="text-sm font-bold tracking-tight text-[#3D5A6E] dark:text-white">ViyaWay</h1>
            <p className="text-xs text-[#3D5A6E] dark:text-[#9BB0C1] mt-0.5">Travel that fits who you are.</p>
            <button
              id="tour-trigger"
              className="text-xs text-[#5B8BA0] hover:underline mt-1"
              onClick={() => setShowTour(true)}
            >
              Take a tour
            </button>
          </div>
          <button
            className="md:hidden text-[#9BB0C1] hover:text-[#3D5A6E] dark:hover:text-white text-xl leading-none mt-0.5 transition-colors"
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
              className="w-full flex items-center justify-between px-4 py-2 text-xs text-[#6B8299] uppercase font-medium tracking-wide hover:text-[#3D5A6E] dark:hover:text-[#B8D4E3] transition-colors"
              onClick={() => setProfilesOpen((o) => !o)}
            >
              <span>Travelers</span>
              <span className="flex items-center gap-1">
                <span
                  id="tour-add-traveler"
                  className="text-[#9BB0C1] hover:text-[#2C3E50] dark:hover:text-white transition-colors"
                  onClick={(e) => { e.stopPropagation(); setShowAddProfile(true); }}
                  title="Add traveler"
                >
                  +
                </span>
                <span className="text-[#9BB0C1] dark:text-[#6B8299]">{profilesOpen ? "▴" : "▾"}</span>
              </span>
            </button>

            {profilesOpen && (
              <div className="px-2 pb-2">
                {/* Defensive filter: a malformed entry (e.g. an error payload that
                    slipped through a failed API call) should never crash this list */}
                {profiles.filter((p) => p && typeof p.name === "string" && p.name.length > 0).map((p) => (
                  <div
                    key={p.id}
                    className="group flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-[#EEF4F8] dark:hover:bg-[#2a3f52] transition-colors"
                    onClick={() => setEditingProfile(p)}
                  >
                    <div className="w-6 h-6 rounded-full bg-[#5B8BA0] flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                      {p.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[#3D5A6E] dark:text-[#B8D4E3] truncate">{p.name}</p>
                      <p className="text-xs text-[#6B8299] dark:text-[#6B8299]">Type {p.enneagramType}</p>
                    </div>
                    {!p.isDefault && (
                      <button
                        className="opacity-0 group-hover:opacity-100 text-[#9BB0C1] dark:text-[#6B8299] hover:text-red-500 dark:hover:text-red-400 text-xs transition-all"
                        onClick={(e) => { e.stopPropagation(); setDeleteProfileId(p.id); }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-[#E0E8ED] dark:border-[#2a3f52] mx-4" />

          {/* Trips section */}
          <div id="tour-trips" className="flex items-center justify-between px-4 pt-3 pb-2">
            <span className="text-xs text-[#6B8299] uppercase font-medium tracking-wide">Trips</span>
            <button
              id="tour-create-trip"
              className="text-[#9BB0C1] hover:text-[#2C3E50] dark:hover:text-white text-sm transition-colors"
              onClick={() => setShowNewWorkspace(true)}
              title="New Trip"
            >
              +
            </button>
          </div>

          <div className="px-2">
            {workspaces.length === 0 ? (
              <p className="text-xs text-[#9BB0C1] dark:text-[#6B8299] px-2 py-1">No trips yet</p>
            ) : (
              workspaces.map((w) => {
                const primaryProfile = profiles.find((p) => p.id === (w.travelers ?? [])[0]);
                const extraCount = (w.travelers?.length ?? 1) - 1;
                return (
                  <div key={w.id}>
                    {/* Trip row */}
                    <div
                      className={`group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer mb-0.5 transition-colors ${
                        w.id === activeWorkspaceId
                          ? "bg-[#5B8BA0]/10 dark:bg-[#5B8BA0]/20 text-[#5B8BA0] dark:text-[#7DBAD4]"
                          : "text-[#6B8299] dark:text-[#9BB0C1] hover:bg-[#EEF4F8] dark:hover:bg-[#2a3f52]"
                      }`}
                      onClick={() => setActiveWorkspaceId(w.id)}
                    >
                      <span className="text-sm">📁</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{w.name}</p>
                        <p className="text-xs text-[#6B8299] dark:text-[#6B8299] truncate">
                          {primaryProfile?.name ?? ""}
                          {extraCount > 0 ? ` +${extraCount}` : ""}
                          {w.destination ? ` · ${w.destination}` : ""}
                        </p>
                      </div>
                      <button
                        className="opacity-0 group-hover:opacity-100 text-[#9BB0C1] dark:text-[#6B8299] hover:text-red-500 dark:hover:text-red-400 text-xs transition-all"
                        onClick={(e) => { e.stopPropagation(); setDeleteWorkspaceId(w.id); }}
                      >
                        ×
                      </button>
                    </div>

                    {/* Search sub-list — only under the active workspace */}
                    {w.id === activeWorkspaceId && w.searches.length > 0 && (
                      <div className="ml-4 mb-1 border-l border-[#E0E8ED] dark:border-[#2a3f52] pl-2 space-y-0.5">
                        {w.searches.map((s) => {
                          const meta = CATEGORY_META[s.category] ?? { icon: "🔍", label: s.category, hint: "" };
                          const isActive = s.id === activeSearchId;
                          return (
                            <button
                              key={s.id}
                              className={`w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-left transition-colors text-xs ${
                                isActive
                                  ? "bg-[#5B8BA0]/10 dark:bg-[#5B8BA0]/20 text-[#5B8BA0] dark:text-[#7DBAD4] font-medium"
                                  : "text-[#6B8299] dark:text-[#9BB0C1] hover:bg-[#EEF4F8] dark:hover:bg-[#2a3f52]"
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveSearchId(s.id);
                                setMobileMenuOpen(false);
                              }}
                            >
                              <span className="flex-shrink-0">{meta.icon}</span>
                              <span className="truncate flex-1">{s.query}</span>
                              <span className="flex-shrink-0 text-[#9BB0C1] dark:text-[#6B8299]">
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

        <div className="px-4 pt-3 pb-4 border-t border-[#E0E8ED] dark:border-[#2a3f52] space-y-3">
          {/* Utility */}
          <button
            className="text-xs text-[#9BB0C1] dark:text-[#6B8299] hover:text-[#5B8BA0] dark:hover:text-[#7DBAD4] transition-colors w-full text-left"
            onClick={() => setShowFitLegend(true)}
          >
            What do fit scores mean?
          </button>
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#9BB0C1] dark:text-[#6B8299]">v2.0</p>
            <div className="flex items-center gap-3">
              <button
                className="text-xs text-[#6B8299] hover:text-[#3D5A6E] dark:hover:text-[#B8D4E3] transition-colors"
                onClick={toggle}
                title={dark ? "Switch to light mode" : "Switch to night mode"}
              >
                {dark ? "☀ Light" : "☾ Night"}
              </button>
              <button
                className="text-xs text-[#9BB0C1] hover:text-red-500 transition-colors"
                onClick={logout}
                title="Log out"
              >
                Log out
              </button>
            </div>
          </div>

          {/* Legal */}
          <div className="border-t border-[#E0E8ED] dark:border-[#2a3f52] pt-3 space-y-1.5">
            <p className="text-[10px] text-[#9BB0C1] dark:text-[#6B8299] uppercase tracking-wider font-medium">Legal</p>
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="block text-xs text-[#6B8299] dark:text-[#9BB0C1] hover:text-[#5B8BA0] dark:hover:text-[#7DBAD4] transition-colors">Privacy Policy ↗</a>
            <a href="/terms" target="_blank" rel="noopener noreferrer" className="block text-xs text-[#6B8299] dark:text-[#9BB0C1] hover:text-[#5B8BA0] dark:hover:text-[#7DBAD4] transition-colors">Terms of Service ↗</a>
            {/* <a href="/affiliate-disclosure" target="_blank" rel="noopener noreferrer" className="block text-xs text-[#6B8299] dark:text-[#9BB0C1] hover:text-[#5B8BA0] dark:hover:text-[#7DBAD4] transition-colors">How We Make Money ↗</a> */}
          </div>

          {/* <p className="text-[10px] text-[#9BB0C1] dark:text-[#6B8299] leading-relaxed border-t border-[#E0E8ED] dark:border-[#2a3f52] pt-2.5">
            ViyaWay may earn a commission from bookings. This doesn&apos;t affect our recommendations.
          </p> */}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Mobile top bar — hamburger + current trip name */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-white dark:bg-[#1e2d3d] border-b border-[#E0E8ED] dark:border-[#2a3f52] flex-shrink-0">
          <button
            className="text-[#3D5A6E] dark:text-[#B8D4E3] text-xl leading-none"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open menu"
          >
            ☰
          </button>
          <span className="text-sm font-bold text-[#3D5A6E] dark:text-white">ViyaWay</span>
          {activeWorkspace && (
            <span className="text-sm text-[#6B8299] dark:text-[#9BB0C1] truncate">· {activeWorkspace.name}</span>
          )}
        </div>
        <div className="flex-1 overflow-hidden">
        {activeWorkspace && travelerProfiles.length > 0 ? (
          <WorkspaceView
            key={activeWorkspace.id}
            workspace={activeWorkspace}
            travelers={travelerProfiles}
            onChange={handleWorkspaceChange}
            onProfileUpdate={handleProfileUpdate}
            onOpenProfile={travelerProfiles[0] ? () => setEditingProfile(travelerProfiles[0]) : undefined}
            activeSearchId={activeSearchId}
            onSearchChange={setActiveSearchId}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-[#6B8299]">
            <div className="text-6xl mb-4">🗺️</div>
            <p className="text-lg font-medium text-[#3D5A6E] dark:text-[#B8D4E3]">Where are you thinking of going?</p>
            <p className="text-sm mt-1">Tell us a destination — we&apos;ll find what fits you.</p>
            <button
              className="mt-4 px-4 py-2 bg-[#5B8BA0] text-white rounded hover:bg-[#4A7A8F] text-sm"
              onClick={() => setShowNewWorkspace(true)}
            >
              + New Trip
            </button>
          </div>
        )}
        </div>
      </div>

      {/* New workspace modal */}
      {showNewWorkspace && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className={`${modalCls} rounded-xl border w-full max-w-sm p-6`}>
            <h2 className="text-lg font-semibold text-[#2C3E50] dark:text-white mb-4">New Trip</h2>
            <div className="space-y-3">
              <div>
                <label className="text-[#6B8299] text-xs uppercase block mb-1">Trip Name</label>
                <input
                  className={`w-full ${inputCls} text-sm rounded border px-3 py-2 focus:outline-none`}
                  placeholder="e.g. Tuscany 2026"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createWorkspace()}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-[#6B8299] text-xs uppercase block mb-1">Destination</label>
                <input
                  className={`w-full ${inputCls} text-sm rounded border px-3 py-2 focus:outline-none`}
                  placeholder="e.g. Tuscany, Italy"
                  value={newDest}
                  onChange={(e) => setNewDest(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createWorkspace()}
                />
              </div>
              {profiles.length > 1 && (
                <div>
                  <label className="text-[#6B8299] text-xs uppercase block mb-2">Traveling With</label>
                  <div className="flex flex-wrap gap-2">
                    {profiles.map((p) => (
                      <button
                        key={p.id}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs border transition-colors ${
                          newTravelers.includes(p.id)
                            ? "border-[#5B8BA0] bg-[#5B8BA0]/8 dark:bg-[#5B8BA0]/15 text-[#5B8BA0] dark:text-[#7DBAD4]"
                            : "border-[#E0E8ED] dark:border-[#3D5A6E] text-[#6B8299] dark:text-[#9BB0C1] hover:border-[#9BB0C1] dark:hover:border-[#9BB0C1]"
                        }`}
                        onClick={() => toggleTraveler(p.id)}
                      >
                        <span className="w-4 h-4 rounded-full bg-[#5B8BA0] flex items-center justify-center text-xs font-bold text-white">
                          {p.name[0]}
                        </span>
                        {p.name}
                      </button>
                    ))}
                  </div>
                  <p className="text-[#6B8299] dark:text-[#6B8299] text-xs mt-1">Results scored against first selected traveler</p>
                </div>
              )}
            </div>
            {workspaceError && (
              <p className="text-red-500 text-xs mt-3">{workspaceError}</p>
            )}
            <div className="flex gap-2 justify-end mt-4">
              <button
                className={`px-4 py-2 text-sm rounded ${btnSecondary}`}
                onClick={() => { setShowNewWorkspace(false); setWorkspaceError(""); }}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 text-sm rounded bg-[#5B8BA0] text-white hover:bg-[#4A7A8F] disabled:opacity-50"
                onClick={createWorkspace}
                disabled={!newName.trim() || creatingWorkspace}
              >
                {creatingWorkspace ? "Creating…" : "Create Trip"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete workspace confirm */}
      {deleteWorkspaceId && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className={`${modalCls} rounded-xl border w-full max-w-sm p-6`}>
            <h2 className="text-lg font-semibold text-[#2C3E50] dark:text-white mb-2">Delete Trip?</h2>
            <p className="text-[#6B8299] dark:text-[#9BB0C1] text-sm mb-4">
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
            <h2 className="text-lg font-semibold text-[#2C3E50] dark:text-white mb-2">Remove Traveler?</h2>
            <p className="text-[#6B8299] dark:text-[#9BB0C1] text-sm mb-4">
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
      {editingProfile && (
        <ProfileEditor
          profile={editingProfile}
          onSave={handleProfileSaved}
          onClose={() => setEditingProfile(null)}
          onRetakeAssessment={() => { setEditingProfile(null); setShowAddProfile(true); }}
        />
      )}

      {/* Add profile modal */}
      {showAddProfile && (
        <AddProfileModal
          onSave={handleProfileSaved}
          onClose={() => setShowAddProfile(false)}
        />
      )}

      {/* Fit legend modal */}
      {showFitLegend && <FitLegendModal onClose={() => setShowFitLegend(false)} />}

      {/* Product tour */}
      {showTour && <DashboardTour onDone={handleTourDone} />}
    </div>
  );
}
