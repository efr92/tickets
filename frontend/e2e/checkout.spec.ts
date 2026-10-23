import { expect, test, type Page } from "@playwright/test";

const person = (page: Page, n: number) => page.getByRole("group", { name: `Участник ${n}` });

async function fillPerson(page: Page, n: number, name: string, age: string) {
  const group = person(page, n);
  await group.getByLabel("Имя").fill(name);
  await group.getByLabel("Возраст").fill(age);
}

const addPerson = (page: Page) => page.getByRole("button", { name: "Добавить участника" }).click();

async function toReview(page: Page) {
  await page.getByLabel("Email для заказа").fill("anna@example.com");
  await page.getByRole("button", { name: "Проверить заказ" }).click();
  await expect(page.getByRole("heading", { name: "Проверьте заказ" })).toBeVisible();
}

const confirm = (page: Page) => page.getByRole("button", { name: "Подтвердить заказ" }).click();

async function expectNoHorizontalScroll(page: Page) {
  const fits = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );
  expect(fits, "страница не должна скроллиться по горизонтали").toBe(true);
}

test.beforeEach(async ({ page, request }) => {
  const reset = await request.post("/api/dev/events/1/seats?left=12");
  expect(reset.ok()).toBeTruthy();
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("успешное оформление: взрослый и ребёнок, итог 3 000 ₽, заказ переживает перезагрузку", async ({ page }) => {
  await fillPerson(page, 1, "Олег", "40");
  await addPerson(page);
  await fillPerson(page, 2, "Аня", "8");
  await expectNoHorizontalScroll(page);

  await toReview(page);
  await expect(page.getByRole("timer")).toContainText("Места закреплены");
  await expect(page.locator(".total")).toContainText(/3\s000/);
  await expectNoHorizontalScroll(page);

  await confirm(page);
  await expect(page.getByRole("heading", { name: "Заказ оформлен" })).toBeVisible();
  await expect(page.locator(".total")).toContainText(/3\s000/);
  await expectNoHorizontalScroll(page);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Заказ оформлен" })).toBeVisible();
});

test("ребёнок без взрослого: заказ не проходит дальше формы", async ({ page }) => {
  await fillPerson(page, 1, "Аня", "8");
  await page.getByLabel("Email для заказа").fill("anna@example.com");
  await page.getByRole("button", { name: "Проверить заказ" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "от 18 лет" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Проверьте заказ" })).toHaveCount(0);
});

test("пустые поля подсвечиваются у нужных полей", async ({ page }) => {
  await page.getByRole("button", { name: "Проверить заказ" }).click();
  await expect(page.getByText("Укажите имя")).toBeVisible();
  await expect(page.getByText("Укажите возраст")).toBeVisible();
  await expect(page.getByText("Укажите корректный email")).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test("данные можно изменить до подтверждения, итог пересчитывается", async ({ page }) => {
  await fillPerson(page, 1, "Олег", "40");
  await toReview(page);
  await expect(page.locator(".total")).toContainText(/2\s000/);

  await page.getByRole("button", { name: "Изменить" }).click();
  await addPerson(page);
  await fillPerson(page, 2, "Аня", "8");
  await toReview(page);
  await expect(page.locator(".total")).toContainText(/3\s000/);
});

test("места закончились перед подтверждением", async ({ page }) => {
  await fillPerson(page, 1, "Олег", "40");
  await toReview(page);

  await page.getByRole("button", { name: "Мест 0", exact: true }).click();
  await confirm(page);

  await expect(page.getByRole("heading", { name: "Места закончились" })).toBeVisible();
  await expectNoHorizontalScroll(page);

  await page.getByRole("button", { name: "Вернуться к заказу" }).click();
  await expect(page.getByText("Билеты на это мероприятие закончились.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Проверить заказ" })).toBeDisabled();
});

test("осталось меньше мест, чем в заказе: уменьшаем состав и оформляем", async ({ page }) => {
  await fillPerson(page, 1, "Олег", "40");
  await addPerson(page);
  await fillPerson(page, 2, "Аня", "8");
  await addPerson(page);
  await fillPerson(page, 3, "Борис", "9");
  await toReview(page);

  await page.getByRole("button", { name: "Мест 1", exact: true }).click();
  await confirm(page);
  await expect(page.getByRole("heading", { name: "Мест меньше, чем в заказе" })).toBeVisible();

  await page.getByRole("button", { name: "Изменить состав заказа" }).click();
  await page.getByRole("button", { name: "Убрать участника 3" }).click();
  await page.getByRole("button", { name: "Убрать участника 2" }).click();
  await toReview(page);
  await confirm(page);
  await expect(page.getByRole("heading", { name: "Заказ оформлен" })).toBeVisible();
});

test("чужая бронь держит места: нехватка выясняется уже при проверке заказа", async ({ page, request }) => {
  await request.post("/api/dev/events/1/seats?left=4");
  const hold = await request.post("/api/holds", {
    data: {
      event_id: 1,
      email: "other@example.com",
      participants: [1, 2, 3, 4].map((n) => ({ name: `Гость ${n}`, age: 30 })),
    },
  });
  expect(hold.status()).toBe(201);

  await fillPerson(page, 1, "Олег", "40");
  await page.getByLabel("Email для заказа").fill("anna@example.com");
  await page.getByRole("button", { name: "Проверить заказ" }).click();
  await expect(page.getByRole("heading", { name: "Места закончились" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Проверьте заказ" })).toHaveCount(0);
});
