// Click a date link by its ISO key (YYYY-MM-DD). data-date on both the
// sidebar link and #photoList is now ISO regardless of runtime locale.
async function navigateToDate(isoDate) {
  const link = await $(`[data-date='${isoDate}']`);
  await link.waitForExist({ timeout: 10000 });
  await link.click();
  await browser.waitUntil(
    async () => (await $("#photoList").getAttribute("data-date")) === isoDate,
    { timeout: 10000, timeoutMsg: `did not navigate to ${isoDate}` },
  );
  await browser.waitUntil(
    async () => (await $$("[data-testid='photo-card']")).length > 0,
    { timeout: 10000, timeoutMsg: `no cards rendered for ${isoDate}` },
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

async function ensureBurstModeOff() {
  const toggle = await $("[data-testid='burst-toggle']");
  await toggle.waitForExist({ timeout: 5000 });
  if ((await toggle.getAttribute("aria-pressed")) === "true") {
    await toggle.click();
    await browser.waitUntil(
      async () => (await toggle.getAttribute("aria-pressed")) !== "true",
      { timeout: 5000, timeoutMsg: "burst toggle did not turn off" },
    );
  }
}

async function navigateToAlbumList() {
  const link = await $("[data-testid='nav-albums']");
  await link.waitForExist({ timeout: 10000 });
  await link.click();
  await browser.waitUntil(
    async () => (await $(".albums").isExisting()),
    { timeout: 10000, timeoutMsg: "album list did not appear" },
  );
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
    await navigateToDate("2022-05-23");

    const cards = await $$("[data-testid='photo-card']");
    const firstLink = await cards[0].$("a");
    await firstLink.scrollIntoView();
    await firstLink.click();

    const display = await $("#photos-display-wrapper");
    await display.waitForExist({ timeout: 10000 });

    const dateB = "2022-12-01";
    await (await $(`[data-date='${dateB}']`)).click();

    // Wait for the new list to fully load before asserting on display state —
    // the wrapper briefly unmounts during loading regardless of the bug.
    await browser.waitUntil(
      async () => (await $("#photoList").getAttribute("data-date")) === dateB,
      { timeout: 10000, timeoutMsg: `did not navigate to ${dateB}` },
    );
    await browser.waitUntil(
      async () => (await $$("[data-testid='photo-card']")).length === 2,
      { timeout: 10000, timeoutMsg: `expected 2 cards on ${dateB}` },
    );
    expect(await $("#photos-display-wrapper").isExisting()).toBe(false);
  });

  it("collapses a burst sequence into a single representative with a +N badge", async () => {
    await navigateToDate("2022-05-23");
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

  it("opens a tag from the tag list and shows its associated photos", async () => {
    // Fixture: tag 'bird' (id=9) is associated with 2022-12-01/a.jpg and b.jpg.
    await (await $("[data-testid='nav-tags']")).click();

    const birdTag = await $("[data-testid='generic-list-item'][data-item-name='bird']");
    await birdTag.waitForExist({ timeout: 10000 });
    await birdTag.click();

    const photoList = await $("#photoList");
    await photoList.waitForExist({ timeout: 10000 });
    await browser.waitUntil(
      async () => (await $$("[data-testid='photo-card']")).length === 2,
      { timeout: 10000, timeoutMsg: "expected 2 photos under tag 'bird'" },
    );
  });

  it("closes PhotoDisplay when leaving a tag back to HOME", async () => {
    // Open tag 'bird' → open one of its photos → click HOME.
    // viewMode TAG → HOME flips currentViewKey, so the auto-close effect
    // must drop the open PhotoDisplay (covers the original viewMode-change
    // path of the same fix).
    await (await $("[data-testid='nav-tags']")).click();
    const birdTag = await $("[data-testid='generic-list-item'][data-item-name='bird']");
    await birdTag.waitForExist({ timeout: 10000 });
    await birdTag.click();

    await browser.waitUntil(
      async () => (await $$("[data-testid='photo-card']")).length === 2,
      { timeout: 10000, timeoutMsg: "tag photos did not load" },
    );

    const cards = await $$("[data-testid='photo-card']");
    const firstLink = await cards[0].$("a");
    await firstLink.scrollIntoView();
    await firstLink.click();

    const display = await $("#photos-display-wrapper");
    await display.waitForExist({ timeout: 10000 });

    await (await $("[data-testid='nav-home']")).click();

    await browser.waitUntil(
      async () => !(await $("#photos-display-wrapper").isExisting()),
      { timeout: 5000, timeoutMsg: "PhotoDisplay did not close on HOME" },
    );
  });

  it("expands a burst group into all member photos when its badge is clicked", async () => {
    await navigateToDate("2022-05-23");
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

  it("shows all 7 individual photos on 2022-05-23 when burst mode is off", async () => {
    await navigateToDate("2022-05-23");
    await ensureBurstModeOff();

    await browser.waitUntil(
      async () => (await $$("[data-testid='photo-card']")).length === 7,
      { timeout: 10000, timeoutMsg: "expected 7 cards when burst mode is off" },
    );
    expect((await $$("[data-testid='burst-badge']")).length).toBe(0);
  });

  it("navigates between consecutive dates showing the correct photo counts", async () => {
    await navigateToDate("2022-12-01");
    await browser.waitUntil(
      async () => (await $$("[data-testid='photo-card']")).length === 2,
      { timeout: 10000, timeoutMsg: "expected 2 cards on 2022-12-01" },
    );

    await navigateToDate("2022-12-02");
    await browser.waitUntil(
      async () => (await $$("[data-testid='photo-card']")).length === 1,
      { timeout: 10000, timeoutMsg: "expected 1 card on 2022-12-02" },
    );

    await navigateToDate("2022-12-03");
    await browser.waitUntil(
      async () => (await $$("[data-testid='photo-card']")).length === 1,
      { timeout: 10000, timeoutMsg: "expected 1 card on 2022-12-03" },
    );
  });

  it("navigates to album list and shows the 'ts' album", async () => {
    await navigateToAlbumList();

    const tsAlbum = await $("[data-testid='generic-list-item'][data-item-name='ts']");
    await tsAlbum.waitForExist({ timeout: 5000 });
    expect(await tsAlbum.isExisting()).toBe(true);
  });

  it("opens album 'ts' from the album list and shows the album photo view", async () => {
    await navigateToAlbumList();

    const tsAlbum = await $("[data-testid='generic-list-item'][data-item-name='ts']");
    await tsAlbum.waitForExist({ timeout: 5000 });
    await tsAlbum.click();

    const photoList = await $("#photoList");
    await photoList.waitForExist({ timeout: 10000 });
    expect(await photoList.isExisting()).toBe(true);
  });

  it("tag list shows multiple tags", async () => {
    await (await $("[data-testid='nav-tags']")).click();

    await browser.waitUntil(
      async () => (await $$("[data-testid='generic-list-item']")).length >= 3,
      { timeout: 10000, timeoutMsg: "expected at least 3 tags in the list" },
    );
  });

  it("opens tag 'test' and shows its 2 associated photos", async () => {
    await (await $("[data-testid='nav-tags']")).click();

    const testTag = await $("[data-testid='generic-list-item'][data-item-name='test']");
    await testTag.waitForExist({ timeout: 10000 });
    await testTag.click();

    await browser.waitUntil(
      async () => (await $$("[data-testid='photo-card']")).length === 2,
      { timeout: 10000, timeoutMsg: "expected 2 photos under tag 'test'" },
    );
  });

  it("navigates to trash view", async () => {
    const trashNav = await $("[data-testid='nav-trash']");
    await trashNav.waitForExist({ timeout: 5000 });
    await trashNav.click();

    const photoList = await $("#photoList");
    await photoList.waitForExist({ timeout: 10000 });
    expect(await photoList.isExisting()).toBe(true);
  });

  // ── Selection tests ─────────────────────────────────────────────────────────

  it("selects a photo via its checkbox in the photo list", async () => {
    await navigateToDate("2022-12-01");

    const cards = await $$("[data-testid='photo-card']");
    expect(cards.length).toBe(2);

    // Click the visible checkbox label on the first card
    const checkboxLabel = await cards[0].$("label.checkbox-photo");
    await checkboxLabel.scrollIntoView();
    await checkboxLabel.click();

    await browser.waitUntil(
      async () => {
        const cls = await (await $$("[data-testid='photo-card']"))[0].getAttribute("class");
        return cls?.includes("cardSelected");
      },
      { timeout: 5000, timeoutMsg: "photo card did not become selected after checkbox click" },
    );
  });

  it("toggles photo selection on/off via the 'c' key while in PhotoDisplay", async () => {
    await navigateToDate("2022-12-01");

    const cards = await $$("[data-testid='photo-card']");
    const firstLink = await cards[0].$("a");
    await firstLink.scrollIntoView();
    await firstLink.click();
    await (await $("#photos-display-wrapper")).waitForExist({ timeout: 10000 });

    // 1st c → select
    await browser.keys("c");

    const closeLink = await (await $("#photos-display-wrapper")).$("a=close");
    await closeLink.waitForExist({ timeout: 5000 });
    await closeLink.click();
    await browser.waitUntil(
      async () => !(await $("#photos-display-wrapper").isExisting()),
      { timeout: 5000, timeoutMsg: "PhotoDisplay did not close" },
    );

    await browser.waitUntil(
      async () => {
        const allCards = await $$("[data-testid='photo-card']");
        for (const card of allCards) {
          if ((await card.getAttribute("class"))?.includes("cardSelected")) return true;
        }
        return false;
      },
      { timeout: 5000, timeoutMsg: "card did not become selected after first 'c'" },
    );

    // Reopen the same photo and press 'c' again → deselect
    await (await (await $$("[data-testid='photo-card']"))[0].$("a")).click();
    await (await $("#photos-display-wrapper")).waitForExist({ timeout: 10000 });

    await browser.keys("c");

    const closeLink2 = await (await $("#photos-display-wrapper")).$("a=close");
    await closeLink2.waitForExist({ timeout: 5000 });
    await closeLink2.click();
    await browser.waitUntil(
      async () => !(await $("#photos-display-wrapper").isExisting()),
      { timeout: 5000, timeoutMsg: "PhotoDisplay did not close on second open" },
    );

    await browser.waitUntil(
      async () => {
        const allCards = await $$("[data-testid='photo-card']");
        for (const card of allCards) {
          if ((await card.getAttribute("class"))?.includes("cardSelected")) return false;
        }
        return true;
      },
      { timeout: 5000, timeoutMsg: "card was not deselected after second 'c'" },
    );
  });

  // ── Deletion tests ───────────────────────────────────────────────────────────

  it("moves a photo to trash via the Del key in PhotoDisplay", async () => {
    // 2022-12-03 has exactly 1 photo (c.jpg) — easy to verify disappearance
    await navigateToDate("2022-12-03");
    const cards = await $$("[data-testid='photo-card']");
    expect(cards.length).toBe(1);

    const firstLink = await cards[0].$("a");
    await firstLink.scrollIntoView();
    await firstLink.click();
    await (await $("#photos-display-wrapper")).waitForExist({ timeout: 10000 });

    // Del key triggers the move-to-trash confirmation
    await browser.keys("Delete");

    const confirmBtn = await $("button=Move to Trash");
    await confirmBtn.waitForExist({ timeout: 5000 });
    await confirmBtn.click();

    // The photo should be removed from the list
    await browser.waitUntil(
      async () => (await $$("[data-testid='photo-card']")).length === 0,
      { timeout: 10000, timeoutMsg: "photo was not removed from list after Del + confirm" },
    );
  });

  it("moves selected photos to trash via the right sidebar delete operation", async () => {
    await navigateToDate("2022-12-01"); // 2 photos: a.jpg and b.jpg

    const cards = await $$("[data-testid='photo-card']");
    expect(cards.length).toBe(2);

    // Select all photos via checkboxes — selecting the first triggers the
    // sidebar to open automatically (useSelectionTabEffect)
    for (const card of cards) {
      const label = await card.$("label.checkbox-photo");
      await label.scrollIntoView();
      await label.click();
    }

    // Wait for both cards to be marked selected
    await browser.waitUntil(
      async () => {
        const allCards = await $$("[data-testid='photo-card']");
        let selected = 0;
        for (const card of allCards) {
          const cls = await card.getAttribute("class");
          if (cls?.includes("cardSelected")) selected++;
        }
        return selected === 2;
      },
      { timeout: 5000, timeoutMsg: "both photo cards did not become selected" },
    );

    // The right sidebar opens automatically; choose "deleteFiles" from the dropdown
    const opDropdown = await $("div.operation select");
    await opDropdown.waitForExist({ timeout: 5000 });
    await opDropdown.selectByAttribute("value", "deleteFiles");

    // Confirm the modal
    const confirmBtn = await $("button=Move to Trash");
    await confirmBtn.waitForExist({ timeout: 5000 });
    await confirmBtn.click();

    // All selected photos should be removed from the list
    await browser.waitUntil(
      async () => (await $$("[data-testid='photo-card']")).length === 0,
      { timeout: 10000, timeoutMsg: "photos were not removed from list after sidebar delete" },
    );
  });
});
