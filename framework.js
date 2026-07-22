window.utils = window.utils || {};
utils.settings = JSON.parse(localStorage.getItem("Settings") || '{}');
utils.isInsecure = utils.settings.UseInsecureConnection === true;
utils.savedDomain = "livehrms.liveplatform.com";
utils.GlobalDomain = (utils.isInsecure ? "http://" : "https://") + utils.savedDomain;
utils.SecondaryDomain = (utils.isInsecure ? "http://" : "https://") + (localStorage.getItem("secondaryDomain") || "liveplatform.com");
utils.UserData = JSON.parse(localStorage.getItem("UserData"));
utils.currentUserId = null;
utils.quickNotesDRI = null;
utils.remindersDRI = null;
utils.EnterpriseList = [];
utils.enterpriseItemsCache = null;
window.utils = window.utils || {};

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
utils.showSnackbar = function (message, type = "success", duration = 1500) {
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
utils.reorderItem = function ({CloudDRI, ItemId, PlaceAfter, PlaceBefore, Confirmed, Callback}) {
  if (!CloudDRI || !ItemId) return;
  var url = CloudDRI + "/ReorderItem.do?Item=" + ItemId +(PlaceAfter ? "&PlaceAfter=" + PlaceAfter : "") +(PlaceBefore ? "&PlaceBefore=" + PlaceBefore : "") +(Confirmed === "Y" ? "&Confirmed=Y" : "");
  utils.showLoader();
  useFetch(url)
  .then(res => res.json())
  .then(data => {
    if (data.Success === true) {
      utils.showSnackbar("Order changed successfully", "success");
      Callback && Callback();
      return;
    }
    if (data["Confirmation Required"] === "Y" && Confirmed !== "Y") {
      utils.hideLoader();
      if (confirm(data.Message || "Confirm reorder?")) {
        utils.reorderItem({CloudDRI,ItemId,PlaceAfter,PlaceBefore,Confirmed: "Y",Callback});
      }
      return;
    }
    utils.showSnackbar(data.Message || "Reorder failed", "error");
  })
  .catch(() => {
    utils.showSnackbar("Something went wrong while reordering", "error");
  })
  .finally(() => {
    utils.hideLoader();
  });
}

utils.removeItems = function (CloudDRI, ItemId, Confirmed, Callback) {
  Confirmed = Confirmed == "N" || Confirmed == "undefined" ? false : (Confirmed === "Y" || Confirmed === true ? true : false);
  if (!CloudDRI || !ItemId) {
    return;
  }
  var url = CloudDRI +"/RemoveItem.do?ItemId=" + ItemId + (Confirmed ? "&Confirmed=Y" : "");
  if (Confirmed) {
    utils.showLoader();
  }
  useFetch(url)
  .then(res => res.json())
  .then(data => {
    console.log("Remove response:", data);
    if (data && data["Confirmation Required"] === "Y" && !Confirmed) {
      if (confirm(data.Message || "Are you sure you want to remove this item?")) {
        utils.removeItems(CloudDRI, ItemId, true, Callback);
      }
      return;
    }
    if (data.Success === true) {
      utils.hideLoader();
      utils.showSnackbar(data.Message || "Item removed successfully", "success");
      if (typeof Callback === "function") {
        Callback();
      }
      return;
    }
    utils.hideLoader();
    utils.showSnackbar(data.Message || "Remove failed", "error");
  })
  .catch(err => {
    utils.hideLoader();
    utils.showSnackbar("Something went wrong while removing item", "error");
  });
};

utils.multiRemoveItems = function (config) {
  if (!config || !config.baseDRI || !config.selectedMap) {
    console.error("multiRemoveItems: Missing required data");
    return;
  }

  var baseDRI = config.baseDRI;
  var selectedMap = config.selectedMap;
  var onSuccess = config.onSuccess || function () {};

  if (selectedMap.size === 0) return;

  var ids = Array.from(selectedMap.keys()).join("||");

  utils.callRemove({
    confirmed: false,
    baseDRI: baseDRI,
    ids: ids,
    config: config,
    onSuccess: onSuccess
  });
};

utils.callRemove = function ({ confirmed, baseDRI, ids, config, onSuccess }) {

  var url = baseDRI + "/RemoveItems.do?Items=" + ids + (confirmed ? "&Confirmed=Y" : "");
  if (confirmed && config.tableContainer) {
    config.tableContainer.selectedItems.clear();

    if (typeof config.updateBadge === "function") {
      config.updateBadge();
    }

    if (config.menu) {
      config.menu.classList.remove("show");
      config.menu.style.display = "none";
    }
  }
  if (confirmed) {
    utils.showLoader();
  }
  useFetch(url)
  .then(res => res.json())
  .then(data => {

    if (data && data["Confirmation Required"] === "Y" && !confirmed) {
      if (confirm(data.Message || "Are you sure you want to remove selected items?")) {
        utils.callRemove({
          confirmed: true,
          baseDRI: baseDRI,
          ids: ids,
          config: config,
          onSuccess: onSuccess
        });
      }
      return;
    }

    if (data.Success === true || data.Success == 'true') {
      utils.hideLoader();
      utils.showSnackbar(data.Message || "Items removed successfully", "success");
      onSuccess();
      return;
    }

    utils.hideLoader();
    utils.showSnackbar(data.Message || "Remove failed", "error");
  })
  .catch(() => {
    utils.hideLoader();
    utils.showSnackbar("Something went wrong while removing items", "error");
  });
};
utils.editItemFields = function (ItemDRI, Name, Fields, Callback, options) {
  if (!ItemDRI || !Array.isArray(Fields)) {
    utils.showSnackbar("Invalid edit data", "error");
    return;
  }
  options = options || {}; 
  var payload = {
    Fields: Fields.slice()
  };
  if (Name) {
    payload.Fields.push({ Key: "Name", Value: Name });
  }
  var url = ItemDRI + "/SetFields.do?FieldObject=" + encodeURIComponent(JSON.stringify(payload));
  utils.showLoader();
  useFetch(url)
  .then(res => res.json())
  .then(data => {
    if (data.Success === true || data.Result) {
      if (!options.silent) {
        utils.showSnackbar("Edited successfully");
      }
      Callback && Callback(data);
      return;
    }
    utils.showSnackbar(data.Message || "Update failed", "error");
  })
  .catch(() => {
    utils.showSnackbar("Something went wrong while updating", "error");
  })
  .finally(() => {
    utils.hideLoader();
  });
};

utils.createItemFields = function (CloudDRI, Name, Fields, Callback) {
  if (!CloudDRI || !Name) {
    utils.showSnackbar("Invalid create data", "error");
    return;
  }
  var payload = {Fields: Array.isArray(Fields) ? Fields : []};
  var url = CloudDRI + "/CreateItem.do?Name=" + encodeURIComponent(Name) + "&FieldObject=" + encodeURIComponent(JSON.stringify(payload));
  utils.showLoader();
  useFetch(url)
  .then(res => res.json())
  .then(data => {
    if (data.Success || data.Result) {
      utils.showSnackbar("Created successfully", "success");
      Callback && Callback(data);
      return;
    }
    utils.showSnackbar(data.Message || "Create failed", "error");
  })
  .catch(() => {
    utils.showSnackbar("Something went wrong while creating", "error");
  })
  .finally(() => {
    utils.hideLoader();
  });
};
utils.getCloudDetails = function (url) {
  return Clouds[url] && Clouds[url].CloudDetails ? Clouds[url].CloudDetails : null;
};
utils.getCloudItemsDetails = function (url) {
  return Clouds[url] && Clouds[url].ItemsDetails ? Clouds[url].ItemsDetails : null;
};
utils.setCloudDetails = function (url, details) {
  Clouds[url] = Clouds[url] || {};
  Clouds[url].CloudDetails = details;
};
utils.setCloudItemsDetails = function(url, items) {
  Clouds[url] = Clouds[url] || {};
  Clouds[url].ItemsDetails = items; 
};
utils.getCloud = function(dri,cloudName) {
  var url = dri + "/UseCloud.json?Name=" + cloudName;
  if (utils.getCloudDetails(url) && utils.getCloudDetails(url).DRI) {
    return new Promise((resolve, reject) => {
      resolve(utils.getCloudDetails(url));
    });
  }
  var userDRI = UserData["Direct Resource Identifier"];
  return useFetch(url)
  .then(res => res.json())
  .then(data => {
    utils.setCloudDetails(url, data.Results);
    return data.Results;
  });
},

utils.getItems = function (dri, fields, refresh, pageNumber, ResultCount) {
  var page = pageNumber || 1;
  var resultCount = ResultCount || 100;
  var cacheKey = dri + "_page_" + page;

  // Only cache first page
  if (!refresh && page === 1 && utils.getCloudItemsDetails(cacheKey)) {
    return Promise.resolve(utils.getCloudItemsDetails(cacheKey));
  }

  var url = dri + "/GetItems.json?Fields=" + fields + "&PageNumber=" + page + "&ResultCount=" + resultCount;

  return useFetch(url)
  .then(res => res.json())
  .then(data => {
    utils.setCloudItemsDetails(cacheKey, data);
    return data;
  });
};
utils.handleResizeMouseMove = function (e, state) {
  var newWidth = state.startWidth + (e.clientX - state.startX);
  if (newWidth < state.minWidth) newWidth = state.minWidth;
  if (newWidth > state.maxWidth) newWidth = state.maxWidth;
  state.leftPanel.style.width = newWidth + "px";
};

utils.handleResizeMouseUp = function (state) {
  document.removeEventListener("mousemove", state.mouseMoveHandler);
  document.removeEventListener("mouseup", state.mouseUpHandler);
  document.body.classList.remove("no-select");
};

utils.resizarFunction = function (config) {
  if (!config) return;
  var resizer = document.querySelector(config.resizer);
  var leftPanel = document.querySelector(config.left);
  if (!resizer || !leftPanel) {
    console.warn("Resizer or left section not found", config);
    return;
  }

  var state = {
    startX: 0,
    startWidth: 0,
    minWidth: config.minWidth || 150,
    maxWidth: config.maxWidth || 600,
    leftPanel: leftPanel,
    mouseMoveHandler: null,
    mouseUpHandler: null
  };

  resizer.style.cursor = "col-resize";

  resizer.addEventListener("mousedown", function (e) {
    state.startX = e.clientX;
    state.startWidth = leftPanel.offsetWidth;

    document.body.classList.add("no-select");

    // bind handlers with state
    state.mouseMoveHandler = function (ev) {
      utils.handleResizeMouseMove(ev, state);
    };

    state.mouseUpHandler = function () {
      utils.handleResizeMouseUp(state);
    };

    document.addEventListener("mousemove", state.mouseMoveHandler);
    document.addEventListener("mouseup", state.mouseUpHandler);

    e.preventDefault();
  });
};

utils.ShowPinned = function (dri, pinBtn, callback) {
  if (!dri || !pinBtn) return;
  var isPinned = pinBtn.classList.contains("pinned");
  var newValue = isPinned ? "N" : "Y";
  var url = dri + "/SetField.json?Field=Pinned&Value=" + newValue;
  utils.showLoader();
  console.log("PIN URL:", url);
  useFetch(url)
  .then(res => res.json())
  .then(data => {
    if (data.Success) {
      var cloudItem = pinBtn.closest(".-cloud-item, .note-row");
      if (!cloudItem) return;
      if (newValue === "Y") {
        pinBtn.classList.add("pinned");
        cloudItem.classList.add("pinned");
        var parent = cloudItem.parentNode;
        parent.insertBefore(cloudItem, parent.firstChild);
        utils.showSnackbar("Pinned Successfully");
      } else {
        pinBtn.classList.remove("pinned");
        cloudItem.classList.remove("pinned");
        utils.showSnackbar("Unpinned Successfully");
      }
      if (typeof callback === "function") {
        callback(newValue);
      }
    } else {
      utils.showSnackbar(data.Message || "Pin failed");
    }
  })
  .catch(err => {
    console.error(err);
    utils.showSnackbar("Pin error");
  })
  .finally(() => utils.hideLoader());
};

utils.multiSelect = function (tableContainer, enable, cloudDRI, controller) {
  if (!tableContainer) {
    console.error("MultiSelect: container not found");
    return;
  }

  if (enable === false) {
    utils.disableMultiSelect(tableContainer);
    return;
  }

  if (!tableContainer.classList.contains("multi-mode")) {
    utils.enableMultiSelect(tableContainer, cloudDRI, controller);
  }

  var searchWrapper = document.getElementById("searchWrapper");
  if (!searchWrapper) return;

  var badge = utils.getOrCreateBadge(searchWrapper);
  var menu = utils.getOrCreateMenu(searchWrapper, tableContainer, badge);

  utils.attachBadgeClick(badge, menu, tableContainer, searchWrapper);
  utils.attachOutsideClick(menu, searchWrapper);
  utils.setupHeaderCheckbox(tableContainer, badge);
  utils.setupRowCheckboxes(tableContainer, badge);
};

utils.disableMultiSelect = function (tableContainer) {
  tableContainer.classList.remove("multi-mode");
  tableContainer.selectedItems = new Set();

  tableContainer.querySelectorAll("thead th.multi-col").forEach(th => th.remove());
  tableContainer.querySelectorAll("tbody td.multi-col").forEach(td => td.remove());

  var searchWrapper = document.getElementById("searchWrapper");
  if (searchWrapper) {
    searchWrapper.querySelector(".selection-badge")?.remove();
    searchWrapper.querySelector(".selection-menu")?.remove();
  }
  tableContainer.querySelectorAll(".row-checkbox, .selected-circle").forEach(el => el.remove());
};
utils.enableMultiSelect = function (tableContainer, cloudDRI, controller) {
  tableContainer.classList.add("multi-mode");
  tableContainer.selectedItems = new Set();
  tableContainer._cloudDRI = cloudDRI;
  tableContainer._controller = controller;
};
utils.getOrCreateBadge = function (searchWrapper) {
  var badge = searchWrapper.querySelector(".selection-badge");
  if (!badge) {
    badge = document.createElement("span");
    badge.className = "selection-badge bold -click";
    searchWrapper.appendChild(badge);
  }
  return badge;
};

utils.updateBadge = function (tableContainer, badge) {
  var count = tableContainer.selectedItems.size;
  if (count === 0) {
    badge.style.display = "none";
  } else {
    badge.textContent = count > 99 ? "99+" : count;
    badge.style.display = "inline-flex";
  }
}; 
utils.getOrCreateMenu = function (searchWrapper, tableContainer, badge) {
  var menu = searchWrapper.querySelector(".selection-menu");
  if (!menu) {
    menu = document.createElement("ul");
    menu.className = "selection-menu";
    menu.innerHTML = `<li class="remove-selected -click">Remove</li>`;
    searchWrapper.appendChild(menu);

    menu.querySelector(".remove-selected").addEventListener("click", function (e) {
      e.stopPropagation();

      if (tableContainer.selectedItems.size === 0) return;

      var selectedMap = new Map();
      tableContainer.selectedItems.forEach(id => selectedMap.set(id, id));

      utils.multiRemoveItems({
        baseDRI: tableContainer._cloudDRI,
        selectedMap: selectedMap,
        tableContainer: tableContainer,
        menu: menu,
        updateBadge: () => utils.updateBadge(tableContainer, badge),
        onSuccess: function () {
          tableContainer.selectedItems.clear();
          utils.updateBadge(tableContainer, badge);
          menu.classList.remove("show");

          var ctrl = tableContainer._controller;

          if (ctrl?.refreshItemsFromCloud) ctrl.refreshItemsFromCloud();
          else if (ctrl?.loadTable) ctrl.loadTable(tableContainer._cloudDRI, true);
          else if (ctrl?.loadMainCloud) ctrl.loadMainCloud(true);
        }
      });
    });
  }
  return menu;
};
utils.attachBadgeClick = function (badge, menu, tableContainer, searchWrapper) {
  badge.onclick = null;

  badge.addEventListener("click", function (e) {
    e.stopPropagation();

    if (tableContainer.selectedItems.size === 0) return;

    menu.style.display = "block";
    menu.classList.add("show");

    var rect = badge.getBoundingClientRect();
    var parentRect = searchWrapper.getBoundingClientRect();
  });
};
utils.attachOutsideClick = function (menu, searchWrapper) {
  document.addEventListener("click", function (e) {
    if (!searchWrapper.contains(e.target)) {
      menu.classList.remove("show");
    }
  });
}; 
utils.setupHeaderCheckbox = function (tableContainer, badge) {
  var headerRow = tableContainer.querySelector("thead tr");
  if (!headerRow || headerRow.querySelector(".select-all-checkbox")) return;
  var th = document.createElement("th");
  th.classList.add("multi-col");
  th.style.width = "35px";
  th.style.textAlign = "center";
  th.innerHTML = `<input type="checkbox" class="select-all-checkbox"/>`;

  headerRow.insertBefore(th, headerRow.firstChild);
  var selectAll = th.querySelector(".select-all-checkbox");
  selectAll.addEventListener("change", function () {
    var allRows = tableContainer.querySelectorAll("tbody .row-checkbox");
    allRows.forEach(cb => {
      cb.checked = selectAll.checked;
      var id = cb.closest("tr").getAttribute("data-id");
      if (selectAll.checked) tableContainer.selectedItems.add(id);
      else tableContainer.selectedItems.delete(id);
    });
    utils.updateBadge(tableContainer, badge);
  });
};
utils.setupRowCheckboxes = function (tableContainer, badge) {
  tableContainer.querySelectorAll("tbody tr").forEach(row => {
    if (row.querySelector(".row-checkbox")) return;

    var td = document.createElement("td");
    td.classList.add("multi-col");
    td.style.width = "35px";
    td.style.textAlign = "center";
    td.innerHTML = `<input type="checkbox" class="row-checkbox"/>`;

    row.insertBefore(td, row.firstChild);

    var checkbox = td.querySelector(".row-checkbox");

    checkbox.addEventListener("change", function () {
      var id = row.getAttribute("data-id");
      if (!id) return;

      if (this.checked) tableContainer.selectedItems.add(id);
      else tableContainer.selectedItems.delete(id);

      utils.updateBadge(tableContainer, badge);
    });

    row.addEventListener("click", function (e) {
      if (e.target.closest(".multi-col")) return;

      checkbox.checked = !checkbox.checked;
      checkbox.dispatchEvent(new Event("change"));
    });
  });
};
utils.filterRows = function (input, container, rowSelector, clearBtn) {
  var value = input.value.toLowerCase().trim();
  if (clearBtn) {
    clearBtn.style.display = value ? "inline-block" : "none";
  }
  var rows = container.querySelectorAll(rowSelector);
  rows.forEach(function (row) {
    var text = row.innerText.toLowerCase();
    row.style.display = text.includes(value) ? "" : "none";
  });
};
utils.tableSearch = function (config) {
  if (!config) return;
  var input = document.querySelector(config.input);
  var clearBtn = document.querySelector(config.clearBtn);
  var container = document.querySelector(config.container);
  var rowSelector = config.rowSelector || "tbody tr";
  if (!input || !container) return;
  input.addEventListener("input", function () {
    utils.filterRows(input, container, rowSelector, clearBtn);
  });
  if (clearBtn) {
    clearBtn.addEventListener("click", function () {
      input.value = "";
      utils.filterRows(input, container, rowSelector, clearBtn);
    });
  }
};
utils.bindScroll = function (options) {
  var container = options.container;
  var loadMore = options.loadMore;
  var hasMore = options.hasMore;
  var loader = options.loader;
  var threshold = options.threshold || 20;
  if (!container) return;
  // prevent duplicate binding
  if (container.dataset.scrollBound) return;
  container.dataset.scrollBound = "true";
  var isLoading = false;
  container.addEventListener("scroll", function () {
    if (isLoading) return;
    if (!hasMore()) return;

    var scrollTop = container.scrollTop;
    var scrollHeight = container.scrollHeight;
    var clientHeight = container.clientHeight;

    if (scrollTop + clientHeight >= scrollHeight - threshold) {

      isLoading = true;

      if (loader) loader.classList.remove("-hidden");
      Promise.resolve(loadMore())
      .finally(function () {
        isLoading = false;
        if (loader) loader.classList.add("-hidden");
      });
    }
  });
};
var drawTable = function (O) {
  this.container = O.container;
  this.data = O.data || [];
  this.fields = O.fields || [];
  this.emptyText = O.emptyText || "No Items Found";
  this.onRowClick = O.onRowClick || null;
  this.getRowClass = O.getRowClass || null;

  if (!this.container)return;
  this.init();
};

drawTable.prototype = {
  init: function () {
    this.render();
  },
  render: function () {
    if (!this.container)return;
    this.container.innerHTML = "";
    var table = document.createElement("table");
    table.className = "contexts-table";
    table.appendChild(this.drawHeader());
    table.appendChild(this.drawBody());
    this.container.appendChild(table);
  },
  drawHeader: function () {
    var thead = document.createElement("thead");
    var tr = document.createElement("tr");
    this.fields.forEach(function (field) {
      var th = document.createElement("th");
      th.textContent = field.label || "";
      tr.appendChild(th);
    });
    thead.appendChild(tr);
    return thead;
  },
  drawBody: function () {
    var self = this;
    var tbody = document.createElement("tbody");
    if (!this.data.length) {
      var tr = document.createElement("tr");
      var td = document.createElement("td");
      td.colSpan = this.fields.length;
      td.className = "table-empty";
      td.textContent = this.emptyText;
      tr.appendChild(td);
      tbody.appendChild(tr);
      return tbody;
    }

    this.data.forEach(function (item, index) {
      var tr = document.createElement("tr");
      tr.dataset.index = index;
      if (item.Id) tr.dataset.id = item.Id;
      if (self.getRowClass) {

        var rowClass = self.getRowClass(item);
        if (rowClass)tr.classList.add(rowClass);
      }
      self.fields.forEach(function (field) {
        var td = document.createElement("td");
        var value;
        if (field.render) {
          value = field.render(item, index);
        }
        else {
          value = item[field.field];
        }
        // if (field.render) {
        //   value = field.render(item, index);
        // }
        // else {
        //   value = item[field.field];

        //   if ((value === undefined || value === null) && item.Fields) {
        //     value = item.Fields[field.field];
        //   }
        // }
        td.textContent = value === undefined ||value === null ? "" : value;
        tr.appendChild(td);
      });
      if (self.onRowClick) {
        tr.addEventListener("click",function (event) {
          self.onRowClick(item,tr,event);
        });
      }
      tbody.appendChild(tr);
    });
    return tbody;
  }
};