// Shift type takes precedence over the person's job layer.
// "Until 20:00" and overnight duty are operational coverage for ALL rostered staff.
export const shiftLogMode = (user, shiftType) => {
  if (shiftType === "evening" || shiftType === "night") return "operational";
  if (user?.team === "SOC · L2" && shiftType === "morning") return "ticket_analysis";
  if ((user?.team === "SOC · L3" || user?.team === "Design & Automation") && shiftType === "morning") return "engineering";
  return "operational";
};

/** Default Layer 3 daytime engineering checklist; a specifically assigned
 * custom L3 checklist can replace it without impacting shared SOC cover duty.
 * Negative item IDs are deliberate: these are not original SOC routine KPIs.
 */
export const ENGINEERING_CHECKLIST = {
  id: null,
  version: -1,
  name: "Layer 3 · Engineering daily work",
  items: [
    { id: -301, title: "Manage and maintain security systems", kind: "basic", hint: "Review platform health and perform routine maintenance" },
    { id: -302, title: "System configuration and hardening", kind: "basic", hint: "Record configuration changes and hardening work" },
    { id: -303, title: "Bug fixing and troubleshooting", kind: "basic", hint: "Investigate defects, troubleshoot and apply fixes" },
    { id: -304, title: "Automation and scripting", kind: "basic", hint: "Develop or maintain SOC automation and integrations" },
    { id: -305, title: "Deployment and system updates", kind: "basic", hint: "Deploy and update tooling, rules and services" },
    { id: -306, title: "Technical improvements and documentation", kind: "basic", hint: "Track improvements, testing and technical documentation" },
  ].map((item) => ({ ...item, active: true, shiftTypes: ["morning"] })),
};
