function isEasterSunday(date) {
  const year = date.getFullYear();
  // Gregorian computus, including the century and late-April corrections.
  const cycle = year % 19;
  const century = Math.floor(year / 100);
  const yearInCentury = year % 100;
  const solarCorrection = Math.floor(century / 4);
  const lunarCorrection = Math.floor((century - Math.floor((century + 8) / 25) + 1) / 3);
  const epact = (19 * cycle + century - solarCorrection - lunarCorrection + 15) % 30;
  const weekdayCorrection = (32 + 2 * (century % 4) + 2 * Math.floor(yearInCentury / 4) - epact - yearInCentury % 4) % 7;
  const correction = Math.floor((cycle + 11 * epact + 22 * weekdayCorrection) / 451);
  const monthDay = epact + weekdayCorrection - 7 * correction + 114;
  return date.getMonth() === Math.floor(monthDay / 31) - 1
    && date.getDate() === monthDay % 31 + 1;
}
