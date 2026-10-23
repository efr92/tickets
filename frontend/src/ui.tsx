import type { ReactNode } from "react";
import type { EventInfo, Issue, Line } from "./types";

export const DEV_TOOLS = import.meta.env.DEV || import.meta.env.VITE_DEV_TOOLS === "1";

export const rub = (n: number) => `${new Intl.NumberFormat("ru-RU").format(n)}\u00A0₽`;

export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

export function plural(n: number, one: string, few: string, many: string): string {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

export const tariffName = (t: Line["ticket_type"]) =>
  t === "child" ? "Детский билет" : "Полный билет";

export const issuesFor = (issues: Issue[], field: string) =>
  issues.filter((i) => i.field === field);

export function TicketHeader({ event }: { event: EventInfo }) {
  const left = event.seats_left;
  return (
    <header className="ticket__head">
      <p className="ticket__when">{formatDate(event.starts_at)}</p>
      <h1>{event.title}</h1>
      <p className="ticket__venue">{event.venue}</p>
      <p className="ticket__seats" data-low={left <= 4}>
        {left > 0 ? `Осталось ${left} ${plural(left, "место", "места", "мест")}` : "Мест нет"}
      </p>
    </header>
  );
}

export function Field(props: {
  id: string;
  label: string;
  errors: Issue[];
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={props.id}>{props.label}</label>
      {props.children}
      {props.errors.map((e) => (
        <p key={e.code} className="error" id={`${props.id}-error`} role="alert">
          {e.message}
        </p>
      ))}
    </div>
  );
}

export function Stubs({ lines }: { lines: Line[] }) {
  return (
    <ul className="stubs">
      {lines.map((l, i) => (
        <li key={i} className={`stub stub--${l.ticket_type}`}>
          <div>
            <span className="stub__name">{l.name}</span>
            <span className="stub__sub">
              {l.age} {plural(l.age, "год", "года", "лет")} · {tariffName(l.ticket_type)}
            </span>
          </div>
          <span className="price">{rub(l.price_rub)}</span>
        </li>
      ))}
    </ul>
  );
}
