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
    this.init();
  };
  pushQueuesContent.prototype = {
    init: async function () {
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
    },
    attachEvents: function () {
        this.attachClickEvents();
        this.attachSubmitEvents();
        document.addEventListener("click", function () {
            var menu = document.getElementById("editContextMenu");
            if (menu) {
                menu.style.display = "none";
            }
        });
    },
    attachClickEvents : function () {
        var addItemBtn = document.getElementById("addItemsBtn");
        var editItemRightBtn = document.getElementById("addItemsRightBtn");
        var cancelItemBtn = document.getElementById("cancelItemBtn");
        var itemPopup = document.getElementById("itemPopup");
        var contextPopup = document.getElementById("contextPopup");
        var cancelContextBtn = document.getElementById("cancelContextBtn");
        cancelContextBtn.addEventListener("click", function () {
            contextPopup.style.display = "none";
        });
        addItemBtn.addEventListener("click", function () {
            console.log("Add Item button clicked");
            itemPopup.style.display = "flex";
        });   
        cancelItemBtn.addEventListener("click", function () {
            itemPopup.style.display = "none";
        });
        editItemRightBtn.addEventListener("click", function () {
            console.log("Edit Item button clicked");
            contextPopup.style.display = "flex";
        });
        contextPopup.addEventListener("click", function (event) {
            if (event.target === contextPopup) {
                contextPopup.style.display = "none";
            }
        });
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
        var itemsList = document.getElementById("itemsList");
        if (cloudList) cloudList.innerHTML = "";
        if (itemsList) itemsList.innerHTML = "";

        var userDRI = LIVEHRMS_USER_DATA["Direct Resource Identifier"];
        utils.getCloud(userDRI, self.useCloudName)
        .then(function (cloud) {
            if (!cloud || !cloud.DRI) {
                cloudList.innerHTML = "<li>No Push Queues Found</li>";
                return;
            }
            self.mainCloudDRI = cloud.DRI;
            return utils.getItems(cloud.DRI,"Name||Description||Created By||Created On",true,1,9999);
        })
        .then(function (data) {
            if (!data) return;
            var clouds = data.Results || [];
            self.drawCloudList(clouds);
            self.setupCloudSearch(clouds, self.mainCloudDRI);
        })
        .catch(function (err) {
            console.error(err);
        });
    },
    drawCloudList: function (items) {
        var self = this;
        var cloudList = document.getElementById("cloudList");
        cloudList.innerHTML = "";
        if (!items.length) {
            cloudList.innerHTML = "<li>No Push Queues Found</li>";
            return;
        }
        items.forEach(function (item, index) {
            var li = document.createElement("li");

            li.className = "-cloud-item";
            li.textContent = decodeURIComponent(item.Name || "");
            li.dataset.dri = item.DRI;
            li.addEventListener("contextmenu", function (e) {
                e.preventDefault();
                e.stopPropagation();

                var editContextMenu = document.getElementById("editContextMenu");
                if (!editContextMenu) return;

                // Save selected item
                editContextMenu.dataset.targetDri = item.DRI;
                editContextMenu.dataset.targetId = item.Id;
                editContextMenu.dataset.targetName = item.Name;
                editContextMenu.dataset.targetDescription = item.Description || "";

                // Show menu
                editContextMenu.style.display = "block";
                editContextMenu.style.position = "fixed";
                editContextMenu.style.left = e.clientX + "px";
                editContextMenu.style.top = e.clientY + "px";
                editContextMenu.style.zIndex = "9999";
            });

            // Left click
            li.onclick = function () {
                document.querySelectorAll("#cloudList li").forEach(function (x) {
                    x.classList.remove("active-item");
                });
                li.classList.add("active-item");
                self.cloudDRI = item.DRI;
                self.loadTable(item.DRI);
            };

            // Right click
            li.oncontextmenu = function (e) {
                e.preventDefault();
                var menu = document.getElementById("editContextMenu");
                menu.dataset.targetDri = item.DRI;
                menu.dataset.targetId = item.Id;
                menu.dataset.targetName = decodeURIComponent(item.Name || "");
                menu.dataset.targetDescription = decodeURIComponent(item.Description || "");

                menu.style.display = "block";
                menu.style.left = e.pageX + "px";
                menu.style.top = e.pageY + "px";
            };

            cloudList.appendChild(li);
            if (index === 0) {
                li.click();
            }
        });
        document.addEventListener("click", function () {
            var menu = document.getElementById("editContextMenu");
            if (menu) {
                menu.style.display = "none";
            }
        });
    },
    loadTable: function (cloudDRI) {
        var self = this;
        var itemsList = document.getElementById("itemsList");
        itemsList.innerHTML = "";
        utils.getItems(cloudDRI, "Name||Created By||Created On", true, 1, 9999)
        .then(function (data) {
            var items = data.Results || [];
            // Save items for search
            self.tableItems = items;
            self.renderTable(items);
            self.setupTableSearch();
        });
    },
    renderTable: function (items) {
        var itemsList = document.getElementById("itemsList");

        if (!items.length) {
            itemsList.innerHTML = "<div>No Items Found</div>";
            return;
        }

        var html = "<table border='1' width='100%'>";
        html += "<tr><th>Name</th><th>Created By</th><th>Created On</th></tr>";

        items.forEach(function (item, index) {
            html += "<tr class='table-row' data-index='" + index + "'>";
            html += "<td>" + (item.Name || "") + "</td>";
            html += "<td>" + (item["Created By"] || "") + "</td>";
            html += "<td>" + (item["Created On"] || "") + "</td>";
            html += "</tr>";
        });

        html += "</table>";

        itemsList.innerHTML = html;
        var self = this;

        itemsList.querySelectorAll(".table-row").forEach(function (row) {
            row.addEventListener("contextmenu", function (e) {
                e.preventDefault();
                e.stopPropagation();

                var index = this.dataset.index;
                var item = items[index];

                var menu = document.getElementById("editContextMenu");
                if (!menu) return;

                menu.dataset.targetDri = item.DRI;
                menu.dataset.targetId = item.Id;
                menu.dataset.targetName = item.Name;
                menu.dataset.targetDescription = item.Description || "";

                menu.style.display = "block";
                menu.style.position = "fixed";
                menu.style.left = e.clientX + "px";
                menu.style.top = e.clientY + "px";
                menu.style.zIndex = "9999";
            });
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
    setupCloudSearch: function (clouds, cloudDRI) {
        var self = this;
        var searchInput = document.getElementById("cloudSearchInput");
        var clearBtn = document.getElementById("cloudSearchClear");

        if (!searchInput) return;

        searchInput.oninput = function () {
            var query = this.value.trim().toLowerCase();

            if (clearBtn) {
                clearBtn.style.display = query.length > 0 ? "inline" : "none";
            }

            if (query === "") {
                self.drawCloudList(clouds);
                return;
            }

            var filtered = clouds.filter(function (item) {
                return (
                    (item.Name && item.Name.toLowerCase().includes(query)) ||
                    (item.Description && item.Description.toLowerCase().includes(query))
                );
            });

            self.drawCloudList(filtered);
        };

        // Clear button
        if (clearBtn) {
            clearBtn.onclick = function () {
                searchInput.value = "";
                clearBtn.style.display = "none";
                self.drawCloudList(clouds);
                searchInput.focus();
            };
        }
    },
    setupTableSearch: function () {
        var self = this;
        var input = document.getElementById("tableSearch");
        var clearBtn = document.getElementById("tableSearchClear");

        if (!input) return;

        input.oninput = function () {

            var query = this.value.trim().toLowerCase();

            // Show / Hide clear button
            if (clearBtn) {
                clearBtn.style.display = query.length > 0 ? "inline" : "none";
            }

            if (query === "") {
                self.renderTable(self.tableItems);
                return;
            }

            var filtered = self.tableItems.filter(function (item) {
                return (
                    (item.Name &&
                        item.Name.toLowerCase().includes(query)) ||

                    (item["Created By"] &&
                        item["Created By"].toLowerCase().includes(query)) ||

                    (item["Created On"] &&
                        item["Created On"].toLowerCase().includes(query))
                );
            });

            self.renderTable(filtered);
        };

        // Clear button click
        if (clearBtn) {
            clearBtn.onclick = function () {
                input.value = "";
                clearBtn.style.display = "none";
                self.renderTable(self.tableItems);
                input.focus();
            };
        }
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
    }
  };
//   window.pushQueuesPlugin = new pushQueuesContent();
