import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import * as api from "./api";
import { initialState, reducer, uid } from "./state";
import { FormStep } from "./steps/FormStep";
import { ReviewStep } from "./steps/ReviewStep";
import { SoldOutStep, SuccessStep } from "./steps/ResultStep";
import type { EventInfo } from "./types";

const NETWORK_ERROR = "Не удалось связаться с сервером. Проверьте соединение и повторите.";
const ORDER_HASH = /^#order=([0-9a-f-]{36})$/i;

// Фокус на первое поле с ошибкой — на телефоне иначе ошибка может остаться за экраном
const focusFirstError = () =>
  setTimeout(
    () => document.querySelector<HTMLElement>('[aria-invalid="true"], #group-error')?.focus(),
    0,
  );

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const firstRender = useRef(true);

  const loadEvent = useCallback(async () => {
    const res = await api.getEvent();
    if (res.ok) {
      setEvent(res.data);
      setLoadFailed(false);
    } else {
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    loadEvent();
  }, [loadEvent]);

  // Оформленный заказ переживает перезагрузку страницы: его номер лежит в #order=<id>
  useEffect(() => {
    const match = window.location.hash.match(ORDER_HASH);
    if (!match) return;
    api.getOrder(match[1]).then((res) => {
      if (res.ok) dispatch({ type: "confirmed", order: res.data });
    });
  }, []);

  // Скринридеры и мобильный экран: при смене шага переносим фокус на заголовок шага
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (state.step !== "form") document.getElementById("step-title")?.focus();
  }, [state.step]);

  async function goReview() {
    dispatch({ type: "busy", value: true });
    const res = await api.createHold(state.email, state.people, state.hold?.id ?? null);
    if (res.ok) {
      const { hold_id, ttl_seconds, lines, total_rub } = res.data;
      dispatch({
        type: "held",
        summary: { lines, total_rub },
        hold: { id: hold_id, deadline: Date.now() + ttl_seconds * 1000 },
        idemKey: uid(),
      });
    } else if (res.status === 409 && res.body?.code === "SOLD_OUT") {
      await loadEvent();
      dispatch({
        type: "soldOut",
        seatsLeft: res.body.seats_left,
        requested: res.body.requested,
        stage: "hold",
      });
    } else if (res.status === 422 && Array.isArray(res.body?.errors)) {
      dispatch({ type: "invalid", issues: res.body.errors });
      focusFirstError();
    } else {
      dispatch({ type: "notice", message: NETWORK_ERROR });
      dispatch({ type: "busy", value: false });
    }
  }

  async function confirm() {
    if (!state.idemKey) return;
    dispatch({ type: "busy", value: true });
    const res = await api.createOrder(
      state.email,
      state.people,
      state.hold?.id ?? null,
      state.idemKey,
    );
    if (res.ok) {
      window.history.replaceState(null, "", `#order=${res.data.id}`);
      dispatch({ type: "confirmed", order: res.data });
    } else if (res.status === 409 && res.body?.code === "SOLD_OUT") {
      await loadEvent(); // обновляем число мест в шапке
      dispatch({
        type: "soldOut",
        seatsLeft: res.body.seats_left,
        requested: res.body.requested,
        stage: "confirm",
      });
    } else if (res.status === 422 && Array.isArray(res.body?.errors)) {
      dispatch({ type: "invalid", issues: res.body.errors });
      focusFirstError();
    } else {
      // сетевая ошибка или 5xx: тот же Idempotency-Key — повторное нажатие не создаст дубль
      dispatch({
        type: "notice",
        message:
          res.status === 409
            ? "Заказ уже обрабатывается. Подождите несколько секунд."
            : "Не удалось подтвердить заказ. Повторите — дубликата не будет.",
      });
      dispatch({ type: "busy", value: false });
    }
  }

  async function edit() {
    dispatch({ type: "edit" });
    await loadEvent();
  }

  async function reset() {
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    dispatch({ type: "reset" });
    await loadEvent();
  }

  if (!event) {
    return (
      <main className="page">
        <div className="ticket">
          <div className="ticket__body">
            {loadFailed ? (
              <>
                <h2>Не удалось загрузить мероприятие</h2>
                <p className="hint">Проверьте, что бэкенд запущен, и повторите.</p>
                <button type="button" className="btn btn--primary" onClick={loadEvent}>
                  Повторить
                </button>
              </>
            ) : (
              <p className="hint">Загружаем мероприятие…</p>
            )}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      {state.step === "form" && (
        <FormStep event={event} state={state} dispatch={dispatch} onSubmit={goReview} />
      )}
      {state.step === "review" && state.summary && state.hold && (
        <ReviewStep
          event={event}
          summary={state.summary}
          deadline={state.hold.deadline}
          email={state.email}
          busy={state.busy}
          notice={state.notice}
          onEdit={edit}
          onConfirm={confirm}
          onSimulate={async (left) => {
            await api.setSeatsLeft(left); // шапку не обновляем: покупатель «не знает» о продаже
          }}
        />
      )}
      {state.step === "success" && state.order && (
        <SuccessStep event={event} order={state.order} onReset={reset} />
      )}
      {state.step === "soldOut" && state.soldOut && (
        <SoldOutStep
          event={event}
          seatsLeft={state.soldOut.seatsLeft}
          requested={state.soldOut.requested}
          stage={state.soldOut.stage}
          onEdit={edit}
        />
      )}
    </main>
  );
}
