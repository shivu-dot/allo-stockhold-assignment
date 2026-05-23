const DEFAULT_RESERVATION_TTL_MINUTES = 10;

export function getReservationTtlMinutes() {
  const value = Number(process.env.RESERVATION_TTL_MINUTES ?? DEFAULT_RESERVATION_TTL_MINUTES);

  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_RESERVATION_TTL_MINUTES;
  }

  return Math.floor(value);
}
