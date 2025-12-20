export const cn = (...classes: (string | undefined | false | null)[]) =>
  classes.filter(Boolean).join(' ');
