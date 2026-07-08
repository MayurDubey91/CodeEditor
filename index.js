//var GlobalDomain = localStorage.getItem("globalDomain") ? 'https://' + localStorage.getItem("globalDomain") : "https://liveplatform.com";
var settings = JSON.parse(localStorage.getItem("Settings") || '{}');
var isInsecure = settings.UseInsecureConnection === true;
var platformDomain = "https://livehrms.liveplatform.com";
var savedDomain = "livehrms.liveplatform.com";
var GlobalDomain = (isInsecure ? "http://" : "https://") +  savedDomain;
var SecondaryDomain = (isInsecure ? "http://" : "https://") + (localStorage.getItem("secondaryDomain") || "liveplatform.com");
var UserData = JSON.parse(localStorage.getItem("GlobalUserData") || '{}');
var currentUserId = null;
var quickNotesDRI = null;
var remindersDRI = null;
var EnterpriseList = [];
var enterpriseItemsCache = null;
// Global object
var Clouds = {};
//window.Clouds = window.Clouds || {};
var electronPlugin = function () {
  this.init();
};
electronPlugin.prototype = {
  init: function () {
    //this.loadSVG();
    this.fetchCurrentUserId();
    this.listenForMenuClicks();
    if (!window.isTileWindow) {
      this.loadDefaultPage();
    }
    this.setupMenuHighlighting();
    this.loadEnterpriseInfo();
    //this.loadUserInfo();
    this.initAutoStartCheckbox();
    this.loadEnterpriseList();
    this.ensureDefaultEnterprise();
    //this.loadReminders();
    this.setupEnterpriseLogoClick();
  },
  // loadSVG : function() {
  //   var _container = document.getElementById("SVGContainer");
  //   fetch("https://liveplatform.com/SVG.htm")
  //   .then(res => res.text())
  //   .then(html => {
  //     _container.innerHTML = html;
  //   });
  // },
  loadRemindersCloud: function () {
    Clouds.Reminders = Clouds.Reminders || {};
    // cache hit
    if (Clouds.Reminders.CloudDetails) {
      remindersDRI = Clouds.Reminders.CloudDetails.DRI;
      return Promise.resolve({ Results: Clouds.Reminders.CloudDetails });
    }

    return useFetch("/UseCloud.json?Name=[LivePlatform]Reminders")
    .then(res => res.json())
    .then(data => {
      if (data && data.Results) {
        Clouds.Reminders.CloudDetails = data.Results;
        remindersDRI = data.Results.DRI;
      }
      return data;
    })
    .catch(err => {
      console.error("Reminders UseCloud load failed:", err);
    });
  },
  loadReminderItems: function () {
    if (!remindersDRI) return Promise.resolve();
    Clouds.Reminders = Clouds.Reminders || {};
    // cache hit
    if (Clouds.Reminders.ItemsDetails && Clouds.Reminders.ItemsDetails.length > 0) {
      return Promise.resolve({ Results: Clouds.Reminders.ItemsDetails });
    }
    return useFetch(remindersDRI + "/Items.json?Fields=Name||Description||Start Date and Time||Recurring")
    .then(res => res.json())
    .then(data => {
      if (data && data.Results) {
        Clouds.Reminders.ItemsDetails = data.Results;
      }
      return data;
    })
    .catch(err => {
      console.error("Reminders Items load failed:", err);
    });
  },

  loadReminders: function () {
    var self = this;
    this.loadRemindersCloud()
    .then(data => {
      if ((data && data.Results && data.Results.DRI) || remindersDRI) {
        return self.loadReminderItems();
      }
    });
  },
  initAutoStartCheckbox: function () {
    var autoLaunchCheckbox = document.getElementById('autoLaunchCheckbox');
    if (autoLaunchCheckbox) {
      //fetch current setting
      window.electronAPI.getAutoStartStatus().then((settings) => {
        if (settings && typeof settings.openAtLogin === 'boolean') {
          autoLaunchCheckbox.checked = settings.openAtLogin;
        }
      });
      //user checkbox toggle
      autoLaunchCheckbox.addEventListener('change', function () {
        var enabled = this.checked;
        window.electronAPI.setAutoStart(enabled);
      });
    }
  },
  listenForMenuClicks: function () {
    var menuItems = document.querySelectorAll('.-header-menu-item');
    var content = document.querySelector('.-main-content-container');
    var that = this;
    // var userImage = document.querySelector('.-user-image');
    // var userInitials = document.querySelector('.-user-initials');
    var userProfileDiv = document.querySelector('.-user-profile-div');
    //var userImage = userProfileDiv.querySelector('.-user-image');
    //var userInitials = userProfileDiv.querySelector('.-user-initials');
    var tileContainer = document.querySelector('.tile-container');

    menuItems.forEach(item => {
      item.addEventListener('click', () => {
        var page = item.getAttribute('data-page');
        var currentPage = content.getAttribute("data-current-page");

        if (page === "codeEditor.html") {
          window.electronAPI.openCodeEditorWindow();
          return;
        }

        if (tileContainer) tileContainer.style.display = 'none';
        userProfileDiv.classList.remove("active");

        if (page && content) {
          localStorage.setItem("lastClickedMenuPage", page);

          fetch(page)
          .then(res => res.text())
          .then(html => {
            content.setAttribute('data-current-page', page);
            that.loadHTMLContent(content, html);
          })
          .catch(err => {
            content.innerHTML = "<p>Error loading " + page + "</p>";
          });
        }
      });
    });
  },

  loadDefaultPage: function () {
    localStorage.setItem("lastClickedMenuPage", "dashboard.htm");
    var content = document.getElementsByClassName("-main-content-container")[0];
    if (content) {
      fetch("dashboard.htm")
      .then(res => res.text())
      .then(html => {
        this.loadHTMLContent(content, html);
        document.title = "LiveHRMS (Dashboard)";
        content.setAttribute("data-current-page", "dashboard.htm");
        this.activeMenuPage = "dashboard.htm";
        this.userFunctionality();
        this.setupMenuHighlighting();
      })
      .catch(() => {
        content.innerHTML = "<p>Error loading dashboard</p>";
      });
    }
  },

  loadEnterpriseList: function () {
    var cached = localStorage.getItem("enterpriseListCache");
    if (cached) {
      try {
        enterpriseItemsCache = JSON.parse(cached);
        return;
      } catch (e) {
      }
    }
    // Get Cloud DRI
    var enterpriseCloudUrl = "/UseCloud.json?Name=[LivePlatform]Enterprises";
    useFetch(enterpriseCloudUrl)
    .then(res => res.json())
    .then(data => {
      var cloudDRI = data.Results.DRI;
      if (!cloudDRI) throw new Error("Cloud DRI not found");
      return useFetch(cloudDRI + "/Items.json?Fields=Name||Domain&Order=Name,Asc");
    })
    .then(res => res.json())
    .then(data => {
      enterpriseItemsCache = data.Results || [];
      if (enterpriseItemsCache.length > 0) {
        localStorage.setItem("enterpriseListCache", JSON.stringify(enterpriseItemsCache));
      } else {
      }
    })
    .catch(err => {
      console.error("Failed to load enterprise list:", err);
    });
  },

  setupEnterpriseLogoClick: function () {
    var self = this;
    this.logoWrapper = document.getElementById("activeEnterpriseName");
    this.enterprisePopup = document.getElementById("enterprise-popup");
    this.enterpriseListContainer = document.getElementById("enterprise-list");
    if (!this.logoWrapper) return;
    this.logoWrapper.addEventListener("click", function (e) {
      if (e.target.closest("#enterprise-popup")) return;

      var shouldShow = self.enterprisePopup.style.display === "none" || self.enterprisePopup.style.display === "";
      self.enterprisePopup.style.display = shouldShow ? "block" : "none";
      if (!shouldShow) return;

      if (enterpriseItemsCache && enterpriseItemsCache.length > 0) {
        self.renderEnterpriseList(enterpriseItemsCache);
      } else {
        self.enterpriseListContainer.innerHTML = "<div style='color:red; padding:10px;'>Enterprise list not available.</div>";
      }
    });
    document.addEventListener("click", function (e) {
      if (!self.enterprisePopup) return;

      var isClickInsidePopup = self.enterprisePopup.contains(e.target);
      var isClickOnButton = self.logoWrapper.contains(e.target);

      if (!isClickInsidePopup && !isClickOnButton) {
        self.enterprisePopup.style.display = "none";
      }
    });
  },
  renderEnterpriseList: function (items) {
    this.enterpriseListContainer.innerHTML = `
      <div class='-enterprise-popup-main-container grid -top-to-bottom -no-padding'>
        <div class='-enterprise-content-list'>
          <input id="enterprise-search" type="text" class="-enterprise-search Field" placeholder="Search enterprise..."/>
        </div>
        <div id="enterprise-items-container" class="-enterprise-items-container"></div>
      </div>
    `;
    this.enterpriseSearchInput = document.getElementById("enterprise-search");
    this.enterpriseItemsContainer = document.getElementById("enterprise-items-container");
    this.activeIndex = -1;
    this.bindEnterpriseSearch(items);
    this.renderItems(items);
  },
  bindEnterpriseSearch: function (items) {
    var self = this;
    if (!this.enterpriseSearchInput) return;
    this.enterpriseSearchInput.addEventListener("click", function (e) {
      e.stopPropagation();
    });
    this.enterpriseSearchInput.addEventListener("input", function () {
      var query = self.enterpriseSearchInput.value.toLowerCase();
      var filtered = items.filter(item =>
        item.Name.toLowerCase().startsWith(query) 
      );
      self.activeIndex = -1;
      self.renderItems(filtered);
    });
    this.enterpriseSearchInput.addEventListener("keydown", function (e) {
      self.handleEnterpriseKeydown(e);
    });
  },
  renderItems: function (filteredItems) {
    var self = this;
    if (!filteredItems.length) {
      this.enterpriseItemsContainer.innerHTML = "<div>No results found</div>";
      return;
    }
    this.enterpriseItemsContainer.innerHTML = filteredItems.map((item, idx) =>`<div class="enterprise-item -click" data-domain="${item.Domain}" data-idx="${idx}" style="padding:5px;">${item.Name}</div>`).join("");
    this.enterpriseItemsContainer.querySelectorAll(".enterprise-item").forEach(function (div) {
      div.addEventListener("click", function () {
        self.selectEnterprise(div);
      });

      div.addEventListener("mouseenter", function () {
        self.activeIndex = parseInt(div.getAttribute("data-idx"), 10);
        self.updateHighlight();
      });
    });
  },
  updateHighlight: function () {
    var items = this.enterpriseItemsContainer.querySelectorAll(".enterprise-item");
    items.forEach(div => div.classList.remove("highlight"));
    if (this.activeIndex >= 0 && this.activeIndex < items.length) {
      items[this.activeIndex].classList.add("highlight");
      items[this.activeIndex].scrollIntoView({ block: "nearest" });
    }
  },
  handleEnterpriseKeydown: function (e) {
    var items = this.enterpriseItemsContainer.querySelectorAll(".enterprise-item");
    if (!items.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      this.activeIndex = (this.activeIndex + 1) % items.length;
      this.updateHighlight();
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      this.activeIndex = (this.activeIndex - 1 + items.length) % items.length;
      this.updateHighlight();
    }

    if (e.key === "Enter" && this.activeIndex >= 0) {
      e.preventDefault();
      items[this.activeIndex].click();
    }
  },
  selectEnterprise: function (div) {
    var domain = div.getAttribute("data-domain");
    if (!domain) return;

    localStorage.setItem("secondaryDomain", domain);
    localStorage.setItem("selectedEnterpriseName", div.textContent.trim());

    this.enterprisePopup.style.display = "none";

    location.reload();
  },
  reloadCurrentPage: function () {
    var content = document.querySelector(".-main-content-container");
    var currentPage = content?.getAttribute("data-current-page");

    if (!currentPage) return;

    fetch(currentPage)
    .then(res => res.text())
    .then(html => {
      content.innerHTML = html;
      content.querySelectorAll("script").forEach(sc => {
        if (!sc.src) eval(sc.innerText);
      });
    })
    .catch(err =>
      console.error("Page reload failed:", err)
    );
  },
  reloadTilesForEnterprise: function () {
    var placeholder = document.querySelector(".tile-content-placeholder");
    var activeTile = document.querySelector(".-header-menu-item.tile.active");
    if (activeTile && placeholder) {
      enterpriseContent.prototype.loadPage(activeTile,placeholder,document.querySelectorAll(".-header-menu-item.tile"));
    }
  },
  setupMenuHighlighting: function () {
    var menuItems = document.getElementsByClassName("-header-menu-item");
    var lastPage = localStorage.getItem("lastClickedMenuPage") || "dashboard.htm";
    for (var i = 0; i < menuItems.length; i++) {
      var item = menuItems[i];
      var page = item.getAttribute("data-page");
      item.classList.remove("active");
      if (page === lastPage) {
        item.classList.add("active");
      }
      // click event — active + save
      item.addEventListener("click", function () {
        var clickedPage = this.getAttribute("data-page");
        localStorage.setItem("lastClickedMenuPage", clickedPage);
        for (var j = 0; j < menuItems.length; j++) {
          menuItems[j].classList.remove("active");
        }
        this.classList.add("active");
      });
    }
  },
  ensureDefaultEnterprise: function () {
    var domain = localStorage.getItem("secondaryDomain");
    if (!domain && enterpriseItemsCache && enterpriseItemsCache.length > 0) {
      // Pick the first enterprise in the list as default
      localStorage.setItem("secondaryDomain", enterpriseItemsCache[0].Domain);
    }
  },
  loadEnterpriseInfo: function () {
    var nameElement = document.getElementById("activeEnterpriseName");
    var logoElement = document.getElementsByClassName("-enterprise-logo")[0];
    if (!nameElement) return;
    var savedName = localStorage.getItem("selectedEnterpriseName");
    if (savedName) {
      nameElement.textContent = savedName;
    } else {
      var GlobalUserData = JSON.parse(localStorage.getItem("GlobalUserData") || '{}');
      nameElement.textContent = GlobalUserData.EnterpriseName || "LivePlatform";
    }
    if (logoElement) logoElement.style.display = "none";
  },

  loadHTMLContent: function(container, html) {
    container.innerHTML = html;
    Array.from(container.getElementsByTagName('script')).filter(el => !el.src && (!el.type || el.type === 'text/javascript')).map(el => el.innerHTML).forEach(function(code) {
      try {
        this.compileScript([], code)();
      } catch (e) {
      }
    }.bind(this));
    var loadedPage = document.getElementsByClassName('-main-content-container')[0]?.getAttribute('data-page');
    if (loadedPage === 'events.htm') {
      try {
        initBatchEventsPlugin(); 
      } catch (e) {
      }
    }
    if (container.getAttribute('data-current-page') === 'preferences.htm') {
      if (typeof settingContent === 'function') {
        new settingContent();
      } 
    }
  },
  userFunctionality: function () {
    this.content = document.querySelector('.-main-content-container');
    this.tileContainer = document.querySelector('.tile-container');
    //this.userImage = document.querySelector('.-user-image');
    //this.userInitials = document.querySelector('.-user-initials');
    this.userProfileDiv = document.querySelector('.-user-profile-div');
    this.tileContentArea = this.tileContainer.querySelector('.-tile-content-area');
    this.tileCloseBtn = this.tileContainer.querySelector(".-tile-cross-btn");
    this.activeMenuPage = "dashboard.htm";
    this.lastActiveTile = null;
    document.querySelectorAll('.-header-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        var page = item.getAttribute('data-page');
        if (page) {
          this.activeMenuPage = page;
        }
      });
    });
    //this.restoreActiveMenuPage();
    this.userProfileDiv.addEventListener("click", function () {
      window.electronAPI.openTileWindow();
    });

    //if (this.userImage) this.userImage.addEventListener("click", this.toggleTiles.bind(this));
    if (this.userInitials) this.userInitials.addEventListener("click", this.toggleTiles.bind(this));
    // if (this.tileCloseBtn) {
    //   this.tileCloseBtn.addEventListener("click", (e) => {
    //     e.stopPropagation();
    //     this.restoreActiveMenuPage();
    //   });
    // }
    if (this.tileCloseBtn) {
      this.tileCloseBtn.addEventListener("click", (e) => {
        e.stopPropagation();

        if (window.electronAPI?.closeTileWindow) {
          window.electronAPI.closeTileWindow();
        }
      });
    }
    this.tileContainer.addEventListener("click", (e) => {
      var tile = e.target.closest(".tile");
      if (!tile || !tile.dataset.page) return;
      if (this.lastActiveTile === tile) return;
      this.tileContainer.querySelectorAll('.tile').forEach(t => t.classList.remove('active'));
      tile.classList.add('active');
      this.lastActiveTile = tile;
      var page = tile.dataset.page;
      this.loadPageIntoTile(page);
    });
  },
  runInlineScripts: function (container) {
    var scripts = container.querySelectorAll('script');
    scripts.forEach(script => {
      if (!script.src && (!script.type || script.type === "text/javascript")) {
        try {
          var newScript = document.createElement("script");
          newScript.textContent = script.textContent;
          document.body.appendChild(newScript);
          document.body.removeChild(newScript);
        } catch (err) {
          console.error("Script execution error:", err);
        }
      }
    });
  },
  restoreActiveMenuPage: function () {
    this.tileContainer.style.display = "none";
    document.body.classList.remove("no-scroll");
    this.userImage.classList.remove("active");
    this.userInitials.classList.remove("active");
     document.querySelectorAll('.-header-menu-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-page') === this.activeMenuPage) {
            item.classList.add('active');
        }
    });

    fetch(this.activeMenuPage)
    .then(res => res.text())
    .then(html => {
      this.content.innerHTML = html;
      this.runInlineScripts(this.content);
      document.querySelectorAll('.-header-menu-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-page') === this.activeMenuPage) {
          item.classList.add('active');
        }
      });
    })
    .catch(err => {
      this.content.innerHTML = `<p>Error loading ${this.activeMenuPage}</p>`;
    });
  },
  toggleTiles: function () {
    var isVisible = this.tileContainer.style.display === "flex";

    if (isVisible) {
      // Tiles close → restore last active menu
      this.restoreActiveMenuPage();

    } else {
      // Tiles open
      this.content.innerHTML = "";
      this.content.appendChild(this.tileContainer);
      this.tileContainer.style.display = "flex";
      document.body.classList.add("no-scroll");

      // Mark user image / initials as active
      this.userImage.classList.add("active");
      this.userInitials.classList.add("active");

      // Remove all header menu active classes
      document.querySelectorAll('.-header-menu-item').forEach(item => {
        item.classList.remove('active');
      });

      // Tiles UI: highlight first or selected tile
      var allTiles = this.tileContainer.querySelectorAll('.tile');
      if (allTiles.length > 0) {
        allTiles.forEach(t => t.style.opacity = '0.5');
        var selectedTile = this.tileContainer.querySelector('.tile[data-selected="true"]') || allTiles[0];
        selectedTile.style.opacity = '1';

        // Load page into tile
        var page = selectedTile.dataset.page;
        if (page) this.loadPageIntoTile(page);
      }
    }
  },

  loadPageIntoTile: function (page) {
    fetch(page)
    .then(res => res.text())
    .then(html => {
      this.tileContentArea.innerHTML = html;
      this.runInlineScripts(this.tileContentArea);
    })
    .catch(err => {
      this.tileContentArea.innerHTML = `<p>Error loading ${page}</p>`;
    });
  },
  loadAccountDetails: function () {
    var content = document.getElementsByClassName("-main-content-container")[0];
    if (!content) {
      return;
    }
    this.loadHTMLContent(content, mockHtml);
    document.title = "Account";
    content.setAttribute('data-current-page', 'AccountDetails.htm');
  },
  fetchCurrentUserId: function () {
    useFetch("/GetSessionInfo.json")
    .then(function (res) {
      return res.json();
    })
    .then(function (data) {
      currentUserId = UserData.ObjectCode; 
    })
  },
  compileScript: function(params, source, context) {
    params = params || [];
    return new Function(params.join(), source).bind(context);
  },
};
function useFetch(url, method, headers,body = null) {
  url = url.indexOf('.com') > -1 ? url : GlobalDomain + url;
  method = method || "GET"; 
  headers = headers || {};
  return fetch(url, {
    method : method,
    credentials : 'include',
    headers : headers,
    body: body
  });
};
new electronPlugin();

