import { useEffect, useState } from "react";
import type { EventInfo, Summary } from "../types";
import { DEV_TOOLS, Stubs, TicketHeader, rub } from "../ui";

type Props = {
  event: EventInfo;
  summary: Summary;
  deadline: number;
  email: string;
  busy: boolean;
  notice: string | null;
  onEdit: () => void;
  onConfirm: () => void;
  onSimulate: (left: number) => Promise<void>;
};

function useSecondsLeft(deadline: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

const clock = (sec: number) =>
  `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

export function ReviewStep(props: Props) {
  const { event, summary, deadline, email, busy, notice, onEdit, onConfirm, onSimulate } = props;
  const [demoMessage, setDemoMessage] = useState<string | null>(null);
  const secondsLeft = useSecondsLeft(deadline);

  async function simulate(left: number) {
    await onSimulate(left);
    setDemoMessage(`Бронь сброшена, свободно мест: ${left}. Нажмите «Подтвердить заказ».`);
  }

  return (
    <>
      <div className="ticket">
        <TicketHeader event={event} />
        <div className="ticket__body">
          <h2 id="step-title" tabIndex={-1}>
            Проверьте заказ
          </h2>
          {secondsLeft > 0 ? (
            <p className="hold" role="timer">
              Места закреплены за вами ещё <strong>{clock(secondsLeft)}</strong>
            </p>
          ) : (
            <p className="hold hold--over" role="status">
              Время брони вышло. При подтверждении мы попробуем закрепить места заново.
            </p>
          )}
          <Stubs lines={summary.lines} />
          <dl className="meta">
            <dt>Email</dt>
            <dd>{email.trim()}</dd>
          </dl>
          <p className="total">
            <span>Итого</span>
            <strong>{rub(summary.total_rub)}</strong>
          </p>

          {notice && (
            <p className="callout" role="alert">
              {notice}
            </p>
          )}

          {DEV_TOOLS && (
            <div className="devtools">
              <p>Демо: имитация состояния "бронь истекла, оставшиеся места разобрали другие покупатели".</p>
              <button type="button" className="btn btn--small" onClick={() => simulate(0)}>
                Мест 0
              </button>{" "}
              <button type="button" className="btn btn--small" onClick={() => simulate(1)}>
                Мест 1
              </button>
              {demoMessage && <p className="devtools__msg">{demoMessage}</p>}
            </div>
          )}
        </div>
      </div>

      <div className="bar">
        <button type="button" className="btn btn--secondary" onClick={onEdit} disabled={busy}>
          Изменить
        </button>
        <button type="button" className="btn btn--primary" onClick={onConfirm} disabled={busy}>
          {busy ? "Оформляем…" : "Подтвердить заказ"}
        </button>
      </div>
    </>
  );
}
