  //var draggedCloudLi = null;
  var LIVEHRMS_USER_DATA = null;
  var pushQueuesContent = function () {
    this.useCloudName = "Push Queues";
    this.mainCloudDRI = null;
    this.cloudDRI = null; 
    this.activeTab = null;
    this.selectedClouds = new Map();
    this.isMultiSelectMode = false;
    this.selectedItems = new Map();
    this.queueGroupsCache = null;   
    this.queueGroupsDRI = null;
    this.cloudPage = 1;
    this.hasMoreClouds = true;
    this.isLoadingClouds = false;
    this.selectedGroup = "All";
    this.init();
  };
  pushQueuesContent.prototype = {
    init: async function () {
          utils.showLoader();
        try {
            codeEditor.activeLeftPanelTab = "pushQueues";
            await this.loginToLiveHRMS();
            this.loadMainCloud();
            //this.toggleAddButtonVisibility();
            utils.resizarFunction({
                resizer: "#leftResizer",
                left: ".clouds-section",
                minWidth: 300,
                maxWidth: 400
            });
            this.attachEvents();
        } catch (err) {
            console.error("PushQueues Init Error:", err);
        }
        finally {
            utils.hideLoader();
        }
    },
    attachEvents: function () {
        this.attachClickEvents();
        this.attachSubmitEvents();
        document.onclick = function () {
            var menu = document.getElementById("editContextMenu");
            if (menu) {
                menu.style.display = "none";
            }
        };
    },
    attachClickEvents: function () {
        var addItemBtn = document.getElementById("addItemsBtn");
        var editItemRightBtn = document.getElementById("addItemsRightBtn");
        var cancelItemBtn = document.getElementById("cancelItemBtn");
        var itemPopup = document.getElementById("itemPopup");
        var contextPopup = document.getElementById("contextPopup");
        var cancelContextBtn = document.getElementById("cancelContextBtn");

        if (cancelContextBtn && contextPopup) {
            cancelContextBtn.onclick = function () {
                contextPopup.style.display = "none";
            };
        }

        if (addItemBtn && itemPopup) {
            addItemBtn.onclick = function () {
                console.log("Add Item button clicked");
                itemPopup.style.display = "flex";
            };
        }

        if (cancelItemBtn && itemPopup) {
            cancelItemBtn.onclick = function () {
                itemPopup.style.display = "none";
            };
        }
        document.addEventListener("click", function (e) {
            if (e.target && e.target.id === "addItemsRightBtn") {
                var contextPopup =document.getElementById("contextPopup");
                if (contextPopup) {
                    contextPopup.style.display = "flex";
                }
            }
        });

        // if (editItemRightBtn && contextPopup) {
        //     editItemRightBtn.onclick = function () {
        //         console.log("Edit Item button clicked");
        //         contextPopup.style.display = "flex";
        //     };
        // }

        if (contextPopup) {
            contextPopup.onclick = function (event) {
                if (event.target === contextPopup) {
                    contextPopup.style.display = "none";
                }
            };
        }
    },
    loginToLiveHRMS : async function() {
      var _url = GlobalDomain + "/Login.do";
      var username = localStorage.getItem("loginUserName");
      var password = localStorage.getItem("loginPassword");
      var response = await useFetch(_url, 
        "POST",
        null,
        new URLSearchParams({
          username: username,
          password: password
        })
      );
      var data = await response.json();
      LIVEHRMS_USER_DATA = data.Result || {};
    },
    loadMainCloud: function (refresh) {
        var self = this;

        var cloudList = document.getElementById("cloudList");
        //var itemsList = document.getElementById("itemsList");
        var tableContainer = document.getElementById("pushQueueItemsTableContainer");

        if (cloudList) {
            cloudList.innerHTML = "";
        }

        // if (itemsList) {
        //     itemsList.innerHTML = "<div class='no-items'>Select a Push Queue</div>";
        // }
        if (tableContainer) {
            tableContainer.innerHTML = "<div class='no-items'>Select a Push Queue</div>";
        }
        // Reset selected queue
        self.cloudDRI = null;
        self.tableItems = [];

        var userDRI = LIVEHRMS_USER_DATA && LIVEHRMS_USER_DATA["Direct Resource Identifier"];
        if (!userDRI) {
            console.warn("User DRI not found.");

            if (cloudList) {
                cloudList.innerHTML = "<div class='no-items'>User DRI Not Found</div>";
            }
            return;
        }

        utils.getCloud(userDRI,self.useCloudName)
        .then(function (cloud) {
            if (!cloud || !cloud.DRI) {
                if (cloudList) {
                    cloudList.innerHTML = "<div class='no-items'>No Push Queues Found</div>";
                }
                return null;
            }
            self.mainCloudDRI = cloud.DRI;
            return utils.getItems(cloud.DRI,"Name||Description||Created By||Created On||Last Pushed To||Last Pushed On||Push Queue Group",true,1,9999);
        })
        .then(function (data) {
            console.log(data.Results);
            if (!data) {
                return;
            }
            var clouds = data.Results || [];
            //self.drawCloudList(clouds);
            //self.setupCloudSearch(clouds);
            // self.pushQueueClouds = clouds;
            // self.drawCloudList(clouds);
            // self.setupCloudSearch();
            self.pushQueueClouds = clouds;
            self.initializeGroupDropdown();
            self.setupCloudSearch();
        })
        .catch(function (err) {
            console.error("Push Queues Load Error:",err);
            if (cloudList) {
                cloudList.innerHTML = "<div class='no-items'>Failed to load Push Queues</div>";
            }
        });
    },
    drawCloudList: async function (items) {
        var cloudList = document.getElementById("cloudList");
        if (!cloudList) {
            return;
        }
        cloudList.innerHTML = "";
        var self = this;
        var firstRow = null;
        var firstItem = null;
        var firstCloudDRI = null;

        (items || []).forEach(function (item, index) {
            var row = document.createElement("div");
            row.className = "tree-node -cloud-item";
            var name = item.Name ||"Unnamed";
            var cloudDRI = item.DRI ||item["Direct Resource Identifier"] ||"";
            row.innerHTML = `<span class="label">${name}</span>`;
            row.onclick = async function () {
                cloudList.querySelectorAll(".-cloud-item").forEach(function (x) {
                    x.classList.remove("selected");
                    x.classList.remove("active-item");
                });

                row.classList.add("selected");
                row.classList.add("active-item");

                self.selectedCloud = item;
                self.selectedCloudName = name;
                console.log("Selected Queue:",item);
                console.log("Queue DRI:",cloudDRI);

                if (!cloudDRI) {
                    console.warn("Queue DRI missing:",item);
                    return;
                }
                await self.loadTable(cloudDRI);
            };

            cloudList.appendChild(row);
            // Save first valid cloud
            if (!firstRow && cloudDRI) {
                firstRow = row;
                firstItem = item;
                firstCloudDRI = cloudDRI;
            }
        });


        // Default active cloud
        if (firstRow &&firstItem &&firstCloudDRI) {
            firstRow.classList.add("selected");
            firstRow.classList.add("active-item");
            self.selectedCloud = firstItem;
            self.selectedCloudName = firstItem.Name ||"Unnamed";
            console.log("Default Selected Queue:",firstItem);
            await self.loadTable(firstCloudDRI);
        }
    },
    loadTable: async function (cloudDRI) {
        if (!cloudDRI) {
            console.warn("Queue DRI missing.");
            return;
        }

        var self = this;

        var box = document.getElementById("commonContextBox");
        var commonLabel = document.getElementById("commonSourceLabel");
        var searchInput = document.getElementById("commonSearchInput");
        var tableContainer = document.getElementById("commonTableContainer");
        var addItemsRightBtn = document.getElementById("addItemsRightBtn");
        var contextPopup = document.getElementById("contextPopup");

        var info = document.getElementById("pushQueueInfo");
        var lastPushedBy = document.getElementById("lastPushedBy");
        var lastPushedOn = document.getElementById("lastPushedOn");

        var pushToQABtn = document.getElementById("pushToQABtn");
        var pushToPreBtn = document.getElementById("pushToPreBtn");
        var pushToLiveBtn = document.getElementById("pushToLiveBtn");

        if (!box || !tableContainer) {
            return;
        }

        box.style.display = "block";

        if (commonLabel) {
            commonLabel.textContent = this.selectedCloudName || "";
        }

        if (searchInput) {
            searchInput.value = "";
            searchInput.placeholder = "Search Items";
            searchInput.oninput = null;
        }

        if (addItemsRightBtn) {
            addItemsRightBtn.style.display = "flex";
            addItemsRightBtn.onclick = function () {
                if (contextPopup) {
                    contextPopup.style.display = "flex";
                }
            };
        }

        tableContainer.innerHTML = "<div class='no-items'>Loading...</div>";
        this.cloudDRI = cloudDRI;

        try {
            var data = await utils.getItems(
                cloudDRI,
                "Name||Created By||Created On",
                true,
                1,
                9999
            );

            var items = data && data.Results ? data.Results : [];

            this.tableItems = items;
            this.renderTable(items);
            this.setupTableSearch();

            // Show Last Push Info only if queue has linked items
            if (info) {
                info.style.display = items.length > 0 ? "block" : "none";
            }
        }
        catch (e) {
            console.error("Push Queue Items Load Error:", e);

            this.tableItems = [];
            this.renderTable([]);

            if (info) {
                info.style.display = "none";
            }
        }

        // Load Last Push Info
        try {
            var pushInfo = await useFetch(
                cloudDRI + "/GetFieldValues.json?Fields=Last Pushed To||Last Pushed On"
            ).then(function (r) {
                return r.json();
            });

            if (lastPushedBy) {
                lastPushedBy.textContent = pushInfo["Last Pushed To"] || "-";
            }

            if (lastPushedOn) {
                lastPushedOn.textContent = pushInfo["Last Pushed On"] || "-";
            }
        }
        catch (err) {
            console.error("Error loading push info:", err);

            if (lastPushedBy) {
                lastPushedBy.textContent = "-";
            }

            if (lastPushedOn) {
                lastPushedOn.textContent = "-";
            }
        }

        // Push Buttons (Always Visible)
        if (pushToQABtn) {
            pushToQABtn.onclick = function () {
                self.pushQueueAction("QA", cloudDRI, false);
            };
        }

        if (pushToPreBtn) {
            pushToPreBtn.onclick = function () {
                self.pushQueueAction("Prerelease", cloudDRI, false);
            };
        }

        if (pushToLiveBtn) {
            pushToLiveBtn.onclick = function () {
                self.pushQueueAction("Live", cloudDRI, false);
            };
        }
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


    renderTable: function (items) {
        var self = this;
        var container = document.getElementById("commonTableContainer");
        if (!container) {
            console.warn("commonTableContainer not found.");
            return;
        }
        this.currentTableItems = items || [];
        new drawTable({
            container: container,
            data: this.currentTableItems,

            fields: [
                {
                    label: "Name",
                    field: "Name"
                },
                {
                    label: "Created By",
                    render: function (item) {
                        return item["Created By"] || item.CreatedBy || "";
                    }
                },
                {
                    label: "Created On",
                    render: function (item) {
                        return item["Created On"] || item.CreatedOn || "";
                    }
                }
            ],
            emptyText: "No Items Found",
            onRowClick: function (item, row) {
                var contextId = item["Object Id"] ||item.ObjectId ||(item.Object && item.Object.Id) ||item.Id;
                console.log("Selected Item:", item);
                console.log("Context Id:", contextId);

                container.querySelectorAll("tbody tr").forEach(function (x) {
                    x.classList.remove("selected");
                });

                row.classList.add("selected");
                self.selectedTableItem = item;

                if (contextId) {
                    window.editorInstance.openContextInEditor(contextId, item.Name);
                }
            }
        });
    },
    createItems: function (selectedCloudDRI, name, desc) {
      var self = this;
      var fieldsArray = [];
      // Description field
      if (desc) {
        fieldsArray.push({
          Key: "Description",
          Value: desc
        });
      }
      var activeGroup = (self.activeTab || "").trim().toLowerCase();
      if (activeGroup && activeGroup !== "all" && activeGroup !== "archived" && activeGroup !== "shared") {
        fieldsArray.push({
          Key: "Push Queue Group",
          Value: self.activeTab
        });
      }
      utils.createItemFields(selectedCloudDRI, name, fieldsArray, function (resp) {
        if (!resp.Success || !resp.Results || !resp.Results.length) {
          console.error("Invalid create response", resp);
          return;
        }
        var newDRI = resp.Results[0].DRI;
        self.lastActiveCloud = newDRI;
        self.cloudDRI = newDRI;

        var key = "activePushQueue_" + self.activeTab;
        localStorage.setItem(key, newDRI);
        self.loadMainCloud(true);
      });
    },
    attachSubmitEvents: function () {
      var itemPopupForm = document.querySelector("#itemPopup form");
      var itemPopup = document.getElementById("itemPopup");
      var contextPopupForm = document.querySelector("#contextPopup form");
      var editContextMenu = document.getElementById("editContextMenu");
      itemPopupForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var itemName = document.getElementById("itemName").value.trim();
        var itemDescription = document.getElementById("itemDesc").value.trim();
        var parentDRI = this.selectedCloudDRI || this.mainCloudDRI;
        if (!parentDRI) {
          utils.showSnackbar("Parent cloud not found!");
          return;
        }
        this.createItems(parentDRI, itemName, itemDescription);
        itemPopup.style.display = "none";
        itemPopupForm.reset();
      }.bind(this));

      contextPopupForm.addEventListener("submit", function (e) {
        e.preventDefault();
        this.multipleLinkUrl();
      }.bind(this));
      
      editContextMenu.addEventListener("click", function (e) {
        var action = e.target.getAttribute("data-action");
        if (!action) return;
        var targetDri = editContextMenu.dataset.targetDri;
        var targetId = editContextMenu.dataset.targetId;
        var targetName = editContextMenu.dataset.targetName;
        var targetDesc = editContextMenu.dataset.targetDescription;
        editContextMenu.style.display = "none";
        if (action === "remove") {
            this.removeItem(targetDri, targetId, "left");
        }

        if (action === "edit") {
            var editName = document.getElementById("editItemName");
            var editItemDesc = document.getElementById("editItemDesc");
            var editPopup = document.getElementById("editPopup");
            var saveEditBtn = document.getElementById("saveEditBtn");

            editName.value = targetName || "";
            editItemDesc.value = targetDesc || "";
            editPopup.style.display = "flex";

            saveEditBtn.onclick = function () {
                var newName = editName.value.trim();
                var newDesc = editItemDesc.value.trim();

                this.lastActiveCloud = targetDri;
                this.editItem(targetDri, newName, newDesc);

                editPopup.style.display = "none";
            }.bind(this);
        }
        }.bind(this));
    },
    pushQueueAction: function (mode, selectedItem, isLeft) {
        utils.showLoader();
        var domain = "";
        switch (mode) {
            case "QA":
                domain = "https://livehrms.dev.liveplatform.com";
                break;

            case "Prerelease":
                domain = "https://livehrms.qa.liveplatform.com";
                break;

            case "Live":
                domain = "https://livehrms.prerelease.liveplatform.com";
                break;
        }

        var url;

        if (isLeft) {
            url = domain + selectedItem + "/PushContexts.do?Mode=" + encodeURIComponent(mode);
        } else {
            url = domain + "/ActionPush.do?Mode=" + encodeURIComponent(mode) + "&ContextId=" + encodeURIComponent(selectedItem);
        }
        console.log("Push URL:", url);
        useFetch(url)
        .then(function (res) {
            return res.json();
        })
        .then(async function (data) {
            console.log("ActionPush Response:", data);
            try {
                var pushInfo = await useFetch(pushQueuesPlugin.cloudDRI +"/GetFieldValues.json?Fields=Last Pushed To||Last Pushed On").then(function (r) {
                    return r.json();
                });
                console.log("Latest Push Info:", pushInfo);
            } catch (e) {
                console.error("GetFieldValues Error:", e);
            }
            utils.showSnackbar("Pushed successfully!");
        })
        .catch(function (err) {
            console.error("Push Error:", err);
        })
        .finally(function () {
            utils.hideLoader();
        });
    },
    multipleLinkUrl: function () {
      var contextIds = document.getElementById("contextIdsInput").value.trim();
      if (!contextIds) return;
      var cloudDRI = pushQueuesPlugin.cloudDRI;
      if (!cloudDRI) return;
      utils.showLoader();
      var linkUrl = cloudDRI + "/LinkMultiple.do?ItemIds=" + encodeURIComponent(contextIds);
      useFetch(linkUrl)
      .then((res) => res.json())
      .then(() => {
        pushQueuesPlugin.loadTable(cloudDRI, true);
      })
      .catch((err) => console.error("Error linking Context IDs:", err))
      .finally(() => {
        utils.hideLoader();
        document.getElementById("contextPopup").style.display = "none";
        document.getElementById("contextIdsInput").value = "";
      });
    },
    setupCloudSearch: function () {
        var self = this;
        var searchInput = document.getElementById("cloudSearchInput");
        var clearBtn = document.getElementById("cloudSearchClear");

        if (!searchInput) {
            return;
        }

        function applyFilters() {

            var query = searchInput.value.trim().toLowerCase();
            var filtered = self.pushQueueClouds || [];

            // Group Filter
            if (self.selectedGroup && self.selectedGroup !== "All") {
                filtered = filtered.filter(function (item) {
                    return (item["Push Queue Group"] || "") === self.selectedGroup;
                });
            }

            // Search Filter
            if (query) {
                filtered = filtered.filter(function (item) {

                    var name = item.Name || "";
                    var description = item.Description || "";

                    try {
                        name = decodeURIComponent(name);
                    } catch (e) {}

                    try {
                        description = decodeURIComponent(description);
                    } catch (e) {}

                    return (
                        name.toLowerCase().includes(query) ||
                        description.toLowerCase().includes(query)
                    );
                });
            }

            self.drawCloudList(filtered);

            if (clearBtn) {
                clearBtn.style.display = query ? "inline" : "none";
            }
        }

        searchInput.oninput = applyFilters;

        if (clearBtn) {
            clearBtn.onclick = function () {
                searchInput.value = "";
                clearBtn.style.display = "none";
                applyFilters();
                searchInput.focus();
            };
        }

        // Initial Load
        applyFilters();
    },
    setupTableSearch: function () {
        var self = this;
        var input = document.getElementById("commonSearchInput");

        if (!input) {
            return;
        }

        input.value = "";

        input.onclick = function (e) {
            e.stopPropagation();
        };

        input.onmousedown = function (e) {
            e.stopPropagation();
        };

        input.oninput = function (e) {
            e.stopPropagation();
            var query = this.value.trim().toLowerCase();
            if (!query) {
                self.renderTable(self.tableItems || []);
                return;
            }
            var filtered = (self.tableItems || []).filter(function (item) {
                var name = String(item.Name || "").toLowerCase();
                var createdBy = String(item["Created By"] || item.CreatedBy || "").toLowerCase();
                var createdOn = String(item["Created On"] || item.CreatedOn || "").toLowerCase();

                return (name.includes(query) || createdBy.includes(query) || createdOn.includes(query));
            });
            self.renderTable(filtered);
        };
    },
    removeItem: function (cloudDRI, itemId, source) {
        console.log("Removing", cloudDRI, itemId);
        var self = this;
        utils.removeItems(cloudDRI, itemId, true, function () {
            self.loadMainCloud(true);
        });
    },
    editItem: function (itemDRI, newName, newDesc) {
        var self = this;
        var fieldsArray = [
            {
                Key: "Description",
                Value: newDesc
            }
        ];
        utils.editItemFields(itemDRI, newName, fieldsArray, function () {
            self.loadMainCloud(true);
        });
    },
    loadLastPushInfo: function (cloudDRI) {
        if (!cloudDRI) return;

        var lastPushedBy = document.getElementById("lastPushedBy");
        var lastPushedOn = document.getElementById("lastPushedOn");

        var url = cloudDRI + "/GetFieldValues.json?Fields=Last Pushed By||Last Pushed On";

        useFetch(url)
        .then(res => res.json())
        .then(data => {
            console.log("Last Push Info:", data);

            if (lastPushedBy) {
                lastPushedBy.textContent = data["Last Pushed By"] || "-";
            }

            if (lastPushedOn) {
                var pushedOn = data["Last Pushed On"];

                if (pushedOn) {
                    pushedOn = new Date(pushedOn).toLocaleString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true
                    });
                }

                lastPushedOn.textContent = pushedOn || "-";
            }
        })
        .catch(err => {
            console.error("Last Push Info Error:", err);
        });
    },
    filterPushQueuesByGroup: function () {
        var self = this;

        var queues = self.pushQueueClouds || [];

        if (
            !self.selectedGroup ||
            self.selectedGroup === "All"
        ) {
            self.drawCloudList(queues);
            return;
        }

        var filtered = queues.filter(function (item) {
            return (item["Push Queue Group"] || "") === self.selectedGroup;
        });

        self.drawCloudList(filtered);
    },
    initializeGroupDropdown: async function () {
        var self = this;

        var input = document.getElementById("groupInput");
        var dropdown = document.getElementById("groupDropdown");
        var selectedText = input.querySelector(".selected-text");
        var search = document.getElementById("groupSearch");
        var options = document.getElementById("groupOptions");
        var noResult = document.getElementById("groupNoResult");

        if (!input || !dropdown || !selectedText || !options) {
            return;
        }

        // All queues se groups nikalo
        var groups = ["All"];

        (this.pushQueueClouds || []).forEach(function (item) {

            var group = item["Push Queue Group"];

            if (group && !groups.includes(group)) {
                groups.push(group);
            }
        });

        function render(list) {

            options.innerHTML = "";

            if (!list.length) {

                noResult.style.display = "block";
                return;
            }

            noResult.style.display = "none";

            list.forEach(function (groupName) {

                var div = document.createElement("div");

                div.className = "dropdown-option";
                div.textContent = groupName;

                div.onclick = function (e) {

                    e.stopPropagation();

                    self.selectedGroup = groupName;

                    selectedText.textContent = groupName;

                    dropdown.style.display = "none";

                    self.setupCloudSearch();
                };

                options.appendChild(div);
            });
        }

        render(groups);

        search.oninput = function () {

            var value = this.value.toLowerCase();

            render(groups.filter(function (g) {
                return g.toLowerCase().includes(value);
            }));
        };

        input.onclick = function (e) {

            e.stopPropagation();

            dropdown.style.display =
                dropdown.style.display === "block"
                    ? "none"
                    : "block";
        };

        dropdown.onclick = function (e) {
            e.stopPropagation();
        };

        document.addEventListener("click", function () {
            dropdown.style.display = "none";
        });
    },
  };
//   window.pushQueuesPlugin = new pushQueuesContent();
