window.utils = window.utils || {};
// utils.settings = JSON.parse(localStorage.getItem("Settings") || '{}');
// utils.isInsecure = utils.settings.UseInsecureConnection === true;
// utils.savedDomain = "livehrms.liveplatform.com";
// utils.GlobalDomain = (utils.isInsecure ? "http://" : "https://") + utils.savedDomain;
// utils.SecondaryDomain = (utils.isInsecure ? "http://" : "https://") + (localStorage.getItem("secondaryDomain") || "liveplatform.com");
// utils.UserData = JSON.parse(localStorage.getItem("UserData"));
// utils.currentUserId = null;
// utils.quickNotesDRI = null;
// utils.remindersDRI = null;
// utils.EnterpriseList = [];
// utils.enterpriseItemsCache = null;
// window.utils = window.utils || {};

utils.showLoader = function () {
  var loader = document.getElementById("loader-container");
  if (loader) loader.classList.remove("-hidden");
};

utils.hideLoader = function () {
  var loader = document.getElementById("loader-container");
  if (loader) loader.classList.add("-hidden");
};
utils.debounce = function(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
};
utils.showContextLoader = function () {
  var loader = document.getElementById("contextsLoader");
  if (loader) {
    loader.classList.remove("hidden");
    loader.style.display = "flex";
  }
};
utils.hideContextLoader = function () {
  var loader = document.getElementById("contextsLoader");
  if (loader) {
    loader.classList.add("hidden");
    loader.style.display = "none";
  }
};
utils.showSnackbar = function (message, type = "success", duration = 2500) {
    var snackbar = document.getElementById("snackbar");

    if (!snackbar) {
        snackbar = document.createElement("div");
        snackbar.id = "snackbar";
        document.body.appendChild(snackbar);
    }

    snackbar.className = "";
    snackbar.classList.add("show", type);
    snackbar.textContent = message;

    clearTimeout(utils.snackbarTimer);

    utils.snackbarTimer = setTimeout(function () {
        snackbar.classList.remove("show");
    }, duration);
};

