import type { EventInfo, Hold, Order, PersonDraft } from "./types";

const EVENT_ID = 1;

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; body: any }; // status 0 — сервер недоступен

async function call<T>(path: string, init: RequestInit = {}): Promise<Result<T>> {
  try {
    const res = await fetch(`/api${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init.headers },
    });
    const body = await res.json().catch(() => null);
    return res.ok ? { ok: true, data: body as T } : { ok: false, status: res.status, body };
  } catch {
    return { ok: false, status: 0, body: null };
  }
}

const payload = (email: string, people: PersonDraft[], extra: object = {}) =>
  JSON.stringify({
    event_id: EVENT_ID,
    email,
    participants: people.map((p) => ({
      name: p.name,
      age: p.age.trim() === "" ? null : Number(p.age),
    })),
    ...extra,
  });

export const getEvent = () => call<EventInfo>(`/events/${EVENT_ID}`);

export const getOrder = (id: string) => call<Order>(`/orders/${id}`);

/** Проверяет данные и закрепляет места. replaceHoldId — прежняя бронь этого же покупателя. */
export const createHold = (email: string, people: PersonDraft[], replaceHoldId: string | null) =>
  call<Hold>("/holds", {
    method: "POST",
    body: payload(email, people, { replace_hold_id: replaceHoldId }),
  });

export const createOrder = (
  email: string,
  people: PersonDraft[],
  holdId: string | null,
  idempotencyKey: string,
) =>
  call<Order>("/orders", {
    method: "POST",
    body: payload(email, people, { hold_id: holdId }),
    headers: { "Idempotency-Key": idempotencyKey },
  });

// только для демо (на бэкенде нужен ENABLE_DEV_ENDPOINTS=1)
export const setSeatsLeft = (left: number) =>
  call<{ seats_left: number }>(`/dev/events/${EVENT_ID}/seats?left=${left}`, { method: "POST" });
