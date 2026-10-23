export type Rules = {
  full_price: number;
  child_price: number;
  child_max_age: number;
  adult_min_age: number;
  min_participants: number;
  max_participants: number;
};

export type EventInfo = {
  id: number;
  title: string;
  venue: string;
  starts_at: string;
  capacity: number;
  seats_left: number;
  rules: Rules;
};

export type Issue = { field: string; code: string; message: string };
export type Line = { name: string; age: number; ticket_type: "full" | "child"; price_rub: number };
export type Summary = { lines: Line[]; total_rub: number };
export type Hold = Summary & { hold_id: string; expires_at: string; ttl_seconds: number };
export type HoldRef = { id: string; deadline: number }; // deadline — по часам клиента, мс
export type Order = {
  id: string;
  event_id: number;
  email: string;
  total_rub: number;
  created_at: string;
  participants: Line[];
};

// age хранится строкой, пока пользователь печатает
export type PersonDraft = { key: string; name: string; age: string };
