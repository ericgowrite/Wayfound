"use client";

import { useEffect, useState } from "react";
import { Profile, TripWorkspace } from "@/types";
import WorkspaceView from "@/components/WorkspaceView";
import ProfileEditor from "@/components/ProfileEditor";
import AddProfileModal from "@/components/AddProfileModal";
import { useTheme } from "@/lib/useTheme";

export default function Home() {
  const { dark, toggle } = useTheme();
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
  const [profilesOpen, setProfilesOpen] = useState(true);

  useEffect(() => {
    fetch("/api/profiles").then((r) => r.json()).then((ps: Profile[]) => {
      setProfiles(ps);
      if (ps.length > 0) setNewTravelers([ps[0].id]);
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

  const inputCls = "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-700 focus:border-blue-500";
  const btnSecondary = "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600";
  const modalCls = "bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700";

  if (profiles.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-950 text-gray-500 dark:text-gray-400">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 overflow-hidden">
      {/* Sidebar */}
      <div className="w-56 flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col">
        {/* App header */}
        <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-800">
          <h1 className="text-sm font-semibold text-gray-900 dark:text-white">Spectral</h1>
          <p className="text-xs text-gray-500 mt-0.5">Personal Travel Search</p>
        </div>

        <div className="flex-1 overflow-auto">
          {/* Profiles section */}
          <div className="mt-2">
            <button
              className="w-full flex items-center justify-between px-4 py-2 text-xs text-gray-500 uppercase font-medium tracking-wide hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              onClick={() => setProfilesOpen((o) => !o)}
            >
              <span>Travelers</span>
              <span className="flex items-center gap-1">
                <span
                  className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                  onClick={(e) => { e.stopPropagation(); setShowAddProfile(true); }}
                  title="Add traveler"
                >
                  +
                </span>
                <span className="text-gray-400 dark:text-gray-600">{profilesOpen ? "▴" : "▾"}</span>
              </span>
            </button>

            {profilesOpen && (
              <div className="px-2 pb-2">
                {profiles.map((p) => (
                  <div
                    key={p.id}
                    className="group flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    onClick={() => setEditingProfile(p)}
                  >
                    <div className="w-6 h-6 rounded-full bg-blue-700 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                      {p.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{p.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-600">Type {p.enneagramType}</p>
                    </div>
                    {!p.isDefault && (
                      <button
                        className="opacity-0 group-hover:opacity-100 text-gray-400 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 text-xs transition-all"
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
          <div className="border-t border-gray-200 dark:border-gray-800 mx-4" />

          {/* Trips section */}
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <span className="text-xs text-gray-500 uppercase font-medium tracking-wide">Trips</span>
            <button
              className="text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm transition-colors"
              onClick={() => setShowNewWorkspace(true)}
              title="New Trip"
            >
              +
            </button>
          </div>

          <div className="px-2">
            {workspaces.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-600 px-2 py-1">No trips yet</p>
            ) : (
              workspaces.map((w) => {
                const primaryProfile = profiles.find((p) => p.id === w.travelers[0]);
                const extraCount = w.travelers.length - 1;
                return (
                  <div
                    key={w.id}
                    className={`group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer mb-0.5 transition-colors ${
                      w.id === activeWorkspaceId
                        ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`}
                    onClick={() => setActiveWorkspaceId(w.id)}
                  >
                    <span className="text-sm">📁</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{w.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-600 truncate">
                        {primaryProfile?.name ?? ""}
                        {extraCount > 0 ? ` +${extraCount}` : ""}
                        {w.destination ? ` · ${w.destination}` : ""}
                      </p>
                    </div>
                    <button
                      className="opacity-0 group-hover:opacity-100 text-gray-400 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 text-xs transition-all"
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

        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <p className="text-xs text-gray-400 dark:text-gray-600">v2.0</p>
          <button
            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            onClick={toggle}
            title={dark ? "Switch to light mode" : "Switch to night mode"}
          >
            {dark ? "☀ Light" : "☾ Night"}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        {activeWorkspace && travelerProfiles.length > 0 ? (
          <WorkspaceView
            workspace={activeWorkspace}
            travelers={travelerProfiles}
            onChange={handleWorkspaceChange}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <div className="text-6xl mb-4">🗺️</div>
            <p className="text-lg font-medium text-gray-700 dark:text-gray-300">Start planning a trip</p>
            <p className="text-sm mt-1">Create a workspace to begin</p>
            <button
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 text-sm"
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
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">New Trip</h2>
            <div className="space-y-3">
              <div>
                <label className="text-gray-500 text-xs uppercase block mb-1">Trip Name</label>
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
                <label className="text-gray-500 text-xs uppercase block mb-1">Destination</label>
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
                  <label className="text-gray-500 text-xs uppercase block mb-2">Traveling With</label>
                  <div className="flex flex-wrap gap-2">
                    {profiles.map((p) => (
                      <button
                        key={p.id}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs border transition-colors ${
                          newTravelers.includes(p.id)
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300"
                            : "border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500"
                        }`}
                        onClick={() => toggleTraveler(p.id)}
                      >
                        <span className="w-4 h-4 rounded-full bg-blue-700 flex items-center justify-center text-xs font-bold text-white">
                          {p.name[0]}
                        </span>
                        {p.name}
                      </button>
                    ))}
                  </div>
                  <p className="text-gray-500 dark:text-gray-600 text-xs mt-1">Results scored against first selected traveler</p>
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
                className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
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
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete Trip?</h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
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
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Remove Traveler?</h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
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
    </div>
  );
}
