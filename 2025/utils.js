(function () {
  window.addDays = function(date, days) {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() + days);
    return newDate;
  };

  window.addHours = function(date, hours, minutes) {
    const newDate = new Date(date);
    newDate.setHours(newDate.getHours() + hours);
    newDate.setMinutes(newDate.getMinutes() + (minutes || 0));
    return newDate;
  };

  window.dateToString = function(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  window.timeZoneMessage = function() {
    const localTimeZone = (typeof luxon !== 'undefined')
      ? luxon.DateTime.local().zoneName
      : Intl.DateTimeFormat().resolvedOptions().timeZone;
    return `Times are displayed in ${localTimeZone} time.<br>Sessions are 1 hour long with 30-minute breaks between.`;
  };
})();
