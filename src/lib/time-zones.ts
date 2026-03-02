const fallbackTimeZones = [
  "UTC",
  "Europe/London",
  "Europe/Warsaw",
  "Europe/Paris",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Singapore",
  "Australia/Sydney",
];

const getSupportedTimeZones = () => {
  const intlWithSupportedValuesOf = Intl as typeof Intl & {
    supportedValuesOf?: (key: "timeZone") => string[];
  };

  if (!intlWithSupportedValuesOf.supportedValuesOf) {
    return fallbackTimeZones;
  }

  const zones = intlWithSupportedValuesOf.supportedValuesOf("timeZone");
  const withoutUtc = zones.filter((zone) => zone !== "UTC").sort((a, b) => a.localeCompare(b));
  return ["UTC", ...withoutUtc];
};

export const householdTimeZones = getSupportedTimeZones();
