import { LogOut, MapPin, Monitor, RefreshCw, UserCog, Wallet, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { bsAmount } from "@/lib/posMoney";
import type { PosSaleContext } from "@/lib/posSession";

export type PosSession = PosSaleContext;

export function PosHeader({
  session,
  onChangeCashier,
  onChangeRegister,
  onOpenDrawer,
  onExit,
}: {
  session: PosSession;
  onChangeCashier: () => void;
  onChangeRegister: () => void;
  onOpenDrawer: () => void;
  onExit: () => void;
}) {
  return (
    <header className="border-b border-border bg-card px-4 py-3 flex items-center gap-4 flex-wrap shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
          <span className="text-primary-foreground font-black text-sm">S</span>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Sublime</p>
          <h1 className="text-base font-black tracking-tight text-foreground leading-none">POS</h1>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap text-sm">
        <Meta icon={MapPin} label="Sede" value={session.locationName} />
        <Meta icon={Monitor} label="Caja" value={session.registerName} />
        <Meta label="Sesión" value={session.sessionCode} />
        <Meta label="Cajero" value={session.cashierName} />
        <div className="leading-tight">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Tasa BCV</p>
          <p className="num font-black text-foreground text-sm tabular-nums">
            Bs. {bsAmount(1, session.rate)} <span className="text-[10px] text-muted-foreground">/ REF</span>
          </p>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2 flex-wrap">
        <Badge variant={session.registerOpen ? "secondary" : "destructive"}>
          {session.registerOpen ? "Caja abierta" : "Caja cerrada"}
        </Badge>
        <Badge variant={session.online ? "secondary" : "destructive"} className="gap-1.5">
          <Wifi className="h-3 w-3" />
          {session.online ? "En línea" : "Sin conexión"}
        </Badge>
        <Button variant="outline" size="sm" onClick={onChangeCashier}>
          <UserCog className="h-4 w-4 mr-2" />
          Cambiar cajero
        </Button>
        <Button variant="outline" size="sm" onClick={onChangeRegister}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Cambiar caja
        </Button>
        <Button variant="outline" size="sm" onClick={onOpenDrawer}>
          <Wallet className="h-4 w-4 mr-2" />
          {session.registerOpen ? "Movimientos de caja" : "Abrir caja"}
        </Button>
        <Button variant="ghost" size="sm" onClick={onExit}>
          <LogOut className="h-4 w-4 mr-2" />
          Salir
        </Button>
      </div>
    </header>
  );
}

function Meta({
  icon: Icon,
  label,
  value,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="leading-tight">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-semibold text-foreground flex items-center gap-1.5 text-sm">
        {Icon ? <Icon className="h-3.5 w-3.5 text-primary" /> : null}
        {value}
      </p>
    </div>
  );
}
