import type { HoldRef, Issue, Order, PersonDraft, Summary } from "./types";

export type Step = "form" | "review" | "success" | "soldOut";

export type State = {
  step: Step;
  email: string;
  people: PersonDraft[];
  issues: Issue[];
  summary: Summary | null;
  hold: HoldRef | null; // живёт и при редактировании: новая бронь заменит прежнюю
  idemKey: string | null; // один ключ на одну попытку подтверждения: повтор не создаст дубль
  busy: boolean;
  notice: string | null;
  order: Order | null;
  // stage: нехватка мест выяснилась при брони («hold») или при подтверждении («confirm»)
  soldOut: { seatsLeft: number; requested: number; stage: "hold" | "confirm" } | null;
};

export type Action =
  | { type: "email"; value: string }
  | { type: "person"; key: string; patch: Partial<PersonDraft> }
  | { type: "add" }
  | { type: "remove"; key: string }
  | { type: "busy"; value: boolean }
  | { type: "notice"; message: string | null }
  | { type: "invalid"; issues: Issue[] }
  | { type: "held"; summary: Summary; hold: HoldRef; idemKey: string }
  | { type: "edit" }
  | { type: "confirmed"; order: Order }
  | { type: "soldOut"; seatsLeft: number; requested: number; stage: "hold" | "confirm" }
  | { type: "reset" };

let counter = 0;
export const newPerson = (): PersonDraft => ({ key: `p${++counter}`, name: "", age: "" });

// crypto.randomUUID есть только в защищённом контексте (https/localhost),
// а с телефона по http://192.168.x.x его не будет
export const uid = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export const initialState = (): State => ({
  step: "form",
  email: "",
  people: [newPerson()],
  issues: [],
  summary: null,
  hold: null,
  idemKey: null,
  busy: false,
  notice: null,
  order: null,
  soldOut: null,
});

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "email":
      return {
        ...state,
        email: action.value,
        issues: state.issues.filter((i) => i.field !== "email"),
      };
    case "person": {
      const index = state.people.findIndex((p) => p.key === action.key);
      return {
        ...state,
        people: state.people.map((p) => (p.key === action.key ? { ...p, ...action.patch } : p)),
        issues: state.issues.filter(
          (i) => i.field !== "participants" && !i.field.startsWith(`participants[${index}]`),
        ),
      };
    }
    case "add":
      return { ...state, people: [...state.people, newPerson()], issues: [] };
    case "remove":
      return { ...state, people: state.people.filter((p) => p.key !== action.key), issues: [] };
    case "busy":
      return { ...state, busy: action.value };
    case "notice":
      return { ...state, notice: action.message };
    case "invalid":
      return { ...state, step: "form", issues: action.issues, busy: false, notice: null };
    case "held":
      return {
        ...state,
        step: "review",
        summary: action.summary,
        hold: action.hold,
        idemKey: action.idemKey,
        issues: [],
        busy: false,
        notice: null,
      };
    case "edit":
      return { ...state, step: "form", summary: null, idemKey: null, notice: null, soldOut: null };
    case "confirmed":
      return {
        ...state,
        step: "success",
        order: action.order,
        hold: null,
        busy: false,
        notice: null,
      };
    case "soldOut":
      return {
        ...state,
        step: "soldOut",
        busy: false,
        notice: null,
        soldOut: { seatsLeft: action.seatsLeft, requested: action.requested, stage: action.stage },
      };
    case "reset":
      return initialState();
  }
}
