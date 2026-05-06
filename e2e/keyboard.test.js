// Keyboard shortcut e2e tests for PhotosListMini (photo display mode).
//
// Shortcuts tested here are defined in:
//   src/App/PhotosList/PhotosListMini/useKeyboardShortcuts.js
//
// Key  Code  Action
// →    39    Next photo
// ←    37    Previous photo
// ↓    40    Close thumbnail strip
// ↑    38    Open thumbnail strip
// s    83    Increase star rating
// d    68    Decrease star rating
// i    73    Toggle right info panel
// f    70    Favorite (select + increase star)

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

async function openFirstPhoto(isoDate) {
  await navigateToDate(isoDate);
  const firstLink = await (await $$("[data-testid='photo-card']"))[0].$("a");
  await firstLink.scrollIntoView();
  await firstLink.click();
  await (await $("#photos-display-wrapper")).waitForExist({ timeout: 10000 });
}

async function closePhotoDisplay() {
  const closeLink = await (await $("#photos-display-wrapper")).$("a=close");
  await closeLink.waitForExist({ timeout: 5000 });
  await closeLink.click();
  await browser.waitUntil(
    async () => !(await $("#photos-display-wrapper").isExisting()),
    { timeout: 5000, timeoutMsg: "PhotoDisplay did not close" },
  );
}

describe("PhotoClove keyboard shortcuts", () => {
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

  it("→ navigates to the next photo and ← returns to the previous one", async () => {
    // 2022-12-01 has 2 photos (a.jpg at index 0, b.jpg at index 1)
    await openFirstPhoto("2022-12-01");

    await browser.waitUntil(
      async () => (await $$("#photos-list-mini img[style*='3px solid']")).length > 0,
      { timeout: 5000, timeoutMsg: "no highlighted thumbnail in mini strip initially" },
    );
    const srcBefore = await (
      await $$("#photos-list-mini img[style*='3px solid']")
    )[0].getAttribute("src");

    // → moves to next photo — the highlighted thumbnail src should change
    await browser.keys("ArrowRight");
    await browser.waitUntil(
      async () => {
        const highlighted = await $$("#photos-list-mini img[style*='3px solid']");
        if (highlighted.length === 0) return false;
        return (await highlighted[0].getAttribute("src")) !== srcBefore;
      },
      { timeout: 5000, timeoutMsg: "highlighted thumbnail did not change after ArrowRight" },
    );

    // ← moves back — the highlighted thumbnail src should return to srcBefore
    await browser.keys("ArrowLeft");
    await browser.waitUntil(
      async () => {
        const highlighted = await $$("#photos-list-mini img[style*='3px solid']");
        if (highlighted.length === 0) return false;
        return (await highlighted[0].getAttribute("src")) === srcBefore;
      },
      { timeout: 5000, timeoutMsg: "highlighted thumbnail did not return after ArrowLeft" },
    );
  });

  it("↓ closes the thumbnail strip and ↑ reopens it", async () => {
    await openFirstPhoto("2022-12-01");

    // Strip starts open
    await browser.waitUntil(
      async () => (await $("#photos-list-mini").getAttribute("class")) === "photosListMini",
      { timeout: 5000, timeoutMsg: "thumbnail strip did not start in open state" },
    );

    // ↓ closes the strip
    await browser.keys("ArrowDown");
    await browser.waitUntil(
      async () => (await $("#photos-list-mini").getAttribute("class")) === "photosListMiniClosed",
      { timeout: 5000, timeoutMsg: "thumbnail strip did not close after ArrowDown" },
    );

    // ↑ reopens the strip
    await browser.keys("ArrowUp");
    await browser.waitUntil(
      async () => (await $("#photos-list-mini").getAttribute("class")) === "photosListMini",
      { timeout: 5000, timeoutMsg: "thumbnail strip did not reopen after ArrowUp" },
    );
  });

  it("s increases star rating and d decreases it back to zero", async () => {
    // 2022-12-02 has 1 photo (b.jpg, star = 0 in fixture)
    await openFirstPhoto("2022-12-02");

    // s: star 0 → 1
    await browser.keys("s");
    await closePhotoDisplay();
    await browser.waitUntil(
      async () =>
        (await (await $$("[data-testid='photo-card']"))[0].getText()).includes("⭐1"),
      { timeout: 5000, timeoutMsg: "⭐1 did not appear on card after 's' key" },
    );

    // Reopen and press d: star 1 → 0
    await (await (await $$("[data-testid='photo-card']"))[0].$("a")).click();
    await (await $("#photos-display-wrapper")).waitForExist({ timeout: 10000 });

    await browser.keys("d");
    await closePhotoDisplay();
    await browser.waitUntil(
      async () =>
        !(await (await $$("[data-testid='photo-card']"))[0].getText()).includes("⭐"),
      { timeout: 5000, timeoutMsg: "star badge did not disappear after 'd' key" },
    );
  });

  it("i opens the right info panel and i again closes it", async () => {
    await openFirstPhoto("2022-12-01");

    // Defensive: ensure the panel is closed before the test
    if (await $(".rightMenu").isExisting()) {
      await browser.keys("i");
      await browser.waitUntil(
        async () => !(await $(".rightMenu").isExisting()),
        { timeout: 3000 },
      );
    }

    // i → panel opens
    await browser.keys("i");
    await browser.waitUntil(
      async () => (await $(".rightMenu").isExisting()),
      { timeout: 5000, timeoutMsg: "right-menu panel did not open after 'i'" },
    );

    // i again → panel closes
    await browser.keys("i");
    await browser.waitUntil(
      async () => !(await $(".rightMenu").isExisting()),
      { timeout: 5000, timeoutMsg: "right-menu panel did not close after second 'i'" },
    );
  });

  it("f favorites a photo – selects it and adds a star badge in one keystroke", async () => {
    // 2022-12-02: b.jpg, star = 0, not selected initially
    await openFirstPhoto("2022-12-02");

    // f: select + increase star
    await browser.keys("f");
    await closePhotoDisplay();

    await browser.waitUntil(
      async () => {
        const card = (await $$("[data-testid='photo-card']"))[0];
        const cls = await card.getAttribute("class");
        const text = await card.getText();
        return cls?.includes("cardSelected") && text.includes("⭐");
      },
      { timeout: 5000, timeoutMsg: "photo was not favorited (expected cardSelected + ⭐)" },
    );
  });
});
