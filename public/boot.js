// Runs before the window is first drawn, so the loading screen already wears the
// colors of the last session. The app writes this record (src/splash.ts).
(function () {
  var root = document.documentElement;
  // Before 3.0 the app was Nebula Terminal and saved everything under that name.
  // Moved rather than copied: the settings can hold an image too big to store twice.
  try {
    var former = "nebula-terminal.";
    var names = [];
    for (var index = 0; index < localStorage.length; index += 1) {
      var name = localStorage.key(index);
      if (name && name.indexOf(former) === 0) names.push(name);
    }
    names.forEach(function (name) {
      var current = "shelduck." + name.slice(former.length);
      if (localStorage.getItem(current) !== null) return;
      var value = localStorage.getItem(name);
      localStorage.removeItem(name);
      try {
        localStorage.setItem(current, value);
      } catch (error) {
        localStorage.setItem(name, value);
      }
    });
  } catch (error) {
    // No storage: nothing to move.
  }
  try {
    var boot = JSON.parse(localStorage.getItem("shelduck.boot.v1") || "null");
    if (boot && typeof boot === "object") {
      var color = function (value) {
        return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : null;
      };
      [["--term-bg", boot.background], ["--term-fg", boot.foreground], ["--accent", boot.accent]].forEach(function (entry) {
        var value = color(entry[1]);
        if (value) root.style.setProperty(entry[0], value);
      });
      if (boot.scheme === "light" || boot.scheme === "dark") root.dataset.scheme = boot.scheme;
      if (boot.animation === "reduced" || boot.animation === "off") root.dataset.animation = boot.animation;
    }
  } catch (error) {
    // No storage, or a record from elsewhere: the default colors will do.
  }
  // Documentation screenshots skip the loading screen.
  if (location.hash === "#screenshot") root.dataset.animation = "off";
})();
