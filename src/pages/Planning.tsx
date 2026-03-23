import { AlertTriangle, Loader2, ExternalLink, Calendar, Users } from "lucide-react";
import { useState, useEffect, useCallback } from "react";

const TRELLO_LABEL_COLORS: Record<string, string> = {
  green: "hsl(142 71% 45%)",
  yellow: "hsl(48 96% 53%)",
  orange: "hsl(25 95% 53%)",
  red: "hsl(0 84% 60%)",
  purple: "hsl(263 70% 50%)",
  blue: "hsl(217 91% 60%)",
  sky: "hsl(199 89% 48%)",
  lime: "hsl(84 81% 44%)",
  pink: "hsl(330 81% 60%)",
  black: "hsl(0 0% 20%)",
  green_dark: "hsl(142 71% 30%)",
  yellow_dark: "hsl(48 96% 38%)",
  orange_dark: "hsl(25 95% 38%)",
  red_dark: "hsl(0 84% 45%)",
  purple_dark: "hsl(263 70% 35%)",
  blue_dark: "hsl(217 91% 45%)",
};

interface TrelloBoard {
  id: string;
  name: string;
  url: string;
  dateLastActivity: string | null;
}

interface TrelloMember {
  id: string;
  fullName: string;
  initials: string;
  avatarUrl: string | null;
}

interface TrelloLabel {
  id: string;
  name: string;
  color: string;
}

interface TrelloCard {
  id: string;
  name: string;
  desc: string;
  due: string | null;
  dueComplete: boolean;
  url: string;
  labels: TrelloLabel[];
  members: TrelloMember[];
}

interface TrelloList {
  id: string;
  name: string;
  cards: TrelloCard[];
}

export default function Planning() {
  const [boards, setBoards] = useState<TrelloBoard[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<string>("");
  const [lists, setLists] = useState<TrelloList[]>([]);
  const [loadingBoards, setLoadingBoards] = useState(true);
  const [loadingLists, setLoadingLists] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiFetch = useCallback(async (params: Record<string, string> = {}) => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const qs = new URLSearchParams(params);
    const res = await fetch(
      `https://${projectId}.supabase.co/functions/v1/trello-boards?${qs}`,
      { headers: { Authorization: `Bearer ${anonKey}`, apikey: anonKey } }
    );
    if (!res.ok) throw new Error(`Error ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
  }, []);

  // Fetch boards on mount
  useEffect(() => {
    (async () => {
      setLoadingBoards(true);
      setError(null);
      try {
        const data = await apiFetch();
        setBoards(data.boards || []);
        if (data.boards?.length > 0) {
          setSelectedBoard(data.boards[0].id);
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoadingBoards(false);
      }
    })();
  }, [apiFetch]);

  // Fetch lists when board changes
  useEffect(() => {
    if (!selectedBoard) return;
    (async () => {
      setLoadingLists(true);
      setError(null);
      try {
        const data = await apiFetch({ board_id: selectedBoard });
        setLists(data.lists || []);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoadingLists(false);
      }
    })();
  }, [selectedBoard, apiFetch]);

  const isOverdue = (due: string | null, dueComplete: boolean) => {
    if (!due || dueComplete) return false;
    return new Date(due) < new Date();
  };

  const fmtDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
  };

  const selectedBoardData = boards.find((b) => b.id === selectedBoard);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-black tracking-tight">Planning</h2>
        <div className="flex items-center gap-3">
          {!loadingBoards && boards.length > 0 && (
            <select
              value={selectedBoard}
              onChange={(e) => setSelectedBoard(e.target.value)}
              className="text-sm border border-border rounded-md px-3 py-2 bg-card font-semibold max-w-xs truncate"
            >
              {boards.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
          {selectedBoardData && (
            <a
              href={selectedBoardData.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Abrir en Trello
            </a>
          )}
        </div>
      </div>

      {/* Loading */}
      {(loadingBoards || loadingLists) && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-sm text-muted-foreground font-semibold">
            {loadingBoards ? "Cargando tableros…" : "Cargando tarjetas…"}
          </span>
        </div>
      )}

      {/* Error */}
      {error && !loadingBoards && !loadingLists && (
        <div className="bg-status-error/10 border border-status-error/20 rounded-lg p-4">
          <p className="text-sm font-bold text-status-error">{error}</p>
        </div>
      )}

      {/* Board columns */}
      {!loadingBoards && !loadingLists && !error && lists.length > 0 && (
        <div className="flex gap-4 overflow-x-auto pb-4 animate-fade-in">
          {lists.map((list) => (
            <div
              key={list.id}
              className="bg-muted/50 rounded-lg p-4 min-w-[300px] max-w-[340px] flex-shrink-0"
            >
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center justify-between">
                <span>{list.name}</span>
                <span className="bg-muted rounded-full px-2 py-0.5 text-[10px]">{list.cards.length}</span>
              </h3>
              <div className="space-y-3 max-h-[calc(100vh-240px)] overflow-y-auto pr-1">
                {list.cards.map((card) => {
                  const overdue = isOverdue(card.due, card.dueComplete);
                  return (
                    <a
                      key={card.id}
                      href={card.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block bg-card rounded-lg border border-border p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                    >
                      {/* Labels */}
                      {card.labels.length > 0 && (
                        <div className="flex gap-1 mb-2 flex-wrap">
                          {card.labels.map((label) => (
                            <span
                              key={label.id}
                              className="h-1.5 rounded-full min-w-[32px]"
                              style={{ backgroundColor: TRELLO_LABEL_COLORS[label.color] || "hsl(var(--muted-foreground))" }}
                              title={label.name}
                            />
                          ))}
                        </div>
                      )}

                      {/* Title */}
                      <p className="text-sm font-semibold mb-2 leading-snug">{card.name}</p>

                      {/* Footer: due date + members */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          {card.due && (
                            <span
                              className={`inline-flex items-center gap-1 text-[11px] rounded px-1.5 py-0.5 font-semibold ${
                                card.dueComplete
                                  ? "bg-[hsl(var(--status-success)/0.12)] text-[hsl(var(--status-success))]"
                                  : overdue
                                  ? "bg-[hsl(var(--status-error)/0.12)] text-[hsl(var(--status-error))]"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {overdue && !card.dueComplete && <AlertTriangle className="h-3 w-3" />}
                              <Calendar className="h-3 w-3" />
                              {fmtDate(card.due)}
                            </span>
                          )}
                        </div>

                        {/* Members */}
                        {card.members.length > 0 && (
                          <div className="flex -space-x-1.5">
                            {card.members.slice(0, 3).map((m) =>
                              m.avatarUrl ? (
                                <img
                                  key={m.id}
                                  src={`${m.avatarUrl}/30.png`}
                                  alt={m.fullName}
                                  title={m.fullName}
                                  className="w-6 h-6 rounded-full border-2 border-card object-cover"
                                />
                              ) : (
                                <span
                                  key={m.id}
                                  title={m.fullName}
                                  className="w-6 h-6 rounded-full bg-secondary text-secondary-foreground text-[10px] font-bold flex items-center justify-center border-2 border-card"
                                >
                                  {m.initials}
                                </span>
                              )
                            )}
                            {card.members.length > 3 && (
                              <span className="w-6 h-6 rounded-full bg-muted text-muted-foreground text-[10px] font-bold flex items-center justify-center border-2 border-card">
                                +{card.members.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </a>
                  );
                })}

                {list.cards.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-6">Sin tarjetas</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loadingBoards && !loadingLists && !error && lists.length === 0 && boards.length > 0 && (
        <div className="text-center py-20 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-semibold">Este tablero no tiene listas</p>
        </div>
      )}
    </div>
  );
}
