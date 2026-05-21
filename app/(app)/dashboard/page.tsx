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

export default function Home() {
  const { dark, toggle } = useTheme();
  const { logout } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [workspaces, setWorkspaces] = useState<TripWorkspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [showAddProfile, setShowAddProfile] = useState(false);
  const [showNewWorkspace, setShowNewWorkspace] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDest, setNewDest] = useState("");
  const [newTravelers, setNewTravelers] = useState<string[]>([]);
  const [deleteWorkspaceId, setDeleteWorkspaceId] = useState<string | null>(null);
  const [deleteProfileId, setDeleteProfileId] = useState<string | null>(null);
  const [showFitLegend, setShowFitLegend] = useState(false);
  const [profilesOpen, setProfilesOpen] = useState(true);
  const [profilesLoaded, setProfilesLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/profiles").then((r) => r.json()).then((ps: Profile[]) => {
      setProfiles(ps);
      if (ps.length > 0) setNewTravelers([ps[0].id]);
      setProfilesLoaded(true);
    });
    fetch("/api/workspaces").then((r) => r.json()).then((ws: TripWorkspace[]) => {
      setWorkspaces(ws);
      if (ws.length > 0) setActiveWorkspaceId(ws[0].id);
    });
  }, []);

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
    const travelers = newTravelers.length > 0 ? newTravelers : [profiles[0]?.id].filter(Boolean);
    const res = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, destination: newDest, travelers }),
    });
    const ws: TripWorkspace = await res.json();
    setWorkspaces((prev) => [ws, ...prev]);
    setActiveWorkspaceId(ws.id);
    setShowNewWorkspace(false);
    setNewName("");
    setNewDest("");
  }

  async function deleteWorkspace(id: string) {
    await fetch(`/api/workspaces/${id}`, { method: "DELETE" });
    const updated = workspaces.filter((w) => w.id !== id);
    setWorkspaces(updated);
    if (activeWorkspaceId === id) setActiveWorkspaceId(updated[0]?.id ?? null);
    setDeleteWorkspaceId(null);
  }

  async function deleteProfile(id: string) {
    await fetch(`/api/profiles/${id}`, { method: "DELETE" });
    setProfiles((prev) => prev.filter((p) => p.id !== id));
    setDeleteProfileId(null);
  }

  function handleWorkspaceChange(updated: TripWorkspace) {
    setWorkspaces((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
  }

  async function handleFirstRunAssessment(result: AssessmentResult, name: string) {
    const typeKey = String(result.type);
    const res = await fetch("/api/profiles", {
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
    const profile: Profile = await res.json();
    setProfiles([profile]);
    setNewTravelers([profile.id]);
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
          <div style={{ minHeight: 520 }}>
            <TravelAssessment
              onComplete={handleFirstRunAssessment}
              onSkip={() => setShowAddProfile(true)}
            />
          </div>
        </div>
        {showAddProfile && (
          <AddProfileModal onSave={handleProfileSaved} onClose={() => setShowAddProfile(false)} />
        )}
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#F8FAFB] dark:bg-[#0f1923] text-[#2C3E50] dark:text-[#B8D4E3] overflow-hidden">
      {/* Sidebar */}
      <div className="w-56 flex-shrink-0 bg-white dark:bg-[#1e2d3d] border-r border-[#E0E8ED] dark:border-[#2a3f52] flex flex-col">
        {/* App header */}
        <div className="px-4 py-4 border-b border-[#E0E8ED] dark:border-[#2a3f52]">
          <h1 className="text-sm font-bold tracking-tight text-[#3D5A6E] dark:text-white">ViyaWay</h1>
          <p className="text-xs text-[#6B8299] mt-0.5">Your true path to travel</p>
        </div>

        <div className="flex-1 overflow-auto">
          {/* Profiles section */}
          <div className="mt-2">
            <button
              className="w-full flex items-center justify-between px-4 py-2 text-xs text-[#6B8299] uppercase font-medium tracking-wide hover:text-[#3D5A6E] dark:hover:text-[#B8D4E3] transition-colors"
              onClick={() => setProfilesOpen((o) => !o)}
            >
              <span>Travelers</span>
              <span className="flex items-center gap-1">
                <span
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
                {profiles.map((p) => (
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
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <span className="text-xs text-[#6B8299] uppercase font-medium tracking-wide">Trips</span>
            <button
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
                const primaryProfile = profiles.find((p) => p.id === w.travelers[0]);
                const extraCount = w.travelers.length - 1;
                return (
                  <div
                    key={w.id}
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
            <a href="/affiliate-disclosure" target="_blank" rel="noopener noreferrer" className="block text-xs text-[#6B8299] dark:text-[#9BB0C1] hover:text-[#5B8BA0] dark:hover:text-[#7DBAD4] transition-colors">How We Make Money ↗</a>
          </div>

          {/* Affiliate disclosure */}
          <p className="text-[10px] text-[#9BB0C1] dark:text-[#6B8299] leading-relaxed border-t border-[#E0E8ED] dark:border-[#2a3f52] pt-2.5">
            ViyaWay may earn a commission from bookings. This doesn&apos;t affect our recommendations.
          </p>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        {activeWorkspace && travelerProfiles.length > 0 ? (
          <WorkspaceView
            key={activeWorkspace.id}
            workspace={activeWorkspace}
            travelers={travelerProfiles}
            onChange={handleWorkspaceChange}
            onProfileUpdate={handleProfileUpdate}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-[#6B8299]">
            <div className="text-6xl mb-4">🗺️</div>
            <p className="text-lg font-medium text-[#3D5A6E] dark:text-[#B8D4E3]">Start planning a trip</p>
            <p className="text-sm mt-1">Create a workspace to begin</p>
            <button
              className="mt-4 px-4 py-2 bg-[#5B8BA0] text-white rounded hover:bg-[#4A7A8F] text-sm"
              onClick={() => setShowNewWorkspace(true)}
            >
              + New Trip
            </button>
          </div>
        )}
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
                  placeholder="Tuscany 2026"
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
                  placeholder="Tuscany, Italy"
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
            <div className="flex gap-2 justify-end mt-4">
              <button
                className={`px-4 py-2 text-sm rounded ${btnSecondary}`}
                onClick={() => setShowNewWorkspace(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 text-sm rounded bg-[#5B8BA0] text-white hover:bg-[#4A7A8F] disabled:opacity-50"
                onClick={createWorkspace}
                disabled={!newName.trim()}
              >
                Create Trip
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
    </div>
  );
}
