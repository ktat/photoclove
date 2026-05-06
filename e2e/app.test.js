describe("PhotoClove application", () => {
  it("launches with the expected window title", async () => {
    const title = await browser.getTitle();
    expect(title).toMatch(/photoclove/i);
  });

  it("navigates to the photo list via the Recent Photos sidebar link", async () => {
    const recentLink = await $(".recent-photos-link");
    await recentLink.waitForExist({ timeout: 30000 });
    await recentLink.click();

    const photoList = await $("#photoList");
    await photoList.waitForExist({ timeout: 30000 });

    try {
      await browser.waitUntil(
        async () => {
          const cards = await $$("[data-testid='photo-card']");
          return cards.length > 0;
        },
        { timeout: 30000, timeoutMsg: "no photo cards rendered from test library" },
      );
    } catch (err) {
      const html = await photoList.getHTML();
      console.log("[debug] #photoList HTML (first 800 chars):\n", html.slice(0, 800));
      throw err;
    }
  });

  it("opens PhotoDisplay when a card is clicked and closes via the close link", async () => {
    const cards = await $$("[data-testid='photo-card']");
    expect(cards.length).toBeGreaterThan(0);

    const firstLink = await cards[0].$("a");
    await firstLink.scrollIntoView();
    // The <a> wrapper can be obscured by overlay siblings; trigger click via JS
    // so we exercise the React handler regardless of pointer-event interception.
    await browser.execute((el) => el.click(), firstLink);

    const display = await $("#photos-display-wrapper");
    await display.waitForExist({ timeout: 10000 });
    expect(await display.isExisting()).toBe(true);

    const closeLink = await display.$("a=close");
    await closeLink.waitForExist({ timeout: 5000 });
    await browser.execute((el) => el.click(), closeLink);

    await browser.waitUntil(
      async () => !(await $("#photos-display-wrapper").isExisting()),
      { timeout: 5000, timeoutMsg: "PhotoDisplay did not close" },
    );
  });

  it("closes PhotoDisplay and shows the new list when switching dates", async () => {
    // Navigate to date (a) = 2022/05/23
    const dateA = await $("[data-date='2022/05/23']");
    await dateA.waitForExist({ timeout: 10000 });
    await browser.execute((el) => el.click(), dateA);

    const photoList = await $("#photoList");
    await browser.waitUntil(
      async () => (await photoList.getAttribute("data-date")) === "2022/05/23",
      { timeout: 10000, timeoutMsg: "did not land on 2022/05/23" },
    );
    await browser.waitUntil(
      async () => (await $$("[data-testid='photo-card']")).length > 0,
      { timeout: 10000, timeoutMsg: "no cards on 2022/05/23" },
    );

    // Open photo (A) → PhotoDisplay opens
    const cards = await $$("[data-testid='photo-card']");
    const firstLink = await cards[0].$("a");
    await firstLink.scrollIntoView();
    await browser.execute((el) => el.click(), firstLink);

    const display = await $("#photos-display-wrapper");
    await display.waitForExist({ timeout: 10000 });

    // Switch to date (b) = 2022/12/01 while PhotoDisplay is open
    const dateB = await $("[data-date='2022/12/01']");
    await dateB.waitForExist({ timeout: 5000 });
    await browser.execute((el) => el.click(), dateB);

    // First wait for the new date's list to finish loading. The wrapper
    // briefly unmounts during loading (`shouldDisplay = !photoLoading &&
    // currentPhoto`) — checking only "wrapper gone" would catch that
    // transient state and falsely pass while the bug is present.
    await browser.waitUntil(
      async () => (await $("#photoList").getAttribute("data-date")) === "2022/12/01",
      { timeout: 10000, timeoutMsg: "did not navigate to 2022/12/01" },
    );
    await browser.waitUntil(
      async () => (await $$("[data-testid='photo-card']")).length === 2,
      { timeout: 10000, timeoutMsg: "expected 2 cards on 2022/12/01" },
    );

    // Bug: with the new list loaded, the PhotoDisplay overlay must not
    // come back showing photo (A) from the previous date.
    expect(await $("#photos-display-wrapper").isExisting()).toBe(false);
  });

  it("collapses a burst sequence into a single representative with a +N badge", async () => {
    // Navigate to 2022/05/23 — the fixture's only date with a burst group
    // (P1212647-P1212652 share a burst_group_id; P1212646 is a non-burst outlier).
    const dateLink = await $("[data-date='2022/05/23']");
    await dateLink.waitForExist({ timeout: 10000 });
    await browser.execute((el) => el.click(), dateLink);

    // Wait for date page to render
    const photoList = await $("#photoList");
    await browser.waitUntil(
      async () => (await photoList.getAttribute("data-date")) === "2022/05/23",
      { timeout: 10000, timeoutMsg: "did not navigate to 2022/05/23" },
    );

    // Enable burst grouping mode. Until this is on, the list is rendered via
    // the plain `date` handler which doesn't aggregate burst groups.
    const burstToggle = await $("[data-testid='burst-toggle']");
    await burstToggle.waitForExist({ timeout: 5000 });
    await browser.execute((el) => el.click(), burstToggle);

    // After grouping: 2 cards (1 burst rep + 1 outlier) instead of 7
    await browser.waitUntil(
      async () => {
        const cards = await $$("[data-testid='photo-card']");
        return cards.length === 2;
      },
      { timeout: 10000, timeoutMsg: "burst grouping did not collapse to 2 cards" },
    );

    const badges = await $$("[data-testid='burst-badge']");
    expect(badges.length).toBe(1);
    const badgeText = (await badges[0].getText()).trim();
    // 6 photos in the burst → representative shows +5
    expect(badgeText).toBe("+5");
  });
});
