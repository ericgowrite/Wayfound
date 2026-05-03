"use client";

import { useEffect, useState } from "react";
import { Profile, TripWorkspace } from "@/types";
import WorkspaceView from "@/components/WorkspaceView";
import ProfileEditor from "@/components/ProfileEditor";

export default function Home() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [workspaces, setWorkspaces] = useState<TripWorkspace[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [showNewWorkspace, setShowNewWorkspace] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDest, setNewDest] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/profile").then((r) => r.json()).then(setProfile);
    fetch("/api/workspaces").then((r) => r.json()).then((ws: TripWorkspace[]) => {
      setWorkspaces(ws);
      if (ws.length > 0) setActiveId(ws[0].id);
    });
  }, []);

  const activeWorkspace = workspaces.find((w) => w.id === activeId) ?? null;

  async function createWorkspace() {
    if (!newName.trim()) return;
    const res = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, destination: newDest }),
    });
    const ws: TripWorkspace = await res.json();
    setWorkspaces((prev) => [ws, ...prev]);
    setActiveId(ws.id);
    setShowNewWorkspace(false);
    setNewName("");
    setNewDest("");
  }

  async function deleteWorkspace(id: string) {
    await fetch(`/api/workspaces/${id}`, { method: "DELETE" });
    const updated = workspaces.filter((w) => w.id !== id);
    setWorkspaces(updated);
    if (activeId === id) setActiveId(updated[0]?.id ?? null);
    setDeleteConfirmId(null);
  }

  function handleWorkspaceChange(updated: TripWorkspace) {
    setWorkspaces((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-950 text-gray-400">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden">
      {/* Sidebar */}
      <div className="w-56 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="px-4 py-4 border-b border-gray-800">
          <h1 className="text-sm font-semibold text-white">WanderWell</h1>
          <p className="text-xs text-gray-500 mt-0.5">Personal Travel Search</p>
        </div>

        <div
          className="mx-3 mt-3 flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-700 transition-colors"
          onClick={() => setShowProfileEditor(true)}
        >
          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white">
            {profile.name[0]}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-white truncate">{profile.name}</p>
            <p className="text-xs text-gray-400">Type {profile.type}</p>
          </div>
          <span className="text-gray-500 text-xs ml-auto">⚙</span>
        </div>

        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <span className="text-xs text-gray-500 uppercase font-medium tracking-wide">Trips</span>
          <button
            className="text-gray-400 hover:text-white text-sm transition-colors"
            onClick={() => setShowNewWorkspace(true)}
            title="New Trip"
          >
            +
          </button>
        </div>

        <div className="flex-1 overflow-auto px-2">
          {workspaces.length === 0 ? (
            <p className="text-xs text-gray-600 px-2">No trips yet</p>
          ) : (
            workspaces.map((w) => (
              <div
                key={w.id}
                className={`group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer mb-0.5 transition-colors ${
                  w.id === activeId ? "bg-blue-900/40 text-blue-300" : "text-gray-400 hover:bg-gray-800"
                }`}
                onClick={() => setActiveId(w.id)}
              >
                <span className="text-sm">📁</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{w.name}</p>
                  <p className="text-xs text-gray-600 truncate">{w.destination}</p>
                </div>
                <button
                  className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 text-xs transition-all"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteConfirmId(w.id);
                  }}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>

        <div className="px-4 py-3 border-t border-gray-800">
          <p className="text-xs text-gray-600">v1.0</p>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        {activeWorkspace ? (
          <WorkspaceView
            workspace={activeWorkspace}
            profileWeights={profile.axisWeights}
            onChange={handleWorkspaceChange}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <div className="text-6xl mb-4">🗺️</div>
            <p className="text-lg font-medium text-gray-300">Start planning a trip</p>
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

      {showNewWorkspace && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold text-white mb-4">New Trip</h2>
            <div className="space-y-3">
              <div>
                <label className="text-gray-500 text-xs uppercase block mb-1">Trip Name</label>
                <input
                  className="w-full bg-gray-800 text-gray-200 text-sm rounded border border-gray-700 px-3 py-2 focus:outline-none focus:border-blue-500"
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
                  className="w-full bg-gray-800 text-gray-200 text-sm rounded border border-gray-700 px-3 py-2 focus:outline-none focus:border-blue-500"
                  placeholder="Tuscany, Italy"
                  value={newDest}
                  onChange={(e) => setNewDest(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createWorkspace()}
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button
                className="px-4 py-2 text-sm rounded bg-gray-700 text-gray-200 hover:bg-gray-600"
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

      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold text-white mb-2">Delete Trip?</h2>
            <p className="text-gray-400 text-sm mb-4">
              This will permanently delete &quot;{workspaces.find((w) => w.id === deleteConfirmId)?.name}&quot;
              and all its searches.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                className="px-4 py-2 text-sm rounded bg-gray-700 text-gray-200 hover:bg-gray-600"
                onClick={() => setDeleteConfirmId(null)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 text-sm rounded bg-red-600 text-white hover:bg-red-500"
                onClick={() => deleteWorkspace(deleteConfirmId)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showProfileEditor && (
        <ProfileEditor
          profile={profile}
          onSave={(p) => {
            setProfile(p);
            setShowProfileEditor(false);
          }}
          onClose={() => setShowProfileEditor(false)}
        />
      )}
    </div>
  );
}
