// Reglas puras del refresco: cada cuanto se vuelve a leer un articulo en el
// pase automatico, cuando se avisa y que dice el aviso. Sin Deno ni Supabase,
// para poder testearlas con Vitest como extract.ts.

export type RefreshMode = "off" | "daily" | "12h" | "6h";

export interface NotifySettings {
  us_refresh_mode: RefreshMode;
  us_notify_enabled: boolean;
  us_notify_kind: "any" | "pct" | "eur";
  us_notify_pct: number;
  us_notify_eur: number;
  us_notify_min_hist: boolean;
  us_notify_back_in_stock: boolean;
}

/** Horas que tiene que llevar un articulo sin leerse para que el pase
 * automatico lo vuelva a leer. Una hora menos que el intervalo del modo, con
 * los mismos margenes que vigia.run_scheduled_refresh() (007): asi un
 * articulo leido en el pase anterior siempre entra en el siguiente, y uno
 * refrescado a mano hace poco se salta. */
export function cronCutoffHours(mode: RefreshMode): number {
  if (mode === "6h") return 5;
  if (mode === "12h") return 11;
  return 20;
}

export type AlertReason = "drop" | "min_hist" | "back_in_stock";

export interface PriceChange {
  prev: number | null;
  next: number;
  prevMin: number | null;
  wasInStock: boolean | null;
  nowInStock: boolean | null | undefined;
  /** itm_notified_price: precio del ultimo aviso, si sigue vigente. */
  alreadyNotified: number | null;
}

/** Motivos por los que hay que avisar de este cambio; vacio si ninguno.
 *
 * Bajada y minimo historico solo avisan por debajo del ultimo precio avisado
 * (no se repite el aviso del mismo precio). Esa referencia se olvida cuando
 * el precio vuelve a subir por encima (ver resetsNotified), para que un
 * rebote 90 -> 120 -> 100 avise de la segunda bajada. Volver a haber stock no
 * depende del precio y avisa siempre que este activado. */
export function alertReasons(settings: NotifySettings, change: PriceChange): AlertReason[] {
  if (!settings.us_notify_enabled) return [];
  const { prev, next, prevMin, wasInStock, nowInStock, alreadyNotified } = change;
  const reasons: AlertReason[] = [];
  const belowLastAlert = alreadyNotified == null || next < alreadyNotified;

  if (belowLastAlert && prev != null && prev > 0 && next < prev) {
    const drop = prev - next;
    const passes = settings.us_notify_kind === "pct"
      ? (drop / prev) * 100 >= settings.us_notify_pct
      : settings.us_notify_kind === "eur"
      ? drop >= settings.us_notify_eur
      : true;
    if (passes) reasons.push("drop");
  }
  if (belowLastAlert && settings.us_notify_min_hist && prevMin != null && next < prevMin) {
    reasons.push("min_hist");
  }
  if (settings.us_notify_back_in_stock && wasInStock === false && nowInStock === true) {
    reasons.push("back_in_stock");
  }
  return reasons;
}

/** true si el precio ha vuelto a subir por encima del ultimo aviso: hay que
 * vaciar itm_notified_price para que la proxima bajada vuelva a avisar. */
export function resetsNotified(alreadyNotified: number | null, next: number): boolean {
  return alreadyNotified != null && next > alreadyNotified;
}

export interface Alert {
  title: string;
  reasons: AlertReason[];
  prev: number | null;
  next: number;
}

const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });

function describe(alert: Alert): string {
  const parts = alert.reasons.map((reason) => {
    if (reason === "drop") {
      const pct = Math.round(((alert.prev! - alert.next) / alert.prev!) * 100);
      return pct >= 1 ? `-${pct} %` : "baja de precio";
    }
    if (reason === "min_hist") return "mínimo histórico";
    return "vuelve a haber stock";
  });
  return `${parts.join(", ")} · ${eur.format(alert.next)}`;
}

function shorten(title: string, max = 40): string {
  return title.length > max ? `${title.slice(0, max - 1).trimEnd()}…` : title;
}

/** Texto de la notificacion: una linea por aviso, agrupado si hay varios. */
export function buildPushBody(alerts: Alert[]): string {
  if (alerts.length === 1) return `${alerts[0].title}: ${describe(alerts[0])}`;
  const shown = alerts.slice(0, 3).map((a) => `${shorten(a.title)} (${describe(a)})`).join("; ");
  const rest = alerts.length > 3 ? ` y ${alerts.length - 3} más` : "";
  return `${alerts.length} artículos con novedades: ${shown}${rest}`;
}
