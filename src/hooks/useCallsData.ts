import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CallPeriod = "today" | "week" | "month" | "custom";

interface CallRecord {
  id: string;
  call_id: string;
  pbx_call_id: string;
  call_start: string;
  call_end: string | null;
  caller: string;
  destination: string;
  direction: string;
  status: string;
  duration: number;
  talk_duration: number;
  sip: string;
  agent_name: string;
  cost: number;
  is_recorded: boolean;
  recording_url: string;
}

interface CallKPIs {
  totalCalls: number;
  validCalls: number;
  answerRate: number;
  validRate: number;
  minutesTalked: number;
  totalCost: number;
}

interface DailyData {
  date: string;
  total: number;
  answered: number;
  valid: number;
}

interface HourlyData {
  hour: number;
  count: number;
}

interface AgentData {
  agent: string;
  total: number;
  answered: number;
  missed: number;
  valid: number;
  minutes: number;
  avgDuration: number;
  validRate: number;
  answerRate: number;
  cost: number;
}

export interface CallsData {
  kpis: CallKPIs;
  dailyData: DailyData[];
  hourlyData: HourlyData[];
  agentData: AgentData[];
  recentCalls: CallRecord[];
}

function getDateRange(period: CallPeriod, customRange?: { start: Date; end: Date }) {
  const now = new Date();
  let start: Date;
  let end = now;

  switch (period) {
    case "today":
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "week":
      start = new Date(now);
      start.setDate(start.getDate() - 7);
      break;
    case "month":
      start = new Date(now);
      start.setDate(start.getDate() - 30);
      break;
    case "custom":
      if (customRange) {
        start = customRange.start;
        end = customRange.end;
      } else {
        start = new Date(now);
        start.setDate(start.getDate() - 30);
      }
      break;
    default:
      start = new Date(now);
      start.setDate(start.getDate() - 30);
  }

  return { start, end };
}

// A call is "valid" if it was answered and talk_duration > 30 seconds
function isValidCall(call: CallRecord): boolean {
  return call.status === "answered" && call.talk_duration > 30;
}

export function useCallsData(period: CallPeriod, customRange?: { start: Date; end: Date }) {
  const [data, setData] = useState<CallsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { start, end } = getDateRange(period, customRange);
      const startStr = start.toISOString();
      const endStr = end.toISOString();

      const { data: calls, error: dbError } = await supabase
        .from("calls_cache")
        .select("*")
        .gte("call_start", startStr)
        .lte("call_start", endStr)
        .order("call_start", { ascending: false });

      if (dbError) throw new Error(dbError.message);

      const records = (calls || []) as unknown as CallRecord[];

      // KPIs
      const totalCalls = records.length;
      const answered = records.filter((c) => c.status === "answered");
      const valid = records.filter(isValidCall);
      const totalTalkSeconds = records.reduce((s, c) => s + (c.talk_duration || 0), 0);
      const totalCost = records.reduce((s, c) => s + (c.cost || 0), 0);

      const kpis: CallKPIs = {
        totalCalls,
        validCalls: valid.length,
        answerRate: totalCalls > 0 ? (answered.length / totalCalls) * 100 : 0,
        validRate: totalCalls > 0 ? (valid.length / totalCalls) * 100 : 0,
        minutesTalked: Math.round(totalTalkSeconds / 60),
        totalCost: Math.round(totalCost * 100) / 100,
      };

      // Daily data
      const dailyMap: Record<string, { total: number; answered: number; valid: number }> = {};
      records.forEach((c) => {
        const day = c.call_start?.slice(0, 10) || "unknown";
        if (!dailyMap[day]) dailyMap[day] = { total: 0, answered: 0, valid: 0 };
        dailyMap[day].total++;
        if (c.status === "answered") dailyMap[day].answered++;
        if (isValidCall(c)) dailyMap[day].valid++;
      });
      const dailyData = Object.entries(dailyMap)
        .map(([date, v]) => ({ date, ...v }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Hourly data
      const hourlyMap: Record<number, number> = {};
      for (let h = 0; h < 24; h++) hourlyMap[h] = 0;
      records.forEach((c) => {
        if (c.call_start) {
          const hour = new Date(c.call_start).getHours();
          hourlyMap[hour]++;
        }
      });
      const hourlyData = Object.entries(hourlyMap)
        .map(([h, count]) => ({ hour: Number(h), count }))
        .sort((a, b) => a.hour - b.hour);

      // Agent data
      const agentMap: Record<string, CallRecord[]> = {};
      records.forEach((c) => {
        const agent = c.agent_name || c.sip || "Sin asignar";
        if (!agentMap[agent]) agentMap[agent] = [];
        agentMap[agent].push(c);
      });
      const agentData: AgentData[] = Object.entries(agentMap).map(([agent, agentCalls]) => {
        const answeredCalls = agentCalls.filter((c) => c.status === "answered");
        const missedCalls = agentCalls.filter((c) => c.status !== "answered");
        const validCalls = agentCalls.filter(isValidCall);
        const totalMinutes = agentCalls.reduce((s, c) => s + (c.talk_duration || 0), 0) / 60;
        const avgDur = answeredCalls.length > 0
          ? agentCalls.reduce((s, c) => s + (c.talk_duration || 0), 0) / answeredCalls.length / 60
          : 0;
        const agentCost = agentCalls.reduce((s, c) => s + (c.cost || 0), 0);

        return {
          agent,
          total: agentCalls.length,
          answered: answeredCalls.length,
          missed: missedCalls.length,
          valid: validCalls.length,
          minutes: Math.round(totalMinutes * 10) / 10,
          avgDuration: Math.round(avgDur * 10) / 10,
          validRate: agentCalls.length > 0 ? Math.round((validCalls.length / agentCalls.length) * 100) : 0,
          answerRate: agentCalls.length > 0 ? Math.round((answeredCalls.length / agentCalls.length) * 100) : 0,
          cost: Math.round(agentCost * 100) / 100,
        };
      }).sort((a, b) => b.total - a.total);

      // Recent calls (top 50)
      const recentCalls = records.slice(0, 50);

      setData({ kpis, dailyData, hourlyData, agentData, recentCalls });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando datos");
    } finally {
      setLoading(false);
    }
  }, [period, customRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
