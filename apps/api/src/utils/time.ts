export const parseDurationMs = (input: string): number => {
  const m = String(input).trim().match(/^(\d+)(ms|s|m|h|d)$/i);
  if (!m) throw new Error(`Invalid duration: ${input}`);
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  switch (unit) {
    case 'ms':
      return n;
    case 's':
      return n * 1000;
    case 'm':
      return n * 60_000;
    case 'h':
      return n * 3_600_000;
    case 'd':
      return n * 86_400_000;
    default:
      throw new Error(`Unsupported unit: ${unit}`);
  }
};

