chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ lockedIn: false });
  refreshBlockingRules().catch((error: unknown) =>
    console.error("Unable to initialize prohibited-site rules", error),
  );
});

async function refreshBlockingRules(): Promise<void> {
  const { lockedIn = false, prohibitedSites = [] } = await chrome.storage.local.get([
    "lockedIn",
    "prohibitedSites",
  ]);
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const rules = lockedIn
    ? (prohibitedSites as string[]).map((host, index) => ({
        id: index + 1,
        priority: 1,
        action: { type: "block" as const },
        condition: {
          requestDomains: [host],
          resourceTypes: ["main_frame" as const],
        },
      }))
    : [];

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existingRules.map((rule) => rule.id),
    addRules: rules,
  });
}

chrome.storage.onChanged.addListener(() => {
  refreshBlockingRules().catch((error: unknown) =>
    console.error("Unable to refresh prohibited-site rules", error),
  );
});

chrome.runtime.onStartup.addListener(() => {
  refreshBlockingRules().catch((error: unknown) =>
    console.error("Unable to restore prohibited-site rules", error),
  );
});

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));