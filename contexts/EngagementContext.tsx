import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/expo";
import { API_URL } from "@/lib/api";

export interface EngagementData {
  user_id: string;
  total_conversations: number;
  total_days_active: number;
  current_streak: number;
  longest_streak: number;
  last_active_at: string | null;
  relationship_level: number;
  relationship_xp: number;
  avatar_warmth: number;
  timezone: string;
  birthday: string | null;
  city: string | null;
}

export interface MoodState {
  mood: "present" | "waiting" | "missing" | "lonely" | "new";
  absence_hours: number;
  absence_days: number;
}

export type TimeOfDay = "morning" | "afternoon" | "evening" | "late_night";

export interface Milestone {
  id: string;
  type: string;
  value: string;
  acknowledged: boolean;
  created_at: string;
}

interface EngagementResponse {
  engagement: EngagementData;
  mood_state: MoodState;
  time_of_day: TimeOfDay;
  local_hour: number;
  level: number;
  xp: number;
  xp_for_next_level: number;
  xp_progress_pct: number;
}

interface RitualTodayResponse {
  rituals: Array<{ id: string; type: string; content: string; ai_response: string }>;
  done_types: string[];
  suggestion: string | null;
  time_of_day: TimeOfDay;
}

interface EngagementContextValue {
  engagement: EngagementData | null;
  moodState: MoodState | null;
  timeOfDay: TimeOfDay;
  localHour: number;
  level: number;
  xp: number;
  xpForNextLevel: number;
  xpProgressPct: number;
  milestones: Milestone[];
  ritualSuggestion: string | null;
  ritualDoneTypes: string[];
  loading: boolean;
  refresh: () => Promise<void>;
  acknowledgeMilestone: (id: string) => Promise<void>;
}

const EngagementContext = createContext<EngagementContextValue>({
  engagement: null,
  moodState: null,
  timeOfDay: "afternoon",
  localHour: 12,
  level: 1,
  xp: 0,
  xpForNextLevel: 50,
  xpProgressPct: 0,
  milestones: [],
  ritualSuggestion: null,
  ritualDoneTypes: [],
  loading: true,
  refresh: async () => {},
  acknowledgeMilestone: async () => {},
});

export function useEngagement() {
  return useContext(EngagementContext);
}

export function EngagementProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isSignedIn } = useAuth();
  const [engagement, setEngagement] = useState<EngagementData | null>(null);
  const [moodState, setMoodState] = useState<MoodState | null>(null);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>("afternoon");
  const [localHour, setLocalHour] = useState(12);
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  const [xpForNextLevel, setXpForNextLevel] = useState(50);
  const [xpProgressPct, setXpProgressPct] = useState(0);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [ritualSuggestion, setRitualSuggestion] = useState<string | null>(null);
  const [ritualDoneTypes, setRitualDoneTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const hasFetched = useRef(false);

  const getHeaders = useCallback(async (): Promise<Record<string, string>> => {
    try {
      const token = await getToken();
      return token ? { Authorization: `Bearer ${token}` } : {};
    } catch {
      return {};
    }
  }, [getToken]);

  const fetchEngagement = useCallback(async () => {
    try {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/engagement`, {
        headers: { Accept: "application/json", ...headers },
      });
      if (!res.ok) return;
      const data: EngagementResponse = await res.json();
      setEngagement(data.engagement);
      setMoodState(data.mood_state);
      setTimeOfDay(data.time_of_day);
      setLocalHour(data.local_hour);
      setLevel(data.level);
      setXp(data.xp);
      setXpForNextLevel(data.xp_for_next_level);
      setXpProgressPct(data.xp_progress_pct);
    } catch (e) {
      console.log("[Engagement] fetch error:", e);
    }
  }, [getHeaders]);

  const fetchMilestones = useCallback(async () => {
    try {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/milestones`, {
        headers: { Accept: "application/json", ...headers },
      });
      if (!res.ok) return;
      const data = await res.json();
      setMilestones(data.milestones || []);
    } catch (e) {
      console.log("[Milestones] fetch error:", e);
    }
  }, [getHeaders]);

  const fetchRituals = useCallback(async () => {
    try {
      const headers = await getHeaders();
      const res = await fetch(`${API_URL}/rituals/today`, {
        headers: { Accept: "application/json", ...headers },
      });
      if (!res.ok) return;
      const data: RitualTodayResponse = await res.json();
      setRitualSuggestion(data.suggestion);
      setRitualDoneTypes(data.done_types);
    } catch (e) {
      console.log("[Rituals] fetch error:", e);
    }
  }, [getHeaders]);

  const refresh = useCallback(async () => {
    await Promise.all([fetchEngagement(), fetchMilestones(), fetchRituals()]);
  }, [fetchEngagement, fetchMilestones, fetchRituals]);

  const acknowledgeMilestone = useCallback(async (id: string) => {
    try {
      const headers = await getHeaders();
      await fetch(`${API_URL}/milestones/${id}/acknowledge`, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json", ...headers },
      });
      setMilestones((prev) => prev.filter((m) => m.id !== id));
    } catch (e) {
      console.log("[Milestone] acknowledge error:", e);
    }
  }, [getHeaders]);

  useEffect(() => {
    if (!isSignedIn || hasFetched.current) return;
    hasFetched.current = true;
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [isSignedIn, refresh]);

  return (
    <EngagementContext.Provider
      value={{
        engagement,
        moodState,
        timeOfDay,
        localHour,
        level,
        xp,
        xpForNextLevel,
        xpProgressPct,
        milestones,
        ritualSuggestion,
        ritualDoneTypes,
        loading,
        refresh,
        acknowledgeMilestone,
      }}
    >
      {children}
    </EngagementContext.Provider>
  );
}
