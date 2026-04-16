"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { reports, type CreateReportPayload, type ReportRecord } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type PortalHistoryEntry = ReportRecord;
type PortalHistoryInput = CreateReportPayload;

type PortalHistoryContextValue = {
  entries: PortalHistoryEntry[];
  hydrated: boolean;
  addEntry: (entry: PortalHistoryInput) => Promise<void>;
  removeEntry: (id: number) => Promise<void>;
  clearEntries: () => Promise<void>;
};

const PortalHistoryContext = createContext<PortalHistoryContextValue | null>(null);

export function PortalHistoryProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [entries, setEntries] = useState<PortalHistoryEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (loading) {
      return;
    }

    let cancelled = false;

    async function loadReports() {
      if (!user) {
        if (!cancelled) {
          setEntries([]);
          setHydrated(true);
        }
        return;
      }

      if (!cancelled) {
        setHydrated(false);
      }

      try {
        const nextEntries = await reports.list();
        if (!cancelled) {
          setEntries(nextEntries);
        }
      } catch {
        if (!cancelled) {
          setEntries([]);
        }
      } finally {
        if (!cancelled) {
          setHydrated(true);
        }
      }
    }

    void loadReports();

    return () => {
      cancelled = true;
    };
  }, [loading, user]);

  const addEntry = useCallback(async (entry: PortalHistoryInput) => {
    if (!user) {
      return;
    }

    try {
      const createdEntry = await reports.create(entry);
      setEntries((current) => [createdEntry, ...current]);
    } catch (error) {
      const reportError = error as { detail?: string; status?: number; body?: unknown };
      console.error("[PortalHistory] Failed to save report:", {
        status: reportError?.status,
        detail: reportError?.detail,
        body: reportError?.body,
      });
      toast.error(reportError?.detail ?? "Failed to save report");
    }
  }, [user]);

  const removeEntry = useCallback(async (id: number) => {
    try {
      await reports.remove(id);
      setEntries((current) => current.filter((entry) => entry.id !== id));
    } catch (error) {
      const reportError = error as { detail?: string; status?: number; body?: unknown };
      console.error("[PortalHistory] Failed to delete report:", {
        status: reportError?.status,
        detail: reportError?.detail,
        body: reportError?.body,
      });
      toast.error(reportError?.detail ?? "Failed to delete report");
    }
  }, []);

  const clearEntries = useCallback(async () => {
    try {
      await reports.clear();
      setEntries([]);
    } catch (error) {
      const reportError = error as { detail?: string; status?: number; body?: unknown };
      console.error("[PortalHistory] Failed to clear reports:", {
        status: reportError?.status,
        detail: reportError?.detail,
        body: reportError?.body,
      });
      toast.error(reportError?.detail ?? "Failed to clear reports");
    }
  }, []);

  const value = useMemo(
    () => ({
      entries,
      hydrated,
      addEntry,
      removeEntry,
      clearEntries,
    }),
    [addEntry, clearEntries, entries, hydrated, removeEntry]
  );

  return (
    <PortalHistoryContext.Provider value={value}>
      {children}
    </PortalHistoryContext.Provider>
  );
}

export function usePortalHistory() {
  const context = useContext(PortalHistoryContext);

  if (!context) {
    throw new Error("usePortalHistory must be used within PortalHistoryProvider");
  }

  return context;
}
