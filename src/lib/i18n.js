export const i18n = {
  setup: {
    title: "Welcome",
    nameLabel: "What should we call you? (Optional)",
    namePlaceholder: "Your name",
    currencyLabel: "Currency symbol",
    cycleDayLabel: "What day does your money usually arrive?",
    cycleDayHelp: "This suggests your cycle dates (1-28).",
    themeLabel: "Theme",
    finish: "Start tracking",
  },
  home: {
    greeting: (name) => name ? `Good evening, ${name}` : "Good evening",
    remainingOf: (amount) => `remaining of ${amount}`,
    spentToday: "Today",
    totalSpent: "Spent",
    daysLeft: "Days left",
    daily: "Daily",
    cycleEnded: "Cycle ended",
    startNewCycle: "Start new cycle",
    categoryBreakdown: "Category breakdown",
    unassigned: "Unassigned expenses",
  },
  add: {
    title: "Add expense",
    amountPlaceholder: "0",
    notePlaceholder: "What was this for? (Optional)",
    save: "Save",
  },
  // We can expand this later
}
