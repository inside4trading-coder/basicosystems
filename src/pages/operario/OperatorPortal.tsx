import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { OperatorPicker } from "@/components/operario/OperatorPicker";
import { OperatorPinPad } from "@/components/operario/OperatorPinPad";
import { OperatorDashboard } from "@/components/operario/OperatorDashboard";
import { OperatorScanSheet } from "@/components/operario/OperatorScanSheet";
import {
  getAmountsVisible,
  getPortalToken,
  portalApi,
  setAmountsVisible,
  setPortalToken,
  type PortalDashboard,
  type PortalOperator,
} from "@/lib/operatorPortal";

type Step = "loading" | "picker" | "pin" | "dashboard";

export default function OperatorPortal() {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("loading");
  const [operators, setOperators] = useState<PortalOperator[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [selected, setSelected] = useState<PortalOperator | null>(null);
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [operator, setOperator] = useState<PortalOperator | null>(null);
  const [dashboard, setDashboard] = useState<PortalDashboard | null>(null);
  const [amountsVisible, setAmountsVisibleState] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadOperators = useCallback(async () => {
    setListLoading(true);
    const res = await portalApi.listOperators();
    setListLoading(false);
    if (res.ok) setOperators(res.operators);
    else toast({ title: "No se pudo cargar la lista", description: res.error, variant: "destructive" });
  }, [toast]);

  // Restaurar sesión
  useEffect(() => {
    (async () => {
      const stored = getPortalToken();
      if (stored) {
        const res = await portalApi.session(stored);
        if (res.ok) {
          setToken(stored);
          setOperator(res.operator);
          setDashboard(res.dashboard);
          setAmountsVisibleState(getAmountsVisible(res.operator.id));
          setStep("dashboard");
          return;
        }
        setPortalToken(null);
      }
      setStep("picker");
      void loadOperators();
    })();
  }, [loadOperators]);

  async function handleLogin(pin: string) {
    if (!selected) return;
    setPinLoading(true);
    setPinError(null);
    const res = await portalApi.login(selected.id, pin);
    setPinLoading(false);
    if (!res.ok) {
      setPinError(res.error ?? "No se pudo iniciar sesión");
      return;
    }
    setPortalToken(res.token);
    setToken(res.token);
    setOperator(res.operator);
    setDashboard(res.dashboard);
    setAmountsVisibleState(getAmountsVisible(res.operator.id));
    setStep("dashboard");
  }

  const refresh = useCallback(async () => {
    if (!token) return;
    setRefreshing(true);
    const res = await portalApi.session(token);
    setRefreshing(false);
    if (res.ok) {
      setOperator(res.operator);
      setDashboard(res.dashboard);
    } else {
      handleSessionExpired();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function handleSessionExpired() {
    setPortalToken(null);
    setToken(null);
    setOperator(null);
    setDashboard(null);
    setSelected(null);
    setStep("picker");
    void loadOperators();
    toast({ title: "Sesión finalizada", description: "Vuelve a ingresar tu PIN." });
  }

  async function handleLogout() {
    if (token) await portalApi.logout(token);
    setPortalToken(null);
    setToken(null);
    setOperator(null);
    setDashboard(null);
    setSelected(null);
    setStep("picker");
    void loadOperators();
  }

  function toggleAmounts() {
    if (!operator) return;
    const next = !amountsVisible;
    setAmountsVisibleState(next);
    setAmountsVisible(operator.id, next);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <span className="text-lg font-black tracking-tight">
            BASICO <span className="text-primary">CORE</span>
          </span>
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Portal de operario</span>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-4">
        {step === "loading" && <div className="py-20 text-center text-muted-foreground">Cargando…</div>}

        {step === "picker" && (
          <OperatorPicker
            operators={operators}
            loading={listLoading}
            onSelect={(op) => {
              setSelected(op);
              setPinError(null);
              setStep("pin");
            }}
          />
        )}

        {step === "pin" && selected && (
          <OperatorPinPad
            operator={selected}
            loading={pinLoading}
            error={pinError}
            isNew={selected.pin_set === false}
            onClearError={() => setPinError(null)}
            onBack={() => {
              setSelected(null);
              setPinError(null);
              setStep("picker");
            }}
            onSubmit={handleLogin}
          />
        )}


        {step === "dashboard" && operator && (
          <>
            <OperatorDashboard
              operator={operator}
              dashboard={dashboard}
              amountsVisible={amountsVisible}
              refreshing={refreshing}
              onToggleAmounts={toggleAmounts}
              onScan={() => setScanOpen(true)}
              onRefresh={refresh}
              onSwitchOperator={handleLogout}
              onLogout={handleLogout}
            />
            {token && (
              <OperatorScanSheet
                open={scanOpen}
                token={token}
                amountsVisible={amountsVisible}
                onOpenChange={setScanOpen}
                onSessionExpired={handleSessionExpired}
                onRegistered={(msg) => {
                  toast({ title: "Proceso registrado", description: msg });
                  void refresh();
                }}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
