async function navigateToDate(date) {
  const link = await $(`[data-date='${date}']`);
  await link.waitForExist({ timeout: 10000 });
  await link.click();
  await browser.waitUntil(
    async () => (await $("#photoList").getAttribute("data-date")) === date,
    { timeout: 10000, timeoutMsg: `did not navigate to ${date}` },
  );
  await browser.waitUntil(
    async () => (await $$("[data-testid='photo-card']")).length > 0,
    { timeout: 10000, timeoutMsg: `no cards rendered for ${date}` },
  );
}

async function clickRecentPhotos() {
  const link = await $(".recent-photos-link");
  await link.waitForExist({ timeout: 30000 });
  await link.click();
  await browser.waitUntil(
    async () => (await $$("[data-testid='photo-card']")).length > 0,
    { timeout: 30000, timeoutMsg: "no cards rendered for Recent Photos" },
  );
}

async function ensureBurstModeOn() {
  const toggle = await $("[data-testid='burst-toggle']");
  await toggle.waitForExist({ timeout: 5000 });
  if ((await toggle.getAttribute("aria-pressed")) !== "true") {
    await toggle.click();
    await browser.waitUntil(
      async () => (await toggle.getAttribute("aria-pressed")) === "true",
      { timeout: 5000, timeoutMsg: "burst toggle did not turn on" },
    );
  }
}

describe("PhotoClove application", () => {
  // Reset to HOME before every spec so tests run independently of order.
  // HOME unmounts PhotosList (#photoList disappears) and the auto-close
  // effect closes any open PhotoDisplay via the currentViewKey change.
  beforeEach(async () => {
    const home = await $("[data-testid='nav-home']");
    if (await home.isExisting()) {
      await home.click();
      await browser.waitUntil(
        async () => {
          const listGone = !(await $("#photoList").isExisting());
          const displayGone = !(await $("#photos-display-wrapper").isExisting());
          return listGone && displayGone;
        },
        { timeout: 5000, timeoutMsg: "did not return to HOME" },
      );
    }
  });

  it("launches with the expected window title", async () => {
    const title = await browser.getTitle();
    expect(title).toMatch(/photoclove/i);
  });

  it("navigates to the photo list via the Recent Photos sidebar link", async () => {
    await clickRecentPhotos();
    expect(await $("#photoList").isExisting()).toBe(true);
  });

  it("opens PhotoDisplay when a card is clicked and closes via the close link", async () => {
    await clickRecentPhotos();

    const cards = await $$("[data-testid='photo-card']");
    expect(cards.length).toBeGreaterThan(0);
    const firstLink = await cards[0].$("a");
    await firstLink.scrollIntoView();
    await firstLink.click();

    const display = await $("#photos-display-wrapper");
    await display.waitForExist({ timeout: 10000 });

    const closeLink = await display.$("a=close");
    await closeLink.waitForExist({ timeout: 5000 });
    await closeLink.click();

    await browser.waitUntil(
      async () => !(await $("#photos-display-wrapper").isExisting()),
      { timeout: 5000, timeoutMsg: "PhotoDisplay did not close" },
    );
  });

  it("closes PhotoDisplay and shows the new list when switching dates", async () => {
    // Date (a) → open photo → switch to date (b)
    await navigateToDate("2022/05/23");

    const cards = await $$("[data-testid='photo-card']");
    const firstLink = await cards[0].$("a");
    await firstLink.scrollIntoView();
    await firstLink.click();

    const display = await $("#photos-display-wrapper");
    await display.waitForExist({ timeout: 10000 });

    const dateB = await $("[data-date='2022/12/01']");
    await dateB.click();

    // Wait for the new list to fully load before asserting on display state —
    // the wrapper briefly unmounts during loading regardless of the bug.
    await browser.waitUntil(
      async () => (await $("#photoList").getAttribute("data-date")) === "2022/12/01",
      { timeout: 10000, timeoutMsg: "did not navigate to 2022/12/01" },
    );
    await browser.waitUntil(
      async () => (await $$("[data-testid='photo-card']")).length === 2,
      { timeout: 10000, timeoutMsg: "expected 2 cards on 2022/12/01" },
    );
    expect(await $("#photos-display-wrapper").isExisting()).toBe(false);
  });

  it("collapses a burst sequence into a single representative with a +N badge", async () => {
    await navigateToDate("2022/05/23");
    await ensureBurstModeOn();

    // 6-photo burst + 1 outlier → 2 cards after grouping
    await browser.waitUntil(
      async () => (await $$("[data-testid='photo-card']")).length === 2,
      { timeout: 10000, timeoutMsg: "burst grouping did not collapse to 2 cards" },
    );

    const badges = await $$("[data-testid='burst-badge']");
    expect(badges.length).toBe(1);
    expect((await badges[0].getText()).trim()).toBe("+5");
  });

  it("expands a burst group into all member photos when its badge is clicked", async () => {
    await navigateToDate("2022/05/23");
    await ensureBurstModeOn();
    await browser.waitUntil(
      async () => (await $$("[data-testid='burst-badge']")).length === 1,
      { timeout: 10000, timeoutMsg: "burst badge did not appear" },
    );

    await (await $("[data-testid='burst-badge']")).click();

    await browser.waitUntil(
      async () => (await $$("[data-testid='photo-card']")).length === 6,
      { timeout: 10000, timeoutMsg: "burst group did not expand to 6 cards" },
    );
    expect((await $$("[data-testid='burst-badge']")).length).toBe(0);
  });
});