// Listen for reminders sent by Electron main process
document.addEventListener("DOMContentLoaded", () => {
  var toastContainer = document.getElementById('toast-container');
  if (!toastContainer) return;
  if (window.electronAPI.onRenderAlert) {
    window.electronAPI.onRenderAlert((data) => {
      alert(data.message);
    });
  } else {
    console.log("electronAPI not found");
  }
});

// Theme apply function
function applyTheme(theme) {
  document.body.setAttribute("data-theme", theme);
  localStorage.setItem("app-theme", theme);
}
document.addEventListener("DOMContentLoaded", function () {
  try {
    var settings = JSON.parse(localStorage.getItem("Settings") || "{}");
    if (settings.DeveloperMode === true) {
      var attachDevToggle = (devIcon) => {
        devIcon.style.display = "block";
        var devPanel = document.querySelector(".tile-container");
        // Click listener to toggle
        if (!devToolsIcon._listenerAdded) {
          devIcon.addEventListener("click", () => {
            if (window.electronAPI && window.electronAPI.toggleDevTools) {
              window.electronAPI.toggleDevTools();
            }
          });
          devIcon._listenerAdded = true; 
        }
      };
      var devIcon = document.getElementById("devToolsIcon");
      if (devIcon) {
        attachDevToggle(devIcon);
      } else {
        var observer = new MutationObserver(() => {
          var devIcon = document.getElementById("devToolsIcon");
          if (devIcon) {
            attachDevToggle(devIcon);
            observer.disconnect();
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });
      }
    }
  } catch (err) {
    console.error("Developer Mode restore error:", err);
  }
});
//Auto-open Account tile if query param exists
window.addEventListener("load", function () {
  var params = new URLSearchParams(window.location.search);

  if (params.get("HideToolbar") === "Y") {
    window.isTileWindow = true;
    setTimeout(function () {
      var sidebar = document.querySelector(".-left-menu-container");
      var headerDashboard = document.querySelector(".-header-dashboard");
      var content = document.querySelector(".-main-content-container");
      var tileContainer = document.querySelector(".tile-container");
      var footer = document.querySelector(".-footer");
      var tileCrossBtn = document.querySelector(".-tile-cross-btn");

      // Hide unnecessary elements
      if (sidebar) sidebar.style.display = "none";
      if (headerDashboard) headerDashboard.style.display = "none";
      if (footer) footer.style.display = "none";
      if (tileCrossBtn) tileCrossBtn.style.display = "none";

      // Move tile container to main content
      if (content && tileContainer) {
        content.innerHTML = "";
        content.appendChild(tileContainer);
        tileContainer.style.display = "flex";
        tileContainer.style.position = "relative";
        tileContainer.style.width = "100%";
        tileContainer.style.height = "100%";
        tileContainer.classList.add("active");

        var accountTile = document.querySelector('.tile[data-title="Account"]') || document.querySelector('.tile[data-page="AccountDetails.htm"]');
        if (accountTile) {
          tileContainer.querySelectorAll(".tile").forEach(function (t) {
            t.classList.remove("active");
          });
          accountTile.classList.add("active");
          accountTile.click();
        }
      }
    }, 150);
  }
});