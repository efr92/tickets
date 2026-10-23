import type { Dispatch } from "react";
import type { Action, State } from "../state";
import type { EventInfo } from "../types";
import { Field, TicketHeader, issuesFor, plural, rub, tariffName } from "../ui";

type Props = { event: EventInfo; state: State; dispatch: Dispatch<Action>; onSubmit: () => void };

export function FormStep({ event, state, dispatch, onSubmit }: Props) {
  const { rules } = event;
  const { people, issues, email, busy, notice } = state;
  const soldOut = event.seats_left <= 0;
  const groupErrors = issues.filter((i) => i.field === "participants");

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className="ticket">
        <TicketHeader event={event} />
        <div className="ticket__body">
          <h2>Участники</h2>
          <p className="hint">
            От {rules.child_max_age + 1} лет — {rub(rules.full_price)}, младше{" "}
            {rules.child_max_age + 1} — {rub(rules.child_price)}. Ребёнок проходит только вместе
            с участником от {rules.adult_min_age} лет в том же заказе.
          </p>

          {soldOut && <p className="callout">Билеты на это мероприятие закончились.</p>}

          {people.map((p, i) => {
            const age = p.age === "" ? null : Number(p.age);
            const kind = age === null ? null : age <= rules.child_max_age ? "child" : "full";
            const nameErrors = issuesFor(issues, `participants[${i}].name`);
            const ageErrors = issuesFor(issues, `participants[${i}].age`);
            return (
              <div
                key={p.key}
                className="person"
                data-kind={kind ?? "none"}
                role="group"
                aria-labelledby={`title-${p.key}`}
              >
                <p className="person__title" id={`title-${p.key}`}>
                  Участник {i + 1}
                </p>
                <div className="person__grid">
                  <Field id={`name-${p.key}`} label="Имя" errors={nameErrors}>
                    <input
                      id={`name-${p.key}`}
                      value={p.name}
                      autoComplete="off"
                      maxLength={120}
                      aria-invalid={nameErrors.length > 0}
                      aria-describedby={nameErrors.length ? `name-${p.key}-error` : undefined}
                      onChange={(e) =>
                        dispatch({ type: "person", key: p.key, patch: { name: e.target.value } })
                      }
                    />
                  </Field>
                  <Field id={`age-${p.key}`} label="Возраст" errors={ageErrors}>
                    <input
                      id={`age-${p.key}`}
                      value={p.age}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={3}
                      autoComplete="off"
                      aria-invalid={ageErrors.length > 0}
                      aria-describedby={ageErrors.length ? `age-${p.key}-error` : undefined}
                      onChange={(e) =>
                        dispatch({
                          type: "person",
                          key: p.key,
                          patch: { age: e.target.value.replace(/\D/g, "") },
                        })
                      }
                    />
                  </Field>
                </div>
                <div className="person__meta">
                  {kind ? (
                    <span className={`tag tag--${kind}`}>
                      {tariffName(kind)} · {rub(kind === "child" ? rules.child_price : rules.full_price)}
                    </span>
                  ) : (
                    <span />
                  )}
                  {people.length > rules.min_participants && (
                    <button
                      type="button"
                      className="link"
                      aria-label={`Убрать участника ${i + 1}`}
                      onClick={() => dispatch({ type: "remove", key: p.key })}
                    >
                      Убрать
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {groupErrors.map((e) => (
            <p key={e.code} id="group-error" className="callout" role="alert" tabIndex={-1}>
              {e.message}
            </p>
          ))}

          {people.length < rules.max_participants && (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => dispatch({ type: "add" })}
            >
              Добавить участника
            </button>
          )}

          <h2 className="section-gap">Контакты</h2>
          <Field id="email" label="Email для заказа" errors={issuesFor(issues, "email")}>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              aria-invalid={issuesFor(issues, "email").length > 0}
              aria-describedby={issuesFor(issues, "email").length ? "email-error" : undefined}
              onChange={(e) => dispatch({ type: "email", value: e.target.value })}
            />
          </Field>

          {notice && (
            <p className="callout" role="alert">
              {notice}
            </p>
          )}
        </div>
      </div>

      <div className="bar">
        <span className="bar__info">
          {people.length} {plural(people.length, "участник", "участника", "участников")}
        </span>
        <button type="submit" className="btn btn--primary" disabled={busy || soldOut}>
          {busy ? "Проверяем…" : "Проверить заказ"}
        </button>
      </div>
    </form>
  );
}
