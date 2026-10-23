import type { EventInfo, Order } from "../types";
import { Stubs, TicketHeader, plural, rub } from "../ui";

export function SuccessStep(props: { event: EventInfo; order: Order; onReset: () => void }) {
  const { event, order, onReset } = props;
  return (
    <>
      <div className="ticket ticket--ok">
        <TicketHeader event={event} />
        <div className="ticket__body">
          <h2 id="step-title" tabIndex={-1}>
            Заказ оформлен
          </h2>
          <p className="hint">
            Номер заказа: <strong>{order.id.slice(0, 8).toUpperCase()}</strong>
          </p>
          <Stubs lines={order.participants} />
          <dl className="meta">
            <dt>Контактный email</dt>
            <dd>{order.email}</dd>
          </dl>
          <p className="total">
            <span>Итого</span>
            <strong>{rub(order.total_rub)}</strong>
          </p>
        </div>
      </div>
      <div className="bar">
        <button type="button" className="btn btn--primary" onClick={onReset}>
          Оформить ещё заказ
        </button>
      </div>
    </>
  );
}

export function SoldOutStep(props: {
  event: EventInfo;
  seatsLeft: number;
  requested: number;
  stage: "hold" | "confirm";
  onEdit: () => void;
}) {
  const { event, seatsLeft, requested, stage, onEdit } = props;
  const people = `${requested} ${plural(requested, "участник", "участника", "участников")}`;
  return (
    <>
      <div className="ticket ticket--warn">
        <TicketHeader event={event} />
        <div className="ticket__body">
          <h2 id="step-title" tabIndex={-1}>
            {seatsLeft > 0 ? "Мест меньше, чем в заказе" : "Места закончились"}
          </h2>
          {seatsLeft === 0 ? (
            <p>
              {stage === "confirm"
                ? "Время брони вышло, и оставшиеся места разобрали. "
                : ""}
              Билетов на это мероприятие больше нет. Заказ не оформлен.
            </p>
          ) : (
            <p>
              {stage === "confirm"
                ? "Время брони вышло, и часть мест разобрали. "
                : ""}
              Свободных мест: {seatsLeft}, в заказе: {people}. Заказ не оформлен. Уберите лишних
              участников и проверьте заказ ещё раз.
            </p>
          )}
        </div>
      </div>
      <div className="bar">
        <button type="button" className="btn btn--primary" onClick={onEdit}>
          {seatsLeft > 0 ? "Изменить состав заказа" : "Вернуться к заказу"}
        </button>
      </div>
    </>
  );
}
