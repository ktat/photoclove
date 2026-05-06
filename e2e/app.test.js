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
});
