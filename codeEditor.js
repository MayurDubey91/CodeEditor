var codeEditor = function () {
  this.versions = {};
  this.projectFiles = [];
  this.init();
};

codeEditor.prototype = {
  topLevelCategory: 944825057,
  topLevelCloudType: 944823551,
  init: async function () {
    var savedUserData = localStorage.getItem("userData");
    if (savedUserData) {
      window.UserData = JSON.parse(savedUserData);
    }
    // FIRST THING
    if (localStorage.getItem("isLoggedIn") === "true") {
      document.body.classList.add("logged-in");
    } else {
      document.body.classList.remove("logged-in");
      document.body.classList.add("no-scroll");
    }
    document.body.classList.add("app-ready");
    //document.getElementById("contextControls").style.display = "block";
      var commonContextBox = document.getElementById("commonContextBox");

    if (commonContextBox) {
      commonContextBox.style.display = "none";
    }
      this.nodeCache = {
        OT: {},
        Category: {},
        CloudType: {}
      };
      this.contextCache = {
        ObjectType: {},
        Category: {},
        CloudType: {}
      };
      this.contextLoading = {};
      this.BaseOT = "IOGLO00001";
      // Restore saved Script URL
      this.scriptDomain = localStorage.getItem("scriptUrl") || "";

      var scriptUrlInput = document.getElementById("scriptUrlInput");
      if (scriptUrlInput) {
        scriptUrlInput.value = this.scriptDomain;
      }

      await this.loadVersions();

      this.allContexts = [];
      this.currentContextId = null;
      this.monacoEditor = null;
      this.lastContextSource = null;
      this.activeLeftPanelTab = "liveActions";

      // IMPORTANT: load saved project FIRST
      await this.loadProjectState();
      this.pendingCloseTabId = null;
      this.initializeSaveModal();
      this.initializePushQueuesPanel();
      await this.loadProjects();
      this.initializeProjectsToggle();
      this.initializeLeftPanelTabs();
      var refreshContextsBtn = document.getElementById("refreshContextsBtn");
      if (refreshContextsBtn) {
        refreshContextsBtn.onclick = async (e) => {
          e.preventDefault();
          e.stopPropagation();

          await this.refreshCommonSection();
        };
      }

      document.getElementById("modeDropdown").addEventListener("change", async (e) => {
        this.nodeCache = {
          OT: {},
          Category: {},
          CloudType: {}
        };

        this.contextCache = {
          ObjectType: {},
          Category: {},
          CloudType: {}
        };
        this.mode = e.target.value;
        var domain = this.getSelectedEnterpriseDoamin();
        await this.rebuildLeftPanel();
      });

      // document.getElementById("searchContexts").addEventListener("input",utils.debounce((e) => {
      //   var text = e.target.value.toLowerCase();
      //   var rows = document.querySelectorAll("#contextsBody tr");

      //   rows.forEach(row => {
      //     row.style.display = row.textContent.toLowerCase().includes(text)? "": "none";
      //   });
      // }, 200));

      document.addEventListener("keydown", async (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
          e.preventDefault();
          var currentTab = this.allContexts.find(t => t.id === this.currentContextId);
          if (!currentTab) return;
          // Context Save
          if (currentTab.contextId) {
            await this.saveContext(currentTab.contextId);
            return;
          }
          // Local File Save
          await this.saveCurrentFile();
        }
      });
      document.getElementById("tabsContainer").addEventListener("dblclick", () => {
        this.createUntitledTab();
      });
      document.getElementById("contextIdentifier").addEventListener("keydown", async (e) => {
        if (e.key !== "Enter") return;
        var contextId = e.target.value.trim();
        if (!contextId) return;
        await this.openContextById(contextId);
      });
      document.addEventListener("keydown", async (e) => {
        if (e.key === "F5") {
          e.preventDefault(); 
          await this.runCustomScriptOnF5();
        }
      });
      document.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "i") {
          e.preventDefault();
          this.toggleAIPanel();
        }
      });
      var pushQueuesTab = document.getElementById("pushQueuesExpand");
      var liveWebsiteTab = document.getElementById("liveWebsite");
      if (pushQueuesTab) {
        pushQueuesTab.addEventListener("click", () => {
          this.openPushQueuesTab();
        });
      }
      if (liveWebsiteTab) {
        liveWebsiteTab.addEventListener("click", () => {
          console.log("Live Website Tab Clicked");
          this.openLiveWebsiteTab();
        });
      }
      this.initializeMonacoEditor();
      // AI Panel Close Button
      var closeBtn = document.getElementById("closeAiPanel");
      if (closeBtn) {
        closeBtn.addEventListener("click", () => {
          this.toggleAIPanel();
        });
      }
      this.initializeAIPanel();
      // render AFTER loadProjectState
      this.renderProjectFiles();
      this.initializeSectionToggle("projectToggle", "projectPanel");
      this.initializeSectionToggle("liveWebsiteToggle", "liveWebsitePanel");
      this.initializeContextMenu();
      this.initializeLoginScreen();
      this.initializeScriptLogin();
      document.addEventListener("keydown", (e) => {
        if (e.key === "F6") {
          e.preventDefault();
          this.toggleExecutionPanel();
        }
      });
      document.body.classList.add("app-ready");
    },
  showMiniLoader: function (element) {
    if (!element) return;

    // Already exists
    if (element.querySelector(".mini-loader")) return;

    // Tree node
    var toggle = element.querySelector(":scope > .toggle");
    if (toggle) {
      toggle.innerHTML = '<span class="mini-loader"></span>';
      return;
    }

    // Tab
    var loader = document.createElement("span");
    loader.className = "mini-loader";
    loader.style.marginLeft = "3px";

    var title = element.querySelector(".tab-title");

    if (title) {
      element.insertBefore(loader, title);
    } else {
      element.appendChild(loader);
    }
  },

  hideMiniLoader: function (element) {
    if (!element) return;
    // Tree node
    var toggle = element.querySelector(":scope > .toggle");
    if (toggle && toggle.querySelector(".mini-loader")) {
      toggle.textContent = "[+] ";
      return;
    }
    // Tab
    var loader = element.querySelector(".mini-loader");
    if (loader) {
      loader.remove();
    }
  },
  setToggleState: function (node, isOpen) {
    var toggle = node.querySelector(":scope > .toggle");
    if (toggle) {
      toggle.innerText = isOpen ? "[-] " : "[+] ";
    }
  },
  initializeMonacoEditor: function () {
    require.config({
      paths: {
        vs: "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs"
      }
    });
    require(["vs/editor/editor.main"], () => {
      this.monacoEditor = monaco.editor.create(
        document.getElementById("monacoEditor"),
        {
          value: "",
          language: "html",
          theme: "vs-dark",
          automaticLayout: true,
          minimap: {
            enabled: false
          }
        }
      );
      // Default tab
      this.createUntitledTab();
    });
  },
initializeLeftPanelTabs: function () {
    var buttons = document.querySelectorAll(".left-panel-tab-button");
    var panels = document.querySelectorAll(".left-panel-tab-panel");

    if (!buttons.length || !panels.length) return;

    this.activeLeftPanelTab = "liveActions";

    var addItemsRightBtn = document.getElementById("addItemsRightBtn");

    if (addItemsRightBtn) {
        addItemsRightBtn.style.display = "none";
    }

    buttons.forEach((button) => {
        button.addEventListener("click", () => {
            var targetPanel = button.getAttribute("data-panel");

            this.activeLeftPanelTab = targetPanel;

            this.resetCommonContextBox();

            if (addItemsRightBtn) {
                addItemsRightBtn.style.display =
                    targetPanel === "pushQueues"
                        ? "flex"
                        : "none";

                if (targetPanel !== "pushQueues") {
                    addItemsRightBtn.onclick = null;
                }
            }

            buttons.forEach((btn) => {
                btn.classList.toggle("active", btn === button);
            });

            panels.forEach((panel) => {
                var panelId = panel.id;

                var isActive =
                    targetPanel === "liveActions"
                        ? panelId === "leftPanelLiveActions"
                        : targetPanel === "projects"
                            ? panelId === "leftPanelProjects"
                            : targetPanel === "liveWebsite"
                                ? panelId === "leftPanelLiveWebsite"
                                : panelId === "leftPanelPushQueues";

                panel.classList.toggle("active", isActive);
            });

            if (targetPanel === "pushQueues") {
                this.openPushQueuesTab();
                return;
            }

            if (targetPanel === "projects") {
                var panel = document.getElementById("projectPanel");

                if (panel) {
                    panel.style.display = "block";
                }
            }

            if (targetPanel === "liveWebsite") {
                var panel = document.getElementById("liveWebsitePanel");

                if (panel) {
                    panel.style.display = "block";
                }
            }

            if (this.monacoEditor) {
                this.monacoEditor.layout();
            }
        });
    });
},
resetCommonContextBox: function () {
    var box = document.getElementById("commonContextBox");
    var label = document.getElementById("commonSourceLabel");
    var search = document.getElementById("commonSearchInput");
    var headerActions = document.getElementById("commonHeaderActions");
    var searchActions = document.getElementById("commonSearchActions");
    var container = document.getElementById("commonTableContainer");
    var addItemsRightBtn = document.getElementById("addItemsRightBtn");

    if (!box) return;

    box.style.display = "none";

    if (label) {
        label.textContent = "";
    }

    if (search) {
        search.value = "";
        search.placeholder = "Search";
        search.oninput = null;
    }

    if (headerActions) {
        headerActions.innerHTML = "";
    }

    if (searchActions) {
        searchActions.innerHTML = "";
    }

    if (container) {
        container.innerHTML = "";
    }

    if (addItemsRightBtn) {
        addItemsRightBtn.style.display = "none";
        addItemsRightBtn.onclick = null;
    }
},

showCommonContextBox: function (options) {
    options = options || {};

    var box = document.getElementById("commonContextBox");
    var label = document.getElementById("commonSourceLabel");
    var search = document.getElementById("commonSearchInput");
    var headerActions = document.getElementById("commonHeaderActions");
    var searchActions = document.getElementById("commonSearchActions");
    var container = document.getElementById("commonTableContainer");

    if (!box || !label || !search || !container) {
        return null;
    }

    box.style.display = "block";

    // Do not overwrite existing source label
    if (options.label) {
        label.textContent = options.label;
    }
    else if (!label.textContent) {
        label.textContent = "Available Contexts";
    }

    search.value = "";
    search.placeholder = options.placeholder || "Search";

    search.oninput = null;

    if (headerActions) {
        headerActions.innerHTML = "";
    }

    if (searchActions) {
        searchActions.innerHTML = "";
    }

    container.innerHTML = "";

    return {
        box: box,
        label: label,
        search: search,
        headerActions: headerActions,
        searchActions: searchActions,
        container: container
    };
},
  initializeLoginScreen: function () {
    if (localStorage.getItem("isLoggedIn") === "true") {
      document.body.classList.add("logged-in");
      document.body.classList.remove("no-scroll");
      return;
    }
    var loginSubmit = document.getElementById("loginSubmit");
    var loginEmail = document.getElementById("loginEmail");
    var loginPassword = document.getElementById("loginPassword");

    if (!loginSubmit || !loginEmail || !loginPassword) {
      return;
    }

    document.body.classList.add("no-scroll");

    loginSubmit.addEventListener("click", () => this.handleLogin());
    loginPassword.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this.handleLogin();
      }
    });
    loginEmail.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this.handleLogin();
      }
    });
  },
  handleLogin: async function () {
    var email = document.getElementById("loginEmail").value.trim();
    var password = document.getElementById("loginPassword").value;
    var error = document.getElementById("loginError");
    var loginSubmit = document.getElementById("loginSubmit");

    if (!email || !password) {
      error.textContent = "Enter both email and password.";
      return;
    }

    error.textContent = "";
    loginSubmit.disabled = true;
    loginSubmit.textContent = "Signing in...";

    async function loginToServer(domain) {
      var response = await fetch(domain + "/LoginADUser.do", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          UserName: email,
          Password: password
        })
      });
      var data = await response.json();
      console.log("Login:", domain, data);

      if (!data || !data.Result || data.Result === false) {
        throw new Error("Login failed : " + domain);
      }
      return data;
    }

    try {
      // Main Login (Current Environment)
      //var data = await loginToServer(GlobalDomain);
      var loginDomain = this.getLoginDomain();
      var data = await loginToServer(loginDomain);

      this.userData = data.Result;
      this.userDRI = data.Result["Direct Resource Identifier"] || "";
      window.UserData = data.Result;

      // Save login
      localStorage.setItem("isLoggedIn", "true");
      localStorage.setItem("userData", JSON.stringify(data.Result));
      localStorage.setItem("loginUserName", email);
      localStorage.setItem("loginPassword", password);
      if (loginDomain.toLowerCase().indexOf("prerelease") === -1) {
        try {
          await loginToServer("http://prerelease.liveplatform.com");
        }
        catch (e) {
          console.warn("Prerelease login skipped", e);
        }
      }
      if (loginDomain.toLowerCase().indexOf("dev") === -1) {
        try {
          await loginToServer("http://dev.liveplatform.com");
        }
        catch (e) {
          console.warn("Dev login skipped", e);
        }
      }

      document.body.classList.add("logged-in");
      document.body.classList.remove("no-scroll");
    }
    catch (err) {
      console.error(err);
      error.textContent = "Invalid email or password.";
    }
    finally {
      loginSubmit.disabled = false;
      loginSubmit.textContent = "Sign In";
    }
  },
  createUntitledTab: function () {
    var id = "tab_" + Date.now();
    var model = monaco.editor.createModel("", "html");

    var tab = {
      id: id,
      name: "Untitled",
      model: model,
      aiMessages: [], 
      lastAIResult: null,
    };

    this.allContexts.push(tab);
    this.currentContextId = id;

    this.renderTabs();

    this.monacoEditor.setModel(model);
    this.monacoEditor.focus();
    this.renderAiMessages(tab);
  },

  renderTabs: function () {
    var container = document.getElementById("tabsContainer");
    container.innerHTML = "";
    this.allContexts.forEach(tab => {
      var div = document.createElement("div");
      div.className = "tab " + (tab.id === this.currentContextId ? "active" : "");

      var title = document.createElement("span");
      title.className = "tab-title";
      title.innerText = tab.name;
      title.onclick = () => this.switchContext(tab.id);

      var closeBtn = document.createElement("span");
      closeBtn.className = "tab-close";
      closeBtn.innerHTML = "X";
      closeBtn.onclick = (e) => {
          e.stopPropagation();
          this.confirmCloseTab(tab.id);
      };

      div.appendChild(title);
      div.appendChild(closeBtn);

      container.appendChild(div);
    });

    var aiBtn = document.createElement("button");
    aiBtn.id = "aiTabButton";
    aiBtn.className = "ai-tab";
    aiBtn.textContent = "AI";

    aiBtn.onclick = () => {
      this.toggleAIPanel();
    };
    container.appendChild(aiBtn);
  },
  switchContext: function (id) {
    this.activeTabType = "editor";
    var container = document.getElementById("pushQueuesContainer");
    var liveWebsiteContainer = document.getElementById("liveWebsiteContainer");
    var editor = document.getElementById("monacoEditor");
    var pushQueuesTab = document.getElementById("pushQueuesTab");
    var liveWebsiteTab = document.getElementById("liveWebsite");

    if (container) {
        container.style.display = "none";
    }

    if (liveWebsiteContainer) {
        liveWebsiteContainer.style.display = "none";
    }

    if (editor) {
        editor.style.display = "block";
    }

    // Remove active class from pinned tabs
    if (pushQueuesTab) {
        pushQueuesTab.classList.remove("active");
    }
    if (liveWebsiteTab) {
        liveWebsiteTab.classList.remove("active");
    }

    var tab = this.allContexts.find(t => t.id === id);
    if (!tab) return;

    this.currentContextId = id;

    this.monacoEditor.setModel(tab.model);

    this.renderTabs();
    this.renderProjectFiles();
    this.renderAiMessages(tab);

    this.monacoEditor.layout();
    this.monacoEditor.focus();

    // AI button enable
    var aiBtn = document.getElementById("aiTabButton");
    if (aiBtn) {
        aiBtn.disabled = false;
    }
},
  loadVersions: async function () {
    try {
      var response = await fetch("http://prerelease.liveplatform.com/system/versions");
      if (!response.ok) {
        throw new Error("HTTP Error: " + response.status);
      }
      var data = await response.json();
      if (!data || !Array.isArray(data.Results)) {
        console.error("Invalid response:", data);
        return;
      }
      var modeDropdown = document.getElementById("modeDropdown");
      if (!modeDropdown) {
        console.error("modeDropdown not found");
        return;
      }
      modeDropdown.innerHTML = "";
      this.versions = {};

      data.Results.filter(item =>item.Release !== "Debug" &&item.Release !== "Test").forEach(item => {
        this.versions[item.Release] = {
          version: item.Version,
          release: item.Release,
          domain: item.Domain || item.Server || item.HostName || ""
        };

        var option = document.createElement("option");
        option.value = item.Release;
        option.textContent = item.Release + " - " + item.Version;

        modeDropdown.appendChild(option);
      });

      // Default mode selection
      if (this.versions["Dev"]) {
        this.mode = "Dev";
      } else {
        var releases = Object.keys(this.versions);
        if (releases.length > 0) {
          this.mode = releases[0];
        }
      }

      if (this.mode) {
        modeDropdown.value = this.mode;
        this.selectedMode = this.versions[this.mode];
      }

      if (typeof this.loadEnterprises === "function") {
        await this.loadEnterprises();
      }

    } catch (err) {
      console.error("Failed to load versions:", err);
    }
  },
  loadEnterprises: async function () {
    try {
      var response = await fetch("http://prerelease.liveplatform.com/GetEnterprises.json?SortBy=Formatted Name");
      var data = await response.json();
      this.enterprises = data.Results || [];
      var enterpriseDropdown = document.getElementById("enterpriseDropdown");

      enterpriseDropdown.innerHTML = "";

      data.Results.forEach(item => {
        var option = document.createElement("option");
        option.value = item.Identifier || item.Name;
        option.textContent = item["Formatted Name"] || item.FormattedName ||item.Name;
        enterpriseDropdown.appendChild(option);
      });

      // Default Enterprise = LivePlatform
      var defaultEnterprise = data.Results.find(item =>
        (item["Formatted Name"] || item.FormattedName || item.Name).toLowerCase() === "liveplatform");

      if (!defaultEnterprise && data.Results.length > 0) {
        defaultEnterprise = data.Results[0];
      }
      this.selectedEnterprise = defaultEnterprise
      enterpriseDropdown.value = this.selectedEnterprise.Name;

      enterpriseDropdown.addEventListener("change",async (e) => {
        // CLEAR ALL CACHE
        this.nodeCache = {
          OT: {},
          Category: {},
          CloudType: {}
        };

        this.contextCache = {
          ObjectType: {},
          Category: {},
          CloudType: {}
        };
        this.selectedEnterprise = this.enterprises.find(item =>
          (item["Formatted Name"] || item.FormattedName || item.Name).toLowerCase() === e.target.value.toLowerCase());
        var domain = this.getSelectedEnterpriseDoamin();

        document.querySelector(".-context-input-box").style.display = "flex";

        var wrapper = document.getElementById("contextsWrapper");
        if (wrapper) wrapper.style.display = "flex";
        this.toggleContexts(true);

        var tbody = document.getElementById("contextsBody");
        if (tbody) tbody.innerHTML = "";

        document.getElementById("Cat").innerHTML = "";

        await this.getAndLoadTopLevelCategoryAndCloudType();
      });
      this.getAndLoadOTs();
      this.getAndLoadTopLevelCategoryAndCloudType();
      this.initializeLiveWebsiteTab();
    } catch (error) {
      console.error("Failed to load enterprises:",error);
    }
  },
  getAndLoadOTs: async function () {
    try {
      var node = this.BaseOT;
      var version = this.versions[this.mode].version;
      var domain = this.getCurrentDomain();
      var url = "http://" + domain + "/Node:" + node + ".GetObjectsAsJSON?aCountSubNodes=Y&aUse=Owned&aSubnodeCount=Y" +"&aSort_List=JSON%3A%5B%7BOrderType%3AString%2COrderDirection%3AAscending%2CDataType%3ADisplayName%7D%5D" +
        "&aDataTypeList=DisplayName,HierarchyPosition" +"&fVersion=" + version + "&fLivePlatformVersion=" + version;

      var response = await fetch(url);
      var data = await response.json();
      var otDiv = document.getElementById("OT");
      otDiv.innerHTML = "";

      data.forEach(item => {
        var div = document.createElement("div");
        div.dataset.id = item.Id;                  
        div.dataset.hpos = item.HierarchyPosition;
        div.innerHTML = `
          <span class="toggle">[+] </span>
          <span class="label">${item.DisplayName}</span>
        `;
        div.style.cursor = "pointer";
        div.dataset.open = "false";
        // Expand tree
        div.querySelector(".toggle").addEventListener("click", async (e) => {
          e.stopPropagation();
          this.setSelectedNode(div);
          await this.loadChildNodes(div, item.HierarchyPosition);
        });
        // div.querySelector(".label").addEventListener("click", async (e) => {
        //   e.stopPropagation();
        //   console.log("Object Clicked ID:", item.Id);
        //   await this.loadContexts(item.Id);
        // });
        div.querySelector(".label").setAttribute("data-context-id", item.Id);

        div.querySelector(".label").addEventListener("click", async (e) => {
          e.stopPropagation();
          this.setSelectedNode(div);
          this.setContextSourceLabel("ObjectType",item.DisplayName || item.Name);
          this.lastContextSource = {
            action: "ObjectType", id: item.Id
          };
          await this.loadContexts(item.Id, "ObjectType");
        });
        otDiv.appendChild(div);
      });
    } catch (err) {
      console.error("OT error:", err);
    }
  },
  getAndLoadTopLevelCategoryAndCloudType: async function () {
    try {
      var enterpriseId = this.selectedEnterprise.Id;
      var domain = this.getSelectedEnterpriseDoamin();
      var url = "http://" + domain + "/GetTopLevelCategories.json?EnterpriseId=" + enterpriseId;
      var response = await fetch(url);
      var data = await response.json();
      var catDiv = document.getElementById("Cat");

      if (!catDiv) {
        console.error("Cat div not found");
        return;
      }
      catDiv.innerHTML = "";

      (data.Results || data).forEach(item => {
        var name = item["Formatted Name"];
        var div = document.createElement("div");
        div.style.cursor = "pointer";

        div.innerHTML = `
          <span class="toggle">[+] </span>
          <span class="label">${name}</span>
        `;

        div.dataset.type = name;
        div.dataset.hpos = item.HierarchyPosition;
        
        // Expand / Collapse
        div.querySelector(".toggle").addEventListener("click", async (e) => {
          e.stopPropagation();
          this.setSelectedNode(div);

          if (name === "Categories") {
            this.setContextSourceLabel(
              "Category",
              "Categories"
            );

            this.lastContextSource = {
              action: "Category",
              id: this.topLevelCategory
            };

            await this.loadCategoryContexts(
              this.topLevelCategory
            );

            return;
          }

          if (name === "Cloud Types") {
            this.setContextSourceLabel(
              "CloudType",
              "Cloud Types"
            );

            this.lastContextSource = {
              action: "CloudType",
              id: this.topLevelCloudType
            };

            await this.loadCloudTypeContexts(
              this.topLevelCloudType
            );

            return;
          }
        });
        // Context Load
        div.querySelector(".label").addEventListener("click", async (e) => {
          e.stopPropagation();
          this.setSelectedNode(div);
          if (name === "Categories") {
            this.setContextSourceLabel("Category","Categories");
            this.lastContextSource = {
              action: "Category",
              id: this.topLevelCategory
            };
            await this.loadCategoryContexts(this.topLevelCategory);
            return;
          }

          if (name === "Cloud Types") {
            this.setContextSourceLabel("CloudType","Cloud Types");
            await this.loadCloudTypeContexts(this.topLevelCloudType);
            return;
          }
          var objectId = item.Id || item.HierarchyPosition;
          await this.loadContexts(objectId);
        });
        catDiv.appendChild(div);
      });
    } catch (err) {
      console.error("TopLevel Error:", err);
    }
  },
  loadCategories: async function (item, parentDiv) {
    try {
      if (parentDiv.dataset.open === "true") {
        parentDiv.querySelector(".children").remove();
        parentDiv.dataset.open = "false";

        this.setToggleState(parentDiv, false);
        return;
      }
      // CACHE CHECK
      if (this.nodeCache.Category[item.HierarchyPosition]) {
        this.renderTreeFromCache(parentDiv,this.nodeCache.Category[item.HierarchyPosition],"Category");
        return;
      }

      // Show loader
      this.showMiniLoader(parentDiv);

      var version = this.versions[this.mode].version;
      var domain = this.getCurrentDomain();

      var url ="http://" + domain +"/Node:" + item.HierarchyPosition +".GetObjectsAsJSON" + "?aUse=Relationship&aCategory=Item&aCountSubNodes=Y&aSubnodeCount=Y" +"&aSort_List=JSON%3A%5B%7BOrderType%3AString%2COrderDirection%3AAscending%2CDataType%3AFormatted%20Name%7D%5D" +
        "&aDataTypeList=Formatted Name,HierarchyPosition" +"&fVersion=" + version +"&fLivePlatformVersion=" + version;

      var response = await fetch(url);
      var data = await response.json();

      var list = data.Results || data || [];
      this.nodeCache.Category[item.HierarchyPosition] = list;

      var container = document.createElement("div");
      container.className = "children";
      container.style.marginLeft = "20px";
      list.forEach(child => {
        //NO toggle icon here anymore
        var div = document.createElement("div");
        div.innerHTML = `
          <span class="toggle">[+] </span>
          <span class="label">${child["Formatted Name"]}</span>
        `;
        div.dataset.open = "false";
        // div.addEventListener("click", async (e) => {
        //   e.stopPropagation();
        //   await this.loadChildNodes(div, child.HierarchyPosition);
        // });
        div.querySelector(".toggle").addEventListener("click", async (e) => {
          e.stopPropagation();
          await this.loadChildNodes(div, child.HierarchyPosition);
        });
        // div.querySelector(".label").addEventListener("click", async (e) => {
        //   e.stopPropagation();
        //   this.setSelectedNode(div);
        //   var categoryName =item.DisplayName ||item["Formatted Name"] ||item.Name ||div.querySelector(".label").textContent.trim();
        //   this.setContextSourceLabel("Category", categoryName);
        //   await this.loadCategoryContexts(item.Id);
        // });
        div.querySelector(".label").addEventListener("click", async (e) => {
          e.stopPropagation();

          this.setSelectedNode(div);

          this.setContextSourceLabel(
            "Category",
            child["Formatted Name"]
          );

          this.lastContextSource = {
            action: "Category",
            id: child.Id || child.HierarchyPosition
          };

          await this.loadCategoryContexts(
            child.Id || child.HierarchyPosition
          );
        });
        container.appendChild(div);
      });
      parentDiv.appendChild(container);
      parentDiv.dataset.open = "true";
      this.setToggleState(parentDiv, true);
    } catch (err) {
      console.error(err);
      this.setToggleState(parentDiv, false);
    }
  },
  loadCloudTypes: async function (item, parentDiv) {
    try {
      if (parentDiv.dataset.open === "true") {
        parentDiv.querySelector(".children")?.remove();
        parentDiv.dataset.open = "false";

        this.setToggleState(parentDiv, false);
        return;
      }
      if (this.nodeCache.CloudType[item.HierarchyPosition]) {
        this.renderTreeFromCache(parentDiv,this.nodeCache.CloudType[item.HierarchyPosition],"CloudType");
        return;
      }

      this.showMiniLoader(parentDiv);

      var version = this.versions[this.mode].version;
      var domain = this.getCurrentDomain();

      var url = "http://" + domain + "/Node:" + item.HierarchyPosition + ".GetObjectsAsJSON" + "?aUse=Relationship&aCategory=Item&aCountSubNodes=Y&aSubnodeCount=Y" +
        "&aSort_List=JSON%3A%5B%7BOrderType%3AString%2COrderDirection%3AAscending%2CDataType%3AFormatted%20Name%7D%5D" +
        "&aDataTypeList=Formatted%20Name,HierarchyPosition,SubNodeCount" +
        "&fVersion=" + version +
        "&fLivePlatformVersion=" + version;

      var response = await fetch(url);
      var data = await response.json();
      var list = data.Results || data || [];

      // Remove duplicates
      var seen = new Set();
      var filtered = list.filter(child => {
        var name = child["Formatted Name"];
        if (!name) return false;
        if (seen.has(name)) return false;
        seen.add(name);
        return true;
      });
      // IMPORTANT: SAVE CACHE (FIX)
      this.nodeCache.CloudType[item.HierarchyPosition] = filtered;

      var container = document.createElement("div");
      container.className = "children";
      container.style.marginLeft = "20px";

      filtered.forEach(child => {
        var div = document.createElement("div");
        div.innerHTML = `
          <span class="toggle">[+] </span>
          <span class="label">${child["Formatted Name"]}</span>
        `;
        div.dataset.open = "false";
        // div.addEventListener("click", async (e) => {
        //   e.stopPropagation();
        //   await this.loadChildNodes(div, child.HierarchyPosition);
        // });
        div.querySelector(".toggle").addEventListener("click", async (e) => {
          e.stopPropagation();
          await this.loadChildNodes(div, child.HierarchyPosition);
        });

        div.querySelector(".label").addEventListener("click", async (e) => {
          e.stopPropagation();
          this.setSelectedNode(div);
          this.setContextSourceLabel("CloudType",child["Formatted Name"] ||child.DisplayName ||child.Name);
          this.lastContextSource = {
            action: "CloudType",
            id: child.Id || child.HierarchyPosition
          };
          await this.loadCloudTypeContexts(child.Id || child.HierarchyPosition);
        });
        container.appendChild(div);
      });
      parentDiv.appendChild(container);
      parentDiv.dataset.open = "true";
      this.setToggleState(parentDiv, true);

    } catch (err) {
      console.error("Cloud Types error:", err);
      this.setToggleState(parentDiv, false);
    }
  },
  renderNodes: function (list, parent) {
    var tree = document.getElementById("hierarchyTree");
    list.forEach(item => {
      var div = document.createElement("div");
      div.style.marginLeft = "20px";
      //safer UI structure
      div.innerHTML = `
        <span class="toggle">[+] </span>
        <span class="label">${item["Formatted Name"] || item.DisplayName}</span>
      `;
      //IMPORTANT
      div.dataset.hpos = item.HierarchyPosition;
      div.addEventListener("click", async (e) => {
        e.stopPropagation();
        var hpos = e.currentTarget.dataset.hpos;
        if (!hpos) {
          console.error("HierarchyPosition missing", item);
          return;
        }
        await this.loadChildNodes(div, hpos);
      });
      tree.appendChild(div);
    });
  },
  loadChildNodes: async function (parentDiv, hpos) {
    try {
      // Close node
      if (parentDiv.dataset.open === "true") {
        parentDiv.querySelector(".children")?.remove();
        parentDiv.dataset.open = "false";

        this.setToggleState(parentDiv, false);
        return;
      }
      if (this.nodeCache.OT[hpos]) {
        this.renderChildNodesFromCache(parentDiv, this.nodeCache.OT[hpos]);
        return;
      }

      // Show mini loader
      this.showMiniLoader(parentDiv);

      var version = this.versions[this.mode].version;
      var domain = this.getCurrentDomain();

      var url = "http://" + domain +"/Node:" + hpos +".GetObjectsAsJSON" +"?aCountSubNodes=Y" + "&aUse=Owned" +"&aSubnodeCount=Y" +"&aSort_List=JSON%3A%5B%7BOrderType%3AString%2COrderDirection%3AAscending%2CDataType%3ADisplayName%7D%5D" +
        "&aDataTypeList=DisplayName,HierarchyPosition,SubNodeCount" +"&fVersion=" + version +"&fLivePlatformVersion=" + version;

      var response = await fetch(url);
      var data = await response.json();

      var list = data.Results || data || [];
      this.nodeCache.OT[hpos] = list;

      if (!list.length) {
        parentDiv.dataset.open = "true";
        this.setToggleState(parentDiv, true);
        return;
      }

      var container = document.createElement("div");
      container.className = "children";
      container.style.marginLeft = "20px";

      list.forEach(child => {
        var childDiv = document.createElement("div");
        childDiv.innerHTML = `
          <span class="toggle">[+] </span>
          <span class="label">
            ${child.DisplayName || child["Formatted Name"] || "Unnamed"}
          </span>
        `;
        
        childDiv.dataset.open = "false";
        childDiv.dataset.hpos = child.HierarchyPosition;
        childDiv.dataset.id = child.Id;

        // Expand child node
        childDiv.querySelector(".toggle").addEventListener("click", async (e) => {
          e.stopPropagation();
          this.setSelectedNode(childDiv);
          await this.loadChildNodes(childDiv, child.HierarchyPosition);
        });

        // Open context
        childDiv.querySelector(".label").addEventListener("click", async (e) => {
          e.stopPropagation();
          this.setSelectedNode(childDiv);
          this.setContextSourceLabel("ObjectType",child.DisplayName || child["Formatted Name"]);
          this.lastContextSource = {
            action: "ObjectType",
            id: child.Id
          };
          await this.loadContexts(child.Id, "ObjectType");
        });
        container.appendChild(childDiv);
      });

      parentDiv.appendChild(container);
      parentDiv.dataset.open = "true";
      // Change loader to [-]
      this.setToggleState(parentDiv, true);

    } catch (error) {
      console.error("Child load error:", error);
      // Restore [+] on error
      this.setToggleState(parentDiv, false);
    }
  },
  getCurrentDomain: function () {
    var domain = "";
    switch ((this.mode || "").toLowerCase()) {
      case "dev":
        domain = "lsv1.dev.liveplatform.com";
        break;
      case "qa":
        domain = "lsv1.qa.liveplatform.com";
        break;
      case "prerelease":
        domain =  "lsv1.prerelease.liveplatform.com";
        break;
      case "live":
        domain = "lsv1.liveplatform.com";
        break;

      default:
        domain = "lsv1.dev.liveplatform.com";
        break;
    }
    return domain;
  },
  getLoginDomain: function () {
    return "http://" + this.getCurrentDomain().replace(/^lsv1\./, "");
  },
  loadContexts: async function (objectId, type = "ObjectType") {
    this.toggleContexts(true);
    var cacheKey;
    try {
      type = (type || "").trim();
      cacheKey = (this.selectedEnterprise?.Id || "default") + "_" + this.mode + "_" + type + "_" + objectId;
      if (this.contextLoading[cacheKey]) {
        return;
      }
      this.contextLoading[cacheKey] = true;
      utils.showContextLoader();
      if (!this.contextCache[type]) {
        this.contextCache[type] = {};
      }
      if (this.contextCache[type][cacheKey]) {
        this.renderContextsFromCache(this.contextCache[type][cacheKey]);
        return;
      }
      utils.showContextLoader();
      document.querySelector(".-context-input-box").style.display = "flex";
      var wrapper = document.getElementById("contextsWrapper");
      if (wrapper) {
        wrapper.style.display = "block";
      }
      this.showContextsLoading();
      var domain = this.getSelectedEnterpriseDoamin();
      var url = "http://" + domain + "/GetContexts.json?Type=" + type +
        "&Fields=Last%20Edited%20On||Last%20Edited%20By" +
        "&ResultCount=3000" +
        "&ObjectType=" + objectId;
      var response = await fetch(url);
      var data = await response.json();
      var list = data.Results || [];

      console.log("Contexts:", list);

      this.contextCache[type][objectId] = list;
      this.contextCache[type][cacheKey] = list;

      this.renderContextsFromCache(list);
    }
    catch (err) {
      console.error("Context error:", err);
      this.showContextsError();
    }
    finally {
      utils.hideContextLoader();

      if (cacheKey) {
        delete this.contextLoading[cacheKey];
        utils.hideContextLoader();
      }
    }
  },
  getSelectedEnterpriseDoamin: function () {  
    var enterprise = this.selectedEnterprise;
    var mode = (this.mode || "").toLowerCase();
    if (!enterprise || !enterprise.Versions) {
      console.warn("Enterprise or Versions missing");
      return null;
    }
    // find matching version object
    var match = enterprise.Versions.find(v =>
      (v.Release || "").toLowerCase() === mode);
    if (match?.Domain) {
      return match.Domain;
    }

    return null;
  },
  resetLeftPanel: function () {
    var _oT = document.getElementById("OT");
    var _cat = document.getElementById("Cat");
    _oT.innerHTML = "";
   _cat.innerHTML = "";
  },
  rebuildLeftPanel: async function () {
    try {
      document.querySelector(".-context-input-box").style.display = "none";
      // Left panel reset
      document.getElementById("OT").innerHTML = "";
      document.getElementById("Cat").innerHTML = "";

      // Right panel reset (IMPORTANT)
      var wrapper = document.getElementById("contextsWrapper");
      if (wrapper) {
        wrapper.style.display = "flex";
      }

      var tbody = document.getElementById("contextsBody");
      if (tbody) {
        tbody.innerHTML = "";
      }

      // Optional: selected object clear
      this.selectedObject = null;

      // Rebuild using new mode/domain
      await this.getAndLoadOTs();
      await this.getAndLoadTopLevelCategoryAndCloudType();

    } catch (err) {
      console.error("Rebuild error:", err);
    }
  },
  // searchContexts: function (text) {
  //   text = text.toLowerCase();
  //   var filtered = this.allContexts.filter(ctx => {
  //     return JSON.stringify(ctx).toLowerCase().includes(text);
  //   });
  //   this.renderContexts(filtered);
  // },
  loadCategoryContexts: async function (objectId) {
    console.log("loadCategoryContexts called with:", objectId);

    this.toggleContexts(true);

    var type = "Category";
    var cacheKey;

    try {
      cacheKey =
        (this.selectedEnterprise?.Id || "default") +
        "_" +
        this.mode +
        "_" +
        type +
        "_" +
        objectId;

      if (this.contextLoading[cacheKey]) {
        return;
      }

      this.contextLoading[cacheKey] = true;

      if (!this.contextCache[type]) {
        this.contextCache[type] = {};
      }

      if (this.contextCache[type][cacheKey]) {
        this.renderContextsFromCache(
          this.contextCache[type][cacheKey]
        );

        return;
      }

      utils.showContextLoader();
      var contextInputBox = document.querySelector(".-context-input-box");

      if (contextInputBox) {
        contextInputBox.style.display = "flex";
      }
      var wrapper = document.getElementById("contextsWrapper");

      if (wrapper) {
        wrapper.style.display = "flex";
      }

      this.showContextsLoading();

      var domain = this.getSelectedEnterpriseDoamin();

      var url =
        "http://" +
        domain +
        "/GetContexts.json?Type=OnCategory" +
        "&Fields=Last%20Edited%20On||Last%20Edited%20By" +
        "&ResultCount=3000" +
        "&ObjectType=" +
        objectId;

      console.log("Category Context URL:", url);

      var response = await fetch(url);
      var data = await response.json();
      var list = data.Results || [];

      console.log("Category Contexts:", list);

      this.contextCache[type][objectId] = list;
      this.contextCache[type][cacheKey] = list;

      this.renderContextsFromCache(list);
    }
    catch (err) {
      console.error("Category context error:", err);
      this.showContextsError();
    }
    finally {
      utils.hideContextLoader();

      if (cacheKey) {
        delete this.contextLoading[cacheKey];
      }
    }
  },
  // loadCloudTypeContexts: async function (objectId) {
  //   await this.loadCategoryContexts(objectId);
  // },
  loadCloudTypeContexts: async function (objectId) {
    this.toggleContexts(true);
    try {
      // // CACHE HIT
      // if (this.contextCache.CloudType && this.contextCache.CloudType[objectId]) {
      //   this.renderContextsFromCache(this.contextCache.CloudType[objectId]);
      //   return;
      // }
      var cacheKey = (this.selectedEnterprise?.Id || "default") +"_" +this.mode +"_" +objectId;

      if (this.contextCache.CloudType && this.contextCache.CloudType[cacheKey]) {
        this.renderContextsFromCache(this.contextCache.CloudType[cacheKey]);
        return;
      }
      utils.showContextLoader();

      var wrapper = document.getElementById("contextsWrapper");
      var tbody = document.getElementById("contextsBody");

      // wrapper.style.display = "block";
      // tbody.innerHTML = "<tr><td colspan='3'>Loading...</td></tr>";
      this.showContextsLoading();

      var domain = this.getSelectedEnterpriseDoamin();
      var url ="http://" + domain + "/GetContexts.json?Type=OnCategory" +"&Fields=Last%20Edited%20On||Last%20Edited%20By" +"&ResultCount=3000" +"&ObjectType=" + objectId;
      var response = await fetch(url);
      var data = await response.json();
      var list = data.Results || [];
      // SAVE CACHE
      //this.contextCache.CloudType[objectId] = list;
      this.contextCache.CloudType[cacheKey] = list;
      // SINGLE RENDER FUNCTION
      this.renderContextsFromCache(list);
    } catch (err) {
      console.error("Cloud Type Context Error:", err);
      document.getElementById("contextsBody").innerHTML ="<tr><td colspan='3'>Failed</td></tr>";

    } finally {
      utils.hideContextLoader();
    }
  },
  saveCurrentFile: async function () {
    if (!this.monacoEditor)return false;
    try {
      var currentTab = this.allContexts.find(x => x.id === this.currentContextId);
      console.log("Current Tab:", currentTab);
      console.log("Current filePath:", currentTab.filePath);
      if (!currentTab)
      return false;
      var content = this.monacoEditor.getValue();
      var result = await window.electronAPI.saveFile({
          filePath: currentTab.filePath,
          defaultName: currentTab.savedFileName || currentTab.name || "untitled.js",
          content: content
      });
      //if (result.canceled)return false;
      if (result.canceled) {
        return false;
      }
      if (!result.success)throw new Error(result.error);

      currentTab.filePath = result.filePath;
      currentTab.savedFileName = result.fileName;
      currentTab.name = result.fileName;

      var existing = this.projectFiles.find(x => x.contextId === currentTab.id);
      if (!existing) {
        this.projectFiles.push({
          name: result.fileName,
          filePath: result.filePath,
          contextId: currentTab.id,
          content: content
        });
      } else {
        existing.name = result.fileName;
        existing.content = content;
        existing.filePath = result.filePath;
      }
      this.saveProjectState();
      this.renderTabs();
      this.renderProjectFiles();
      utils.showSnackbar("File saved successfully.");
      return true;
    }
    catch (err) {
      console.error(err);
      utils.showSnackbar("Failed to save file.","error");
      return false;
    }
  },
  closeTab: function (id) {
    var index = this.allContexts.findIndex(t => t.id === id);
    if (index === -1) return;
    var tab = this.allContexts[index];
    if (tab.model) {
      tab.model.dispose();
    }

    this.allContexts.splice(index, 1);
    if (this.currentContextId === id) {
      var newTab = this.allContexts[index] || this.allContexts[index - 1];
      if (newTab) {
        this.currentContextId = newTab.id;
        this.monacoEditor.setModel(newTab.model);
      } else {
        this.currentContextId = null;
        this.monacoEditor.setValue("");
      }
    }
    this.renderTabs();
  },
  renderProjectFiles: function () {
    var self = this;

    new drawTable({
        container: document.getElementById("projectFilesTableContainer"),
        data:
          this.projectFiles,
        fields: [
          {
            label: "Name",

            render: function (file) {
              return "📄 " + file.name;
            }
          },
          {
            label: "Last Modified",
            field: "lastModified"
          },
          {
            label: "Last Edited By",
            field: "lastEditedBy"
          }
        ],

        emptyText:
          "Your project is currently empty",
        onRowClick: function (file) {
          self.openProjectFile(file);
        }
    });
  },
  saveProjectState: function () {
    this.projectFiles.forEach(file => {
      var tab = this.allContexts.find(t => t.id === file.contextId);
      if (tab && tab.model) {
        file.content = tab.model.getValue();
      }
    });
    localStorage.setItem("codeEditorProjectFiles",JSON.stringify(this.projectFiles));
  },
  loadProjectState: async function () {
    try {
      this.projectFiles = JSON.parse(localStorage.getItem("codeEditorProjectFiles")) || [];
      var validFiles = [];
      for (const file of this.projectFiles) {
        if (!file.filePath) {
          validFiles.push(file);
          continue;
        }
        var exists = await window.electronAPI.fileExists(file.filePath);
        if (exists) {
          validFiles.push(file);
        }
      }
      this.projectFiles = validFiles;
      this.saveProjectState();
    }
    catch (e) {
      console.error(e);
      this.projectFiles = [];
    }
    this.renderProjectFiles();
  },
  loadSourceCodeInEditor: async function (contextId) {
    try {
      if (!contextId) {
        console.error("Missing contextId");
        return;
      }
      var url ="http://prerelease.liveplatform.com/GetSourceCode.do?ContextId=" +contextId +"&Mode=" +this.mode;
      var response = await fetch(url);
      if (!response.ok) {
        console.error("HTTP Error:", response.status);
        return;
      }
      var data = await response.json();
      var sourceObj = data.find(item => item && item["Source Code"]);
      if (!sourceObj) {
        console.error("Source Code not found");
        return;
      }
      var code = decodeURIComponent(sourceObj["Source Code"]);
      var tab = this.allContexts.find(t => t.id === this.currentContextId);

      if (!tab) {
        console.error("Current tab not found");
        return;
      }

      var fileName = tab.name || "";
      var language = this.getMonacoLanguage(fileName);
      // Create model only once per tab
      if (!tab.model) {
        tab.model = monaco.editor.createModel(code,language);
      } else {
        monaco.editor.setModelLanguage(tab.model,language);
        tab.model.setValue(code);
      }
      this.monacoEditor.setModel(tab.model);
      this.monacoEditor.focus();
    } catch (err) {
      console.error("Source load error:",err);
    }
  },
  openContextInEditor: async function (contextId, contextName) {
    try {
      if (!contextId) {
        console.error("Invalid contextId");
        return;
      }
      // Already open?
      var existingTab = this.allContexts.find(t => t.contextId == contextId
      );
      if (existingTab) {
        this.currentContextId = existingTab.id;
        if (existingTab.model) {
          this.monacoEditor.setModel(existingTab.model);
        }
        this.renderTabs();
        this.renderAiMessages(existingTab);
        utils.showSnackbar("Context opened");
        return;
      }
      var tabId = "ctx_" + contextId;
      var tab = {
        id: tabId,
        name: contextName || ("Context_" + contextId),
        contextId: contextId,
        isContext: true,
        model: null,
        aiMessages: []
      };
      this.allContexts.push(tab);
      this.currentContextId = tabId;
      this.renderTabs();
      this.renderAiMessages(tab);
      await this.loadSourceCodeInEditor(contextId);
      utils.showSnackbar("Context opened");
    } catch (err) {
      console.error("openContextInEditor error:", err);
    }
  },
  initializeContextMenu: function () {
    var menu = document.getElementById("contextMenu");
    document.addEventListener("click", () => {
      menu.classList.add("hidden");
    });
    document.addEventListener("contextmenu", (e) => {
      var target = e.target.closest("[data-context-id]");
      if (!target) return;
      e.preventDefault();
      var id = target.getAttribute("data-context-id");
      var menu = document.getElementById("contextMenu");
      menu.style.top = e.pageY + "px";
      menu.style.left = e.pageX + "px";
      menu.classList.remove("hidden");

      document.getElementById("copyContextId").onclick = async () => {
        await navigator.clipboard.writeText(id);
        menu.classList.add("hidden");
      };
    });
  },
openContextById: async function (contextId) {
  if (!contextId) {
    console.error("Invalid Context Id");
    return;
  }

  var contextName = "Context_" + contextId;
  var list = [];

  if (this.lastContextSource) {
    var source = this.lastContextSource;
    var cacheKey =
      (this.selectedEnterprise?.Id || "default") +
      "_" +
      this.mode +
      "_" +
      source.action +
      "_" +
      source.id;

    list =
      this.contextCache[source.action]?.[cacheKey] ||
      this.contextCache[source.action]?.[source.id] ||
      [];
  }

  var context = list.find(function (item) {
    return item.Object && String(item.Object.Id) === String(contextId);
  });

  if (context) {
    contextName = context.Object?.Name || context.Tag || contextName;
  }

  await this.openContextInEditor(contextId, contextName);
},
  setSelectedNode: function(node) {
    document.querySelectorAll(".tree-selected").forEach(el => el.classList.remove("tree-selected"));
    node.classList.add("tree-selected");
  },
  getMonacoLanguage: function(fileName) {
    if (!fileName || fileName.indexOf(".") === -1) {
      return "html";
    }
    var ext = fileName.split(".").pop().toLowerCase();
    var map = {
      js: "javascript",
      ts: "typescript",
      html: "html",
      htm: "html",
      css: "css",
      json: "json",
      xml: "xml",
      sql: "sql",
      java: "java",
      cs: "csharp",
      py: "python",
      php: "php"
    };
    return map[ext] || "html";
  },
  setContextSourceLabel: function(type, name) {
    var label = document.getElementById("commonSourceLabel");
    if (!label) return;
    if (type === "Category") {
      label.textContent = "Available Contexts From Cat : " + (name || "");
    }
    else if (type === "ObjectType") {
      label.textContent = "Contexts From OT : " + (name || "");
    }
    else if (type === "CloudType") {
      label.textContent = "Available Contexts From Cloud Type : " + (name || "");
    }
    else {
      label.textContent = "Available Contexts";
    }
  },
  refreshContexts: async function () {
  if (!this.lastContextSource) {
    console.warn("No context source selected.");
    return;
  }

  var source = this.lastContextSource;

  console.log("Refreshing Context:", source);

  var cacheKey =
    (this.selectedEnterprise?.Id || "default") +
    "_" +
    this.mode +
    "_" +
    source.action +
    "_" +
    source.id;

  if (this.contextCache[source.action]) {
    delete this.contextCache[source.action][cacheKey];
    delete this.contextCache[source.action][source.id];
  }

  utils.showContextLoader();

  try {
    switch (source.action) {
      case "ObjectType":
        await this.loadContexts(source.id, "ObjectType");
        break;

      case "Category":
        await this.loadCategoryContexts(source.id);
        break;

      case "CloudType":
        await this.loadCloudTypeContexts(source.id);
        break;

      default:
        console.warn("Unknown context source:", source.action);
        break;
    }
  }
  finally {
    utils.hideContextLoader();
  }
},
refreshCommonSection: async function () {
  switch (this.activeLeftPanelTab) {
    case "liveActions":
      await this.refreshContexts();
      break;

    case "projects":
      await this.loadProjects();

      if (this.selectedProjectFolderData) {
        this.showProjectFolderFiles(this.selectedProjectFolderData);
      }
      break;

    case "liveWebsite":
      if (this.selectedLiveWebsite) {
        await this.loadLiveWebsiteFiles(this.selectedLiveWebsite);
      }
      break;

    case "pushQueues":
      if (window.pushQueuesPlugin?.cloudDRI) {
        await window.pushQueuesPlugin.loadTable(
          window.pushQueuesPlugin.cloudDRI
        );
      }
      break;
  }
},
  renderContextsFromCache: function (list) {

    var common = this.showCommonContextBox({
        placeholder: "Search Contexts",
        showRefresh: true
    });

    if (!common) return;

    var container = common.container;
    var search = common.search;
    var self = this;

    new drawTable({
        container: container,
        data: list || [],
        fields: [
            {
                label: "Name",
                render: function (item) {
                    return item.Object
                        ? item.Object.Name || ""
                        : "";
                }
            },
            {
                label: "Last Edited On",
                render: function (item) {
                    return item["Last Edited On"] || "";
                }
            },
            {
                label: "Last Edited By",
                render: function (item) {
                    return item["Last Edited By"] || "";
                }
            }
        ],
        emptyText: "No Contexts Found",

        onRowClick: function (context) {

            var contextObject = context.Object;

            if (!contextObject) return;

            var contextControl =
                contextObject["Context Control__699483795"];

            if (contextControl === "Inherited") {
                return;
            }

            self.openContextInEditor(
                contextObject.Id,
                contextObject.Name
            );
        }
    });


    search.oninput = function () {

        var text = this.value.toLowerCase();

        container.querySelectorAll("tbody tr")
        .forEach(function (row) {

            row.style.display =
                row.textContent
                .toLowerCase()
                .includes(text)
                ? ""
                : "none";

        });
    };
},
  renderTreeFromCache: function(parentDiv, list, type) {

    var container = document.createElement("div");
    container.className = "children";
    container.style.marginLeft = "20px";
    list.forEach(child => {
      var div = document.createElement("div");
      div.innerHTML = `
        <span class="toggle">[+] </span>
        <span class="label">${child["Formatted Name"]}</span>
      `;
      div.dataset.open = "false";
      div.querySelector(".toggle").addEventListener("click", async (e) => {
        e.stopPropagation();
        await this.loadChildNodes(div, child.HierarchyPosition);
      });
      div.querySelector(".label").addEventListener("click", async (e) => {
        e.stopPropagation();
        this.setSelectedNode(div);
        if (type === "Category") {
          console.log("Category Click",child["Formatted Name"],"Id:",child.Id,"Hierarchy:",child.HierarchyPosition);
          this.setContextSourceLabel("Category",child["Formatted Name"]);

          this.lastContextSource = {
            action: "Category",
            id: child.Id || child.HierarchyPosition
          };
          await this.loadCategoryContexts(child.Id || child.HierarchyPosition);
        } else {
          console.log("CloudType Click",child["Formatted Name"],"Id:",child.Id,"Hierarchy:",child.HierarchyPosition);
          this.setContextSourceLabel("CloudType",child["Formatted Name"]);

          this.lastContextSource = {
            action: "CloudType",
            id: child.Id || child.HierarchyPosition
          };
          await this.loadCloudTypeContexts(child.Id || child.HierarchyPosition);
        }
      });
      container.appendChild(div);
    });

    parentDiv.appendChild(container);
    parentDiv.dataset.open = "true";
    this.setToggleState(parentDiv, true);
  },
  saveContext: async function (contextId) {
    try {
      var url = "http://prerelease.liveplatform.com/SetSourceCode.do" +"?ContextId=" + contextId +"&Mode=" + this.mode;
      var code = this.monacoEditor.getValue();
      console.log("Saving:", contextId);

      var response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: "SourceCode=" + encodeURIComponent(code)
      });
      console.log("Status:", response.status);
      var text = await response.text();
      console.log("Response:");
      console.log(text);
      utils.showSnackbar("Context saved successfully.");
    } catch (err) {
      console.error(err);
      utils.showSnackbar("Failed to save context.", "error");
    }
  },
  initializeSaveModal: function () { 
    var modal = document.getElementById("saveModal");
    document.getElementById("saveBtn").addEventListener("click", async () => {
      var tabId = this.pendingCloseTabId;
      if (!tabId) return;
      var tab = this.allContexts.find(t => t.id === tabId);
      var saved = true;
      if (tab?.contextId) {
        await this.saveContext(tab.contextId);
      } else {
        saved = await this.saveCurrentFile();

        // User clicked Cancel or closed Save dialog
        if (!saved) {
          modal.style.display = "none";
          this.pendingCloseTabId = null;
          return;
        }
      }
      modal.style.display = "none";
      this.closeTab(tabId);
      this.pendingCloseTabId = null;
    });
    document.getElementById("dontSaveBtn").addEventListener("click", () => {
      var tabId = this.pendingCloseTabId;
      modal.style.display = "none";
      if (tabId) {
        this.closeTab(tabId);
      }
      this.pendingCloseTabId = null;
    });
    document.getElementById("cancelBtn").addEventListener("click", () => {
      modal.style.display = "none";
      this.pendingCloseTabId = null;
    });
  },
  confirmCloseTab: function (tabId) {
    var tab = this.allContexts.find(t => t.id === tabId);
    if (!tab) return;
    var content = "";
    if (tab.model) {
      content = tab.model.getValue().trim();
    }
    if (!content) {
      this.closeTab(tabId);
      return;
    }
    this.pendingCloseTabId = tabId;
    var modal = document.getElementById("saveModal");
    modal.style.display = "flex";
  },
toggleContexts: function(show) {
  var box = document.getElementById("commonContextBox");
  if (box) {
    box.style.display = show ? "block" : "none";
  }
},
showContextsLoading: function () {
  this.toggleContexts(true);

  new drawTable({
    container: document.getElementById("commonTableContainer"),
    data: [],
    fields: [
      {
        label: "Name",
        field: "Name"
      },
      {
        label: "Last Modified",
        field: "Last Edited On"
      },
      {
        label: "Last Edited By",
        field: "Last Edited By"
      }
    ],
    emptyText: "Loading..."
  });
},

showContextsError: function () {
  new drawTable({
    container: document.getElementById("commonTableContainer"),
    data: [],
    fields: [
      {
        label: "Name",
        field: "Name"
      },
      {
        label: "Last Modified",
        field: "Last Edited On"
      },
      {
        label: "Last Edited By",
        field: "Last Edited By"
      }
    ],
    emptyText: "Failed to load contexts"
  });
},
showContextControls: function () {
  var box = document.getElementById("commonContextBox");
  if (!box) return;
  box.style.display = "block";
},
  initializeScriptLogin: function () {
    var button = document.getElementById("loadScriptButton");
    var urlInput = document.getElementById("scriptUrlInput");
    var checkbox = document.getElementById("showHiddenFiles");
    if (!button || !urlInput)return;

    var savedUrl = localStorage.getItem("scriptUrl");
    if (savedUrl) {
      urlInput.value = savedUrl;
      this.scriptDomain = savedUrl;
    }
    button.addEventListener("click", async () => {
      var domain = urlInput.value.trim();
      if (!domain) {
        utils.showSnackbar("Unable to login to this script URL, please ensure the URL is valid.", "error");
        return;
      }

      domain = domain.replace(/\/+$/, "");
      this.scriptDomain = domain;
      localStorage.setItem("scriptUrl", domain);
      var username = localStorage.getItem("loginUserName");
      var password = localStorage.getItem("loginPassword");

      if (!username || !password) {
        utils.showSnackbar("Please login first.");
        return;
      }

      try {
        button.disabled = true;
        button.textContent = "Processing...";

        // LSV2 Script Login
        var loginResp = await fetch(domain + "/login.do", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: new URLSearchParams({
            UserName: username,
            Password: password
          })
        });
        var loginData = await loginResp.json();
        console.log(loginData);
        if (!loginData || loginData.Result === false) {
          throw new Error("Script login failed.");
        }
        // Optional ExecuteCustomCode
        if (checkbox && checkbox.checked) {
          var response = await fetch(domain + "/ExecuteCustomCode.htm?ShowDebug=all",
            {
              method: "POST",
              credentials: "include",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded"
              },
              body: "ShowDebug=all"
            });
          console.log(await response.text());
        }
        utils.showSnackbar("Script login successful.");
      }
      catch (e) {
        console.error(e);
        utils.showSnackbar("Script login failed.","error");
      }
      finally {
        button.disabled = false;
        button.textContent = "Login";
      }
    });
  },
  runCustomScriptOnF5: async function () {
    var activeTab = document.querySelector("#tabsContainer .tab.active");
    try {
      this.showMiniLoader(activeTab);
      var domain = this.scriptDomain || localStorage.getItem("scriptUrl");
      if (!domain) {
        throw new Error("Script URL missing.");
      }

      var checkbox = document.getElementById("showHiddenFiles");

      var url = domain + "/ExecuteCustomCode.htm";
      if (checkbox && checkbox.checked) {
        url += "?ShowDebug=all";
      }

      var response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: checkbox && checkbox.checked ? "ShowDebug=all" : ""
      });

      var text = await response.text();

      if (!response.ok) {
        throw new Error(text || "Script execution failed.");
      }

      document.getElementById("executionPanel").classList.remove("hidden");
      document.getElementById("executionOutput").textContent = text;

      utils.showSnackbar("Script executed successfully.", "success");
    }
    catch (err) {
      document.getElementById("executionPanel").classList.remove("hidden");
      document.getElementById("executionOutput").textContent = err.message;

      utils.showSnackbar(err.message, "error");

      console.error(err);
    }
    finally {
      this.hideMiniLoader(activeTab);
    }
  },
  showScriptOutput: function (text) {
    var box = document.getElementById("scriptOutputBox");

    if (!box) {
      box = document.createElement("div");
      box.id = "scriptOutputBox";
      document.body.appendChild(box);
    }
    box.innerText = text;
  },
  showExecutionPanel: function (message) {
    var panel = document.getElementById("executionPanel");
    var loader = document.getElementById("executionLoader");
    var output = document.getElementById("executionOutput");
    var status = document.getElementById("executionStatus");
    var msg = document.getElementById("executionMessage");

    if (!panel || !loader || !output || !status || !msg) {
      return;
    }
    panel.classList.remove("hidden");
    loader.classList.remove("hidden");

    output.textContent = "";
    status.textContent = "Running...";
    msg.textContent = message || "Running script...";
  },
  updateExecutionOutput: function (text) {
    document.getElementById("scriptOutput").textContent = text || "";
  },
  finishExecutionPanel: function (text) {
    var loader = document.getElementById("executionLoader");
    var output = document.getElementById("executionOutput");
    var status = document.getElementById("executionStatus");
    if (!loader || !output || !status) {
      return;
    }
    loader.classList.add("hidden");
    status.textContent = "Completed";
    output.textContent = text || "";
  },
  hideExecutionPanel: function () {
    document.getElementById("executionPanel").classList.add("hidden");
  },
  toggleExecutionPanel: function () {
    document.getElementById("executionPanel").classList.toggle("hidden");
  },
  showExecutionResult: function (text) {
    document.getElementById("executionPanel").classList.remove("hidden");
    document.getElementById("executionOutput").textContent = text;
  },
  initializeAIPanel: function () {
    var sendBtn = document.getElementById("sendAiPrompt");
    var promptInput = document.getElementById("aiPrompt");

    if (!sendBtn || !promptInput) return;

    sendBtn.addEventListener("click", () => this.sendAiPrompt());
    promptInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.sendAiPrompt();
      }
    });
  },
  addAiMessage: function (text, role, isSystem, saveHistory = true) {
    var messages = document.getElementById("aiMessages");
    if (!messages) return;

    var entry = document.createElement("div");
    entry.className = "ai-message " + (role || "assistant");

    if (isSystem) {
      entry.classList.add("system");
    }

    entry.textContent = text || "";

    messages.appendChild(entry);
    messages.scrollTop = messages.scrollHeight;

    if (!saveHistory) return;

    var activeTab = this.allContexts.find(t => t.id === this.currentContextId);

    if (!activeTab) return;

    // Always keep aiMessages as Array
    if (!Array.isArray(activeTab.aiMessages)) {
      activeTab.aiMessages = [];
    }

    activeTab.aiMessages.push({
      role: role,
      text: text,
      isSystem: !!isSystem
    });
  },
  extractAiReply: function (payload) {
    if (!payload) return "";
    if (typeof payload === "string") return payload;

    if (Array.isArray(payload)) {
      for (var i = 0; i < payload.length; i++) {
        var nested = this.extractAiReply(payload[i]);
        if (nested) return nested;
      }
      return "";
    }

    if (typeof payload === "object") {
      var keys = ["response", "result", "message", "output", "text", "content", "reply", "answer", "data"];
      for (var key in payload) {
        if (!Object.prototype.hasOwnProperty.call(payload, key)) continue;
        var lowerKey = key.toLowerCase();
        if (keys.indexOf(lowerKey) !== -1) {
          var value = this.extractAiReply(payload[key]);
          if (value) return value;
        }
      }
      if (payload.Response) return this.extractAiReply(payload.Response);
      if (payload.Result) return this.extractAiReply(payload.Result);
      if (payload.Message) return this.extractAiReply(payload.Message);
      if (payload.Output) return this.extractAiReply(payload.Output);
      if (payload.Text) return this.extractAiReply(payload.Text);
      if (payload.Content) return this.extractAiReply(payload.Content);
      if (payload.Reply) return this.extractAiReply(payload.Reply);
      if (payload.Answer) return this.extractAiReply(payload.Answer);
    }
    return "";
  },
  sendAiPrompt: async function () {
    var promptInput = document.getElementById("aiPrompt");
    var sendBtn = document.getElementById("sendAiPrompt");
    if (!promptInput || !sendBtn) return;
    var activeTab = this.allContexts.find(t => t.id === this.currentContextId);

    if (!activeTab) {
      utils.showSnackbar("No file is open.", "warning");
      return;
    }
    if (!Array.isArray(activeTab.aiMessages)) {
      activeTab.aiMessages = [];
    }

    var prompt = promptInput.value.trim();
    if (!prompt) {
      utils.showSnackbar("Enter a prompt.", "warning");
      return;
    }

    // User message
    this.addAiMessage(prompt, "user");

    promptInput.value = "";
    sendBtn.disabled = true;

    // Loading message
    this.addAiMessage("Generating code...", "assistant", true);

    var messages = document.getElementById("aiMessages");
    var loadingNode = messages.lastElementChild;

    try {
      var domain = this.getSelectedEnterpriseDoamin();
      var selectedCode = "";
      if (this.monacoEditor && this.monacoEditor.getSelection()) {
        selectedCode = this.monacoEditor.getModel().getValueInRange(this.monacoEditor.getSelection());
      }

      var payload = {
        prompt: prompt,
        selectedCode: selectedCode,
        fileCode: this.monacoEditor ? this.monacoEditor.getValue() : ""
      };

      console.log("AI Payload:", payload);
      var response = await fetch("http://" + domain + "/GetAICode.json?RenderItem=" + activeTab.contextId,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify(payload)
        });
      var data = await response.json();
      console.log("AI Response:", data);
      // Remove loading node from UI
      if (loadingNode && loadingNode.parentNode) {
        loadingNode.parentNode.removeChild(loadingNode);
      }

      // Remove loading message from history
      activeTab.aiMessages = activeTab.aiMessages.filter(function (m) {
        return !(m.isSystem && m.text === "Generating code...");
      });

      if (!data.Success || !data.Code) {
        this.addAiMessage("No code returned.", "assistant", true);
        return;
      }

      // Create AI response UI
      var wrapper = document.createElement("div");
      wrapper.className = "ai-message assistant";

      var pre = document.createElement("pre");
      pre.className = "ai-code";
      pre.textContent = data.Code;

      var applyBtn = document.createElement("button");
      applyBtn.className = "apply-ai-btn";
      applyBtn.textContent = "Apply";

      applyBtn.onclick = () => {
        this.monacoEditor.setValue(data.Code);
        utils.showSnackbar("Code applied successfully.");
      };

      wrapper.appendChild(pre);
      wrapper.appendChild(applyBtn);

      messages.appendChild(wrapper);
      messages.scrollTop = messages.scrollHeight;

      // Save response in history
      activeTab.aiMessages.push({
        role: "assistant",
        code: data.Code
      });
    }
    catch (err) {
      console.error(err);

      if (loadingNode && loadingNode.parentNode) {
        loadingNode.parentNode.removeChild(loadingNode);
      }

      if (Array.isArray(activeTab.aiMessages)) {
        activeTab.aiMessages = activeTab.aiMessages.filter(function (m) {
          return !(m.isSystem && m.text === "Generating code...");
        });
      }
      this.addAiMessage("AI request failed.", "assistant", true);
      utils.showSnackbar("AI request failed.", "error");
    }
    finally {
      sendBtn.disabled = false;
      promptInput.focus();
    }
  },
  toggleAIPanel: function () {
    if (this.activeTabType === "pushQueues") {
      utils.showSnackbar("AI is not available in Push Queues.");
      return;
    }

    var panel = document.getElementById("aiPanel");
    panel.classList.toggle("hidden");

    if (!panel.classList.contains("hidden")) {
      document.getElementById("aiPrompt").focus();
    }
  },
  showAIResult: function(code) {
    var messages = document.getElementById("aiMessages");

    var box = document.createElement("div");
    box.className = "ai-message assistant";

    var pre = document.createElement("pre");
    pre.textContent = code;

    var btn = document.createElement("button");
    btn.className = "apply-ai-btn";
    btn.textContent = "Apply";

    btn.onclick = () => {
      this.monacoEditor.setValue(code);
      utils.showSnackbar("Code applied successfully");
    };

    box.appendChild(pre);
    box.appendChild(btn);

    messages.appendChild(box);
    messages.scrollTop = messages.scrollHeight;
  },
  renderAiMessages: function (tab) {
    var messages = document.getElementById("aiMessages");
    if (!messages) return;
    messages.innerHTML = "";

    if (!tab || !Array.isArray(tab.aiMessages)) {
      return;
    }
    tab.aiMessages.forEach(msg => {
      // Skip temporary loading message
      if (msg.isSystem && msg.text === "Generating code...") {
        return;
      }

      if (msg.code) {
        var wrapper = document.createElement("div");
        wrapper.className = "ai-message assistant";

        var pre = document.createElement("pre");
        pre.className = "ai-code";
        pre.textContent = msg.code;

        var applyBtn = document.createElement("button");
        applyBtn.className = "apply-ai-btn";
        applyBtn.textContent = "Apply";

        applyBtn.onclick = () => {
          this.monacoEditor.setValue(msg.code);
          utils.showSnackbar("Code applied successfully.");
        };
        wrapper.appendChild(pre);
        wrapper.appendChild(applyBtn);
        messages.appendChild(wrapper);
      } else {
        // Don't save again while restoring
        this.addAiMessage(msg.text, msg.role, msg.isSystem, false);
      }
    });
    messages.scrollTop = messages.scrollHeight;
  },
  openPushQueuesTab: function () {
    this.activeTabType = "pushQueues";

    var container = document.getElementById("pushQueuesContainer");
    var editor = document.getElementById("monacoEditor");
    var liveWebsiteContainer = document.getElementById("liveWebsiteContainer");

    var pushQueuesTab = document.getElementById("pushQueuesTab");
    var liveWebsiteTab = document.getElementById("liveWebsite");

    if (!container) return;

    // Show Push Queues
    container.style.display = "flex";

    // Hide Monaco Editor
    if (editor) {
        editor.style.display = "none";
    }

    // Hide LiveWebsite
    if (liveWebsiteContainer) {
        liveWebsiteContainer.style.display = "none";
    }

    // Active tab
    if (pushQueuesTab) {
        pushQueuesTab.classList.add("active");
    }

    if (liveWebsiteTab) {
        liveWebsiteTab.classList.remove("active");
    }

    // Disable AI
    var aiBtn = document.getElementById("aiTabButton");
    if (aiBtn) {
        aiBtn.disabled = true;
    }

    // Load Push Queues plugin
    if (!window.pushQueuesPlugin) {
        window.pushQueuesPlugin = new pushQueuesContent();
    } else {
        window.pushQueuesPlugin.loadMainCloud(true);
    }

    if (this.monacoEditor) {
        this.monacoEditor.layout();
    }
  },
  openLiveWebsiteTab: function () {
    this.activeTabType = "liveWebsite";

    var container = document.getElementById("liveWebsiteContainer");
    var pushQueuesContainer = document.getElementById("pushQueuesContainer");
    var editor = document.getElementById("monacoEditor");
    var pushQueuesTab = document.getElementById("pushQueuesTab");
    var liveWebsiteTab = document.getElementById("liveWebsite");

    if (!container || !editor) return;

    editor.style.display = "none";
    container.style.display = "block";

    if (pushQueuesContainer) {
      pushQueuesContainer.style.display = "none";
    }

    // Update active tab styling
    if (liveWebsiteTab) {
      liveWebsiteTab.classList.add("active");
    }
    if (pushQueuesTab) {
      pushQueuesTab.classList.remove("active");
    }
    // Disable AI button
    var aiBtn = document.getElementById("aiTabButton");
    if (aiBtn) {
      aiBtn.disabled = true;
    }
    this.restoreLiveWebsiteSelection();
    // Initialize the enterprise dropdown
    this.initializeLiveWebsiteTab();
  },
  initializeLiveWebsiteTab: async function () {
    var select = document.getElementById("liveWebsiteEnterpriseInput");
    if (!select) {
      console.warn("LiveWebsite Enterprise select not found.");
      return;
    }

    select.innerHTML = "";
    if (!this.enterprises || !this.enterprises.length) {
      return;
    }

    // Fill Enterprise Dropdown
    this.enterprises.forEach((enterprise) => {
      var option = document.createElement("option");
      option.value = enterprise.Id;
      option.textContent = enterprise["Formatted Name"] || enterprise.FormattedName || enterprise.Name;
      select.appendChild(option);
    });
    // Default Select = LivePlatform
    var livePlatform = this.enterprises.find(e => {
      var name = e["Formatted Name"] || e.FormattedName || e.Name || "";
      return name.toLowerCase() === "liveplatform";
    });

    if (livePlatform) {
      select.value = livePlatform.Id;
      this.selectedLiveWebsiteEnterprise = livePlatform;
      localStorage.setItem("selectedLiveWebsiteEnterprise",JSON.stringify(livePlatform));
      var brandSection = document.getElementById("brandSection");
      var brandInput = document.getElementById("liveWebsiteBrandInput");
      if (brandSection) {
        brandSection.style.display = "block";
      }
      if (brandInput) {
        brandInput.disabled = true;
        brandInput.innerHTML = '<option value="">Select Brand</option>';
      }
      await this.loadBrands(livePlatform);
    }

    // Change Event
    select.onchange = async (e) => {
      var enterprise = this.enterprises.find(x => x.Id == e.target.value);
      if (!enterprise)return;
      this.selectedLiveWebsiteEnterprise = enterprise;
      localStorage.setItem("selectedLiveWebsiteEnterprise",JSON.stringify(enterprise));
      var brandSection = document.getElementById("brandSection");
      var brandInput = document.getElementById("liveWebsiteBrandInput");
      if (brandSection) {
        brandSection.style.display = "block";
      }
      if (brandInput) {
        brandInput.disabled = false;
        brandInput.innerHTML = "";
      }
      await this.loadBrands(enterprise);
    };

    // Buttons
    var addLibraryBtn = document.getElementById("addLibraryBtn");
    if (addLibraryBtn && !addLibraryBtn.dataset.bound) {
      addLibraryBtn.dataset.bound = "true";
      addLibraryBtn.onclick = () => {
        this.createNewLiveWebsite();
      };
    }
    var addFileBtn = document.getElementById("addFileBtn");
    if (addFileBtn && !addFileBtn.dataset.bound) {
      addFileBtn.dataset.bound = "true";
      addFileBtn.onclick = () => {
        if (this.selectedLiveWebsite) {
            this.addFileToLiveWebsite();
        }
        else {
            utils.showSnackbar("Please select a LiveWebsite first.", "warning");
        }
      };
    }
  },
  loadBrands: async function (enterprise) {
    if (!enterprise) {
      console.warn("No enterprise selected.");
      return;
    }
    var select = document.getElementById("liveWebsiteBrandInput");

    if (!select) {
      console.warn("LiveWebsite Brand select not found.");
      return;
    }
    select.disabled = true;
    var oldDomain = GlobalDomain;
    GlobalDomain = "https://liveplatform.com";
    try {
      utils.showContextLoader();
      var cloudName = "[" + enterprise.Id + "]Brands";
      var brandCloud = await utils.getCloud(enterprise["Direct Resource Identifier"],cloudName);

      if (!brandCloud || !brandCloud.DRI) {
        console.warn("Brand cloud not found.");
        select.innerHTML = '<option value="">No Brands Found</option>';

        return;
      }
      this.brandCloudDRI = brandCloud.DRI;
      var data = await utils.getItems(brandCloud.DRI,"Name", true,1,9999);
      this.brands = data.Results || [];

      select.innerHTML = '<option value="">Select Brand</option>';
      this.brands.forEach(function (brand) {
        var option = document.createElement("option");
        option.value = brand.Id;
        option.textContent = brand.Name || "Unnamed Brand";
        select.appendChild(option);
      });
      select.disabled = false;
      var self = this;

      select.onchange = async function () {
        var brandId = this.value;
        if (!brandId) {
          self.selectedBrand = null;
          return;
        }

        var brand = self.brands.find(function (item) {
          return String(item.Id) === String(brandId);
        });

        if (!brand) {
          return;
        }
        self.selectedBrand = brand;
        localStorage.setItem("selectedLiveWebsiteBrand",JSON.stringify(brand));

        var tree = document.getElementById("liveWebsiteTree");
        if (tree) {
          tree.innerHTML = "";
        }
        await self.loadLiveWebsiteLibrary(enterprise,brand);
      };
      if (this.brands.length) {
        var defaultBrand = this.brands[0];
        select.value = defaultBrand.Id;
        this.selectedBrand = defaultBrand;
        localStorage.setItem("selectedLiveWebsiteBrand",JSON.stringify(defaultBrand));
        await this.loadLiveWebsiteLibrary(enterprise, defaultBrand);
      }
    }
    catch (err) {
      console.error("Failed to load brands:",err);
      select.innerHTML = '<option value="">Failed to load brands</option>';
    }
    finally {
      utils.hideContextLoader();
      select.disabled = false;
      GlobalDomain = oldDomain;
    }
  },
  loadLiveWebsiteLibrary: async function (enterprise, brand) {
    if (!enterprise || !brand) return;

    var oldDomain = GlobalDomain;
    GlobalDomain = "https://liveplatform.com";
    try {
      // Selected Brand DRI
      var brandDRI = brand["Direct Resource Identifier"] || brand.DRI;
      // Selected Brand Id
      var brandId = brand.Id;
      console.log("Brand DRI:", brandDRI);
      console.log("Brand Id:", brandId);
      // Brand DRI par UseCloud
      var libraryCloud = await utils.getCloud(brandDRI,"[" + brandId + "]LiveWebsite Library");
      console.log("Library Cloud:", libraryCloud);

      if (!libraryCloud || !libraryCloud.DRI) {
        console.warn("LiveWebsite Library cloud not found.");
        return;
      }

      this.libraryCloudDRI = libraryCloud.DRI;
      // Library cloud par GetItems
      var data = await utils.getItems(libraryCloud.DRI,"Name",true,1,9999);
      this.liveWebsiteLibraries = data.Results || [];
      console.log("LiveWebsite Libraries:", this.liveWebsiteLibraries);
      var tree = document.getElementById("liveWebsiteTree");
      if (!tree) {
        console.warn("liveWebsiteTree not found.");
        return;
      }
      tree.innerHTML = "";
      var self = this;
      this.liveWebsiteLibraries.forEach(function (website) {
        var item = document.createElement("span");
        item.className = "livewebsite-item";
        item.textContent = website.Name || "Unnamed";

        item.onclick = async function () {
          // Selected highlight
          tree.querySelectorAll(".livewebsite-item").forEach(function (x) {
            x.classList.remove("selected");
          });
          item.classList.add("selected");
          self.selectedLiveWebsite = website;
          localStorage.setItem("selectedLiveWebsite",JSON.stringify(website));
          console.log("Selected LiveWebsite:", website);
          await self.loadLiveWebsiteFiles(website);
        };
        tree.appendChild(item);
      });
    } catch (e) {
      console.error("Library Load Error:", e);
    } finally {
      GlobalDomain = oldDomain;
    }
  },
  getLiveWebsiteFiles: async function (library) {
    if (!library) {
      console.warn("LiveWebsite library missing.");
      return [];
    }
    var oldDomain = GlobalDomain;
    GlobalDomain = "https://liveplatform.com";
    try {
      var libraryDRI =library["Direct Resource Identifier"] ||library.DRI;
      var libraryId =library.Id;
      console.log("Selected LiveWebsite DRI:",libraryDRI);
      console.log("Selected LiveWebsite Id:",libraryId);
      if (!libraryDRI) {
        console.warn("LiveWebsite DRI missing.");
        return [];
      }
      var filesCloud = await utils.getCloud(libraryDRI,"[" + libraryId + "]Files");
      console.log("LiveWebsite Files Cloud:",filesCloud);
      if (!filesCloud || !filesCloud.DRI) {
        console.warn("LiveWebsite Files cloud not found.");
        return [];
      }

      this.liveWebsiteFilesCloudDRI =filesCloud.DRI;

      var data = await utils.getItems(filesCloud.DRI,"Name",true,1,9999);
      var files = data.Results || [];
      console.log("LiveWebsite Files:",files);
      return files;
    }
    catch (error) {
      console.error("Failed to load LiveWebsite files:",error);
      return [];
    }
    finally {
      GlobalDomain = oldDomain;
    }
  },
  loadLiveWebsiteFiles: async function (library) {
    var self = this;

    var common = this.showCommonContextBox({
        label: library.Name || "Live Website",
        placeholder: "Search Website Files",
        showRefresh: false
    });

    if (!common) return;

    var container = common.container;
    var search = common.search;

    var files = await this.getLiveWebsiteFiles(library);

    new drawTable({
        container: container,
        data: files,
        fields: [
            {
                label: "Name",
                field: "Name"
            },
            {
                label: "Created By",
                field: "CreatedBy"
            },
            {
                label: "Created On",
                field: "CreatedOn"
            }
        ],
        emptyText: "No Files Found",
        onRowClick: function (file) {
            self.openLiveWebsiteFile(file);
        }
    });

    search.oninput = function () {
        var text = this.value.toLowerCase();

        container.querySelectorAll("tbody tr").forEach(function (row) {
            row.style.display =
                row.textContent.toLowerCase().includes(text)
                    ? ""
                    : "none";
        });
    };
},
  getLiveWebsiteFileName: function (file) {
    if (!file) return "untitled.txt";
    return file.Name || file.name || file["File Name"] || file["fileName"] || "untitled.txt";
  },
  getLiveWebsiteFileContent: function (file) {
    if (!file) return "";
    if (typeof file.Content === "string") return file.Content;
    if (typeof file.content === "string") return file.content;
    if (typeof file.Text === "string") return file.Text;
    if (typeof file.text === "string") return file.text;
    if (typeof file.Code === "string") return file.Code;
    if (typeof file.code === "string") return file.code;
    return this.getDefaultLiveWebsiteFileContent(this.getLiveWebsiteFileName(file));
  },
  getDefaultLiveWebsiteFileContent: function (fileName) {
    var ext = (fileName || "").split(".").pop().toLowerCase();
    switch (ext) {
      case "html":
      case "htm":
        return "<!DOCTYPE html>\n<html>\n  <body>\n    <h1>Hello from LiveWebsite</h1>\n  </body>\n</html>";
      case "css":
        return "body {\n  font-family: Arial, sans-serif;\n  color: #333;\n}";
      case "js":
        return "console.log('Hello from LiveWebsite');";
      case "xml":
        return "<root>\n  <message>Hello</message>\n</root>";
      case "frm":
        return "<!-- Form template -->\n<form>\n  <input type=\"text\" />\n</form>";
      case "json":
        return "{\n  \"name\": \"livewebsite\"\n}";
      default:
        return "";
    }
  },
  isAllowedLiveWebsiteFile: function (fileName) {
    if (!fileName) return false;
    var ext = fileName.split(".").pop().toLowerCase();
    return ["html", "css", "js", "xml", "htm", "frm", "json"].includes(ext);
  },
  openLiveWebsiteFile: function (file) {
    var fileName = this.getLiveWebsiteFileName(file);
    var editor = document.getElementById("monacoEditor");
    if (!editor) return;
    // Monaco Editor show
    editor.style.display = "block";

    // Hide Push Queues if open
    var pushQueuesContainer = document.getElementById("pushQueuesContainer");
    if (pushQueuesContainer) {
      pushQueuesContainer.style.display = "none";
    }

    if (!this.isAllowedLiveWebsiteFile(fileName)) {
      utils.showSnackbar("This file type is not allowed for editing.", "warning");
      var messageModel = monaco.editor.createModel("File type not allowed for editing.","plaintext");
      this.monacoEditor.setModel(messageModel);
      this.monacoEditor.focus();
      return;
    }

    var content = this.getLiveWebsiteFileContent(file);
    var language = this.getMonacoLanguage(fileName);

    var model = monaco.editor.createModel(content, language);

    this.monacoEditor.setModel(model);
    this.monacoEditor.focus();
  },
  getFileIcon: function (fileName) {
    if (!fileName) return "";
    var ext = fileName.split(".").pop().toLowerCase();
    var icons = {
      html: "",
      css: "",
      js: "",
      json: "",
      png: "",
      jpg: "",
      jpeg: "",
      gif: "",
      svg: "",
      txt: ""
    };
    return icons[ext] || "";
  },
  createNewLiveWebsite: function () {
    var name = prompt("Enter LiveWebsite name:");
    if (!name) return;
    
    utils.showSnackbar("Creating new LiveWebsite: " + name + "...", "info");
    console.log("Create new LiveWebsite:", name);
  },
  addFileToLiveWebsite: function () {
    var fileName = prompt("Enter file name:");
    if (!fileName) return;
    
    utils.showSnackbar("Adding file: " + fileName + "...", "info");
    console.log("Add file to LiveWebsite:", fileName);
  },
  initializeSectionToggle: function (buttonId, panelId) {
    var button = document.getElementById(buttonId);
    var panel = document.getElementById(panelId);

    if (!button || !panel) return;
    button.onclick = () => {
      if (panel.style.display === "none") {
        panel.style.display = "block";
        button.innerHTML = "▼";
      } else {
        panel.style.display = "none";
        button.innerHTML = "▲";
      }
      if (this.monacoEditor) {
        this.monacoEditor.layout();
      }
    };
  },
  initializePushQueuesPanel: function () {
    var panel = document.getElementById("pushQueuesPanel");
    var toggle = document.getElementById("pushQueuesToggle");
    var expand = document.getElementById("pushQueuesExpand");

    if (!panel) {
      return;
    }
    var layoutEditor = () => {
      requestAnimationFrame(() => {
        this.monacoEditor?.layout();
      });
    };
    if (toggle) {
      toggle.onclick = () => {
        panel.classList.add("collapsed");
      };
    }

    if (expand) {
      expand.onclick = () => {
        panel.classList.remove("collapsed");
      };
    }
    panel.addEventListener("transitionend", () => {
      layoutEditor();
    });
  }, 
  loadProjects: async function () {
    try {
        var result = await window.electronAPI.getProjects();
        if (!result || !result.success) {
            console.error("Projects load failed:",result);
            return;
        }
        this.projectRoot = result.root;
        this.projectTreeItems =  result.items || [];
        console.log("PROJECT TREE ITEMS:",this.projectTreeItems);
    }
    catch (error) {
      console.error("Load projects error:",error);
    }
  },
  initializeProjectsToggle: function () {
    var toggle = document.getElementById("projectsToggle");
    var label = document.getElementById("projectsLabel");
    var panel = document.getElementById("projectExplorerPanel");
    var filesSection = document.getElementById("projectFilesSection");

    if (!toggle || !panel) {
      console.error("Projects toggle HTML missing");
      return;
    }

    toggle.onclick = () => {
      var isOpen = panel.style.display === "block";
      if (isOpen) {
        panel.style.display = "none";
        toggle.textContent = "[+]";
        if (filesSection) {
          filesSection.style.display ="none";
        }
        return;
      }
      panel.style.display = "block";
      toggle.textContent = "[-]";

      this.renderProjectTree(this.projectTreeItems || []);
    };

    if (label) {
      label.onclick = (e) => {
        e.stopPropagation();
        console.log("PROJECTS ROOT CLICKED");
        this.showProjectFolderFiles({
          name: "Projects",
          path: this.projectRoot,
          children:this.projectTreeItems || []
        });
      };
    }

  },
  initializeProjects: function () {
    document.getElementById("newProjectBtn").onclick = () => {
      this.showCreateProjectMenu();
    };
    this.loadProjects();
  },
  showCreateProjectMenu: function () {
    var type = prompt("Enter:\nproject\nfolder\nfile");
    if (!type) return;
    if (type === "project") {
      this.createProject();
    }
    else if (type === "folder") {
      this.createFolder();
    }
    else if (type === "file") {
      this.createFile();
    }
  },
  createProject: async function () {
    var name = prompt("Project Name");
    if (!name) return;
    await window.electronAPI.createProjectFolder(this.projectRoot + "\\" + name);
    this.loadProjects();
  },
  createFolder: async function () {
    if (!this.selectedProjectFolder) {
      utils.showSnackbar("Select Folder");
      return;
    }
    var name = prompt("Folder Name");
    if (!name) return;
    await window.electronAPI.createProjectFolder(this.selectedProjectFolder + "\\" + name);
    this.loadProjects();
  },
  createFile: async function () {
    if (!this.selectedProjectFolder) {
      utils.showSnackbar("Select Folder");
      return;
    }
    var name = prompt("File Name");
    if (!name) return;
    await window.electronAPI.createProjectFile(this.selectedProjectFolder + "\\" + name);
    this.loadProjects();
  },
  renderProjectTree: function (items) {
    var body = document.getElementById("projectExplorerPanel");
    if (!body) return;
    body.innerHTML = "";
    var self = this;
    function renderFolders(list,parent,level) {
        level = level || 0;
        var folders = (list || []).filter(function (item) {
          return item.type === "folder";
        });
        folders.forEach(function (folder) {
          var row = document.createElement("div");
          row.className ="project-item";
          row.style.paddingLeft =(level * 18) + "px";
          row.innerHTML = `
              <span class="toggle">[+]</span>
              <span class="project-folder-label">${folder.name}</span>
          `;
          parent.appendChild(row);
          var children = document.createElement("div");
          children.className ="children";
          children.style.display ="none";
          parent.appendChild(children);

          var folderToggle = row.querySelector(".toggle");
          folderToggle.onclick = function (e) {
              e.stopPropagation();
              var isOpen = children.style.display ==="block";
              if (isOpen) {
                children.style.display = "none";
                folderToggle.textContent = "[+]";
                return;
              }

              children.style.display = "block";
              folderToggle.textContent = "[-]";

              if (children.dataset.loaded !=="true") {
                renderFolders(folder.children || [],children,level + 1);
                children.dataset.loaded = "true";
              }
          };
          var folderLabel =row.querySelector(".project-folder-label");
          folderLabel.onclick = function (e) {
            e.stopPropagation();
            self.selectedProjectFolder = folder.path;

            self.showProjectFolderFiles(folder);
          };
        });
    }
    renderFolders(items || [], body,0);
  },
  showProjectFolderFiles: function (folder) {
    console.log("FOLDER CLICKED:", folder);

    var common = this.showCommonContextBox({
        label: "Files From : " + folder.name,
        placeholder: "Search Project Files",
        showRefresh: false
    });

    if (!common) return;

    var container = common.container;
    var search = common.search;

    var files = (folder.children || []).filter(function (item) {
      return item.type !== "folder";
    });

    var self = this;

    new drawTable({
      container: container,
      data: files,
      fields: [
          {
              label: "Name",
              field: "name"
          },
          {
              label: "Modified On",
              field: "modifiedOn"
          },
          {
              label: "Source",
              render: function () {
                  return "Local";
              }
          }
      ],
      emptyText: "No Files Found",
      onRowClick: async function (file) {
          await self.openProjectFile(file);
      }
    });

    search.oninput = function () {
      var text = this.value.toLowerCase();
      container.querySelectorAll("tbody tr").forEach(function (row) {
        row.style.display = row.textContent.toLowerCase().includes(text) ? "" : "none";
      });
    };
  },
  openProjectFile: async function (file) {
    try {
      console.log("OPEN FILE:",file);
      var result = await window.electronAPI.readProjectFile(file.path);
      if (!result || !result.success) {
        console.error("File read failed:",result);
        return;
      }

      var existing = this.allContexts.find(function (tab) {
        return (tab.filePath ===file.path);
      });
      if (existing) {
        this.switchContext(existing.id);
        return;
      }
      var model = monaco.editor.createModel(result.content || "",this.getMonacoLanguage(file.name));
      var tab = {
        id: "file_" + Date.now(),
        name:
          file.name,

        filePath:
          file.path,

        savedFileName:
          file.name,

        model:
          model,

        aiMessages:
          [],

        lastAIResult:
        null
      };
      this.allContexts.push(tab);
      this.currentContextId = tab.id;
      this.monacoEditor.setModel(model);

      this.renderTabs();
      this.renderAiMessages(tab);
      this.monacoEditor.layout();
      this.monacoEditor.focus();
    }
    catch (error) {
      console.error("Open project file error:",error);
    }
  },
};
window.editorInstance = new codeEditor();