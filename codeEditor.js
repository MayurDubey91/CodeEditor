var codeEditor = function () {
  this.versions = {};
  this.projectFiles = [];
  this.init();
};
codeEditor.prototype = {
  topLevelCategory: 944825057,
  topLevelCloudType: 944823551,
  init: async function () {
    // FIRST THING
    if (localStorage.getItem("isLoggedIn") === "true") {
      document.body.classList.add("logged-in");
    } else {
      document.body.classList.remove("logged-in");
      document.body.classList.add("no-scroll");
    }
    document.body.classList.add("app-ready");
    document.getElementById("contextControls").style.display = "none";
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

    // IMPORTANT: load saved project FIRST
    this.loadProjectState();
    this.pendingCloseTabId = null;
    this.initializeSaveModal();

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

    document.getElementById("searchContexts").addEventListener("input",utils.debounce((e) => {
      var text = e.target.value.toLowerCase();
      var rows = document.querySelectorAll("#contextsBody tr");

      rows.forEach(row => {
        row.style.display = row.textContent.toLowerCase().includes(text)? "": "none";
      });
    }, 200));

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
    document.getElementById("refreshContextsBtn")?.addEventListener("click",() => 
      this.refreshContexts()
    );
    document.addEventListener("keydown", async (e) => {
      if (e.key === "F5") {
        e.preventDefault(); // browser refresh rok dega
        await this.runCustomScriptOnF5();
      }
    });

    this.initializeMonacoEditor();
    // render AFTER loadProjectState
    this.renderProjectFiles();

    this.initializeSidebarToggle();
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
  initializeSidebarToggle: function () {
    var projectPanel = document.getElementById("projectPanel");
    var collapseBtn = document.getElementById("projectToggle");
    var expandBtn = document.getElementById("projectExpand");
    if (collapseBtn) {
      collapseBtn.addEventListener("click", () => {
        projectPanel.classList.add("collapsed");
        if (this.monacoEditor) {
          setTimeout(() => this.monacoEditor.layout(), 300);
        }
      });
    }
    if (expandBtn) {
      expandBtn.addEventListener("click", () => {
        projectPanel.classList.remove("collapsed");

        if (this.monacoEditor) {
          setTimeout(() => this.monacoEditor.layout(), 300);
        }
      });
    }
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

    var model = monaco.editor.createModel("", "javascript");

    var tab = {
        id: id,
        name: "untitled",
        model: model
    };

    this.allContexts.push(tab);
    this.currentContextId = id;

    this.renderTabs();
    this.monacoEditor.setModel(model);
    this.monacoEditor.focus();
},
  renderTabs: function () {
    var container = document.getElementById("tabsContainer");
    container.innerHTML = "";
    this.allContexts.forEach(tab => {
      var div = document.createElement("div");
      div.className = "tab " + (tab.id === this.currentContextId ? "active" : "");

      // Tab Name
      var title = document.createElement("span");
      title.className = "tab-title";
      title.innerText = tab.name;

      title.onclick = () => {
        this.switchContext(tab.id);
      };

      div.appendChild(title);

      // Close Button
      var closeBtn = document.createElement("span");
      closeBtn.className = "tab-close";
      closeBtn.innerHTML = "X";

      closeBtn.onclick = (e) => {
        e.stopPropagation();
        this.confirmCloseTab(tab.id);
      };
      div.appendChild(closeBtn);
      container.appendChild(div);
    });
  },
  switchContext: function (id) {
    var tab = this.allContexts.find(t => t.id === id);
    if (!tab) return;
    this.currentContextId = id;
    this.monacoEditor.setModel(tab.model);
    this.renderTabs();
    // ADD THIS
    this.renderProjectFiles();
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

        document.querySelector(".-context-input-box").style.display = "none";

        var wrapper = document.getElementById("contextsWrapper");
        if (wrapper) wrapper.style.display = "none";
        this.toggleContexts(false);

        var tbody = document.getElementById("contextsBody");
        if (tbody) tbody.innerHTML = "";

        document.getElementById("Cat").innerHTML = "";

        await this.getAndLoadTopLevelCategoryAndCloudType();
      });
      this.getAndLoadOTs();
      this.getAndLoadTopLevelCategoryAndCloudType();
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
            await this.loadCategories(item, div);
            return;
          }

          if (name === "Cloud Types") {
            await this.loadCloudTypes(item, div);
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
    
    try {
      type = (type || "").trim();

      var cacheKey =
        (this.selectedEnterprise?.Id || "default") +
        "_" +
        this.mode +
        "_" +
        type +
        "_" +
        objectId;

      // Prevent duplicate API calls
      if (this.contextLoading[cacheKey]) {
        return;
      }

      this.contextLoading[cacheKey] = true;

      if (!this.contextCache[type]) {
        this.contextCache[type] = {};
      }

      // Cache hit
      if (this.contextCache[type][cacheKey]) {
        this.renderContextsFromCache(
          this.contextCache[type][cacheKey]
        );

        this.contextLoading[cacheKey] = false;
        return;
      }

      utils.showContextLoader();
      document.querySelector(".-context-input-box").style.display = "flex";

      var wrapper = document.getElementById("contextsWrapper");
      var tbody = document.getElementById("contextsBody");

      wrapper.style.display = "block";
      tbody.innerHTML = "<tr><td colspan='3'>Loading...</td></tr>";

      var domain = this.getSelectedEnterpriseDoamin();

      var url =
        "http://" +
        domain +
        "/GetContexts.json?Type=" +
        type +
        "&Fields=Last%20Edited%20On||Last%20Edited%20By" +
        "&ResultCount=3000" +
        "&ObjectType=" +
        objectId;

      var response = await fetch(url);
      var data = await response.json();

      var list = data.Results || [];

      // DEBUG
      console.log("Contexts:", list);

      // Save cache
      this.contextCache[type][objectId] = list;
      this.contextCache[type][cacheKey] = list;

      // Single render point
      this.renderContextsFromCache(list);

    } catch (err) {

      console.error("Context error:", err);

      document.getElementById("contextsBody").innerHTML =
        "<tr><td colspan='3'>Failed</td></tr>";

    } finally {

      utils.hideContextLoader();

      delete this.contextLoading[cacheKey];
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
        wrapper.style.display = "none";
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
    this.toggleContexts(true);

    console.log("loadCategoryContexts called with:",objectId);
    try {
      // // CACHE HIT
      // if (this.contextCache.Category &&this.contextCache.Category[objectId]) {
      //   this.renderContextsFromCache(this.contextCache.Category[objectId]);
      //   return;
      // }
      var cacheKey = (this.selectedEnterprise?.Id || "default") +"_" + this.mode + "_" +objectId;

      if (this.contextCache.Category &&this.contextCache.Category[cacheKey]) {
        this.renderContextsFromCache(this.contextCache.Category[cacheKey]);
        return;
      }
      utils.showContextLoader();
      document.querySelector(".-context-input-box").style.display = "flex";

      var wrapper = document.getElementById("contextsWrapper");
      var tbody = document.getElementById("contextsBody");

      wrapper.style.display = "block";
      tbody.innerHTML = "<tr><td colspan='3'>Loading...</td></tr>";

      var domain = this.getSelectedEnterpriseDoamin();

      var url ="http://" + domain +"/GetContexts.json?Type=OnCategory" +"&Fields=Last%20Edited%20On||Last%20Edited%20By" +"&ResultCount=3000" +"&ObjectType=" + objectId;

      console.log("Category URL:", url);

      var response = await fetch(url);
      var data = await response.json();

      var list = data.Results || [];

      // SAVE CACHE
      //this.contextCache.Category[objectId] = list;
      this.contextCache.Category[cacheKey] = list;

      // SINGLE RENDER FUNCTION
      this.renderContextsFromCache(list);

    } catch (err) {
      console.error(err);
      document.getElementById("contextsBody").innerHTML ="<tr><td colspan='3'>Failed</td></tr>";
    } finally {
      utils.hideContextLoader();
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
      if (!currentTab)
      return false;
      var content = this.monacoEditor.getValue();
      var result = await window.electron.saveFile({
        filePath: currentTab.filePath,
        defaultName:
        currentTab.savedFileName || "untitled.js",
        content: content
      });
      if (result.canceled)return false;
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
    var body = document.querySelector(".project-body");
    if (!body) return;
    body.innerHTML = "";
    if (this.projectFiles.length === 0) {
      body.innerHTML = "Your project is currently empty";
      return;
    }

    this.projectFiles.forEach(file => {
      var div = document.createElement("div");
      div.className = "project-file" +(file.contextId === this.currentContextId ? " active" : "");
      div.innerHTML = "📄 " + file.name;

      div.onclick = () => {
        var existingTab = this.allContexts.find(t => t.id === file.contextId);
        if (existingTab) {
          this.switchContext(existingTab.id);
          this.renderProjectFiles();
          return;
        }
        var model = monaco.editor.createModel(file.content || "",this.getMonacoLanguage(file.name));

        var tab = {
          id: file.contextId,
          name: file.name,
          model: model
        };

        this.allContexts.push(tab);
        this.currentContextId = tab.id;
        this.renderTabs();
        this.monacoEditor.setModel(model);
        this.renderProjectFiles();
      };
      body.appendChild(div);
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
  loadProjectState: function () {
    try {
      this.projectFiles = JSON.parse(localStorage.getItem("codeEditorProjectFiles")) || [];
    } catch (e) {
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
        utils.showSnackbar("Context opened");
        return;
      }
      var tabId = "ctx_" + contextId;
      var tab = {
        id: tabId,
        name: contextName || ("Context_" + contextId),
        contextId: contextId,
        isContext: true,
        model: null
      };
      this.allContexts.push(tab);
      this.currentContextId = tabId;
      this.renderTabs();
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
    var row = Array.from(document.querySelectorAll("#contextsBody tr")).find(tr => tr.dataset.contextId === contextId);

    if (row) {
      contextName = row.cells[0].innerText || contextName;
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
    var label = document.getElementById("contextSourceLabel");
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
      alert("No context source selected.");
      return;
    }
    var source = this.lastContextSource;
    // FORCE API CALL
    if (this.contextCache[source.action]) {
      var cacheKey;
      if (source.action === "ObjectType") {
        cacheKey = (this.selectedEnterprise?.Id || "default") + "_" +this.mode +"_" +"ObjectType" +"_" +source.id;
      } else {
        cacheKey = (this.selectedEnterprise?.Id || "default") + "_" + this.mode + "_" + source.id;
      }
      delete this.contextCache[source.action][cacheKey];
    }
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
    }
  },
  renderContextsFromCache: function(list) {
    this.showContextControls();
    var wrapper = document.getElementById("contextsWrapper");
    var tbody = document.getElementById("contextsBody");

    if (wrapper) {
      wrapper.style.display = "block";
    }
    tbody.innerHTML = "";
    list.forEach(ctx => {
      var contextId = ctx.Id ||ctx.ContextId ||ctx.Object?.Id;
      var contextName = ctx.Object?.Name ||ctx.DisplayName ||ctx.Tag ||"Unnamed";
      // Find any Context Control__xxxxx field
      var contextControl = "";

      for (var key in (ctx.Object || {})) {
        if (key.indexOf("Context Control__") === 0 && ctx.Object[key]) {
          contextControl = ctx.Object[key];
          break;
        }
      }
      var isInherited = (contextControl || "").toLowerCase() === "inherited";
      //console.log(contextName,contextControl,isInherited);

      var tr = document.createElement("tr");
      tr.dataset.contextId = contextId;

      // Name
      var nameTd = document.createElement("td");
      nameTd.innerText = contextName;

      // Last Edited On
      var modifiedTd = document.createElement("td");
      modifiedTd.innerText = ctx["Last Edited On"] ||ctx.Fields?.["Last Edited On"] ||"N/A";

      // Last Edited By
      var editedTd = document.createElement("td");
      editedTd.innerText = ctx["Last Edited By"] ||ctx.Fields?.["Last Edited By"] ||"N/A";

      if (isInherited) {
        nameTd.classList.add("context-inherited");
        nameTd.title = "Inherited Context";

        // NO CLICK HANDLER
      } else {
        nameTd.classList.add("context-clickable");
        nameTd.style.cursor = "pointer";
        nameTd.addEventListener("click", async () => {
          await this.openContextInEditor(contextId,contextName);
        });
      }

      tr.appendChild(nameTd);
      tr.appendChild(modifiedTd);
      tr.appendChild(editedTd);

      tbody.appendChild(tr);
    });
    utils.hideContextLoader();
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
      var url = "http://prerelease.liveplatform.com/SetSourceCode.do" +"?ContextId=" + contextId +"&Mode=" +this.mode;
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
    var wrapper = document.getElementById("contextsWrapper");
    if (wrapper) {
      wrapper.style.display = show ? "block" : "none";
    }
  },
  showContextsLoading: function () {
    this.toggleContexts(true);
    var tbody = document.getElementById("contextsBody");
    tbody.innerHTML = "<tr><td colspan='3'>Loading...</td></tr>";
  },
  showContextControls: function () {
    document.getElementById("contextControls").style.display = "block";
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
};
window.editorInstance = new codeEditor();