export function getPossiblePhoneDetectorStatus() {
  return {
    available: false,
    status: "not_configured",
    message: "Possible-phone detection is not configured; no camera object inference runs.",
  };
}

export async function createPossiblePhoneDetector() {
  return getPossiblePhoneDetectorStatus();
}
