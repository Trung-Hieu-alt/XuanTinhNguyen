function doGet(e) {
  var parameters = e && e.parameter ? e.parameter : {};
  var callback = parameters.callback || "";
  if (callback && !/^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)) {
    throw new Error("Callback không hợp lệ.");
  }

  try {
    var result;
    if (parameters.action === "getLichTruc") {
      var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      var scheduleSheet = spreadsheet.getSheetByName("DANH SÁCH ĐIỀN CA TRỰC");
      if (!scheduleSheet) {
        throw new Error('Không tìm thấy trang tính "DANH SÁCH ĐIỀN CA TRỰC".');
      }

      result = scheduleSheet.getDataRange().getDisplayValues();
      if (result.length > 0) result.shift();
    } else if (parameters.action === "listQuanCaDrafts") {
      result = listQuanCaDrafts();
    } else if (parameters.action === "getQuanCaProductPrices") {
      result = getQuanCaProductPrices();
    } else if (parameters.action === "getProducts") {
      result = getProductCatalog();
    } else if (parameters.action === "getPostStatus") {
      result = getPostStatus(parameters.requestId);
    } else {
      throw new Error("Thao tác không được hỗ trợ.");
    }

    return apiOutput(result, callback);
  } catch (error) {
    return apiOutput({ error: error.message || String(error) }, callback);
  }
}

function doPost(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error("Thiếu dữ liệu gửi lên.");
  }

  var data = JSON.parse(e.postData.contents);
  var requestId = data.requestId;
  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var result;

    if (data.action === "saveQuanCaDraft") {
      result = saveQuanCaDraft(data.draft);
    } else if (data.action === "deleteQuanCaDraft") {
      result = deleteQuanCaDraft(data.id);
    } else if (data.action === "dangKyCa") {
      var registrationSheet = spreadsheet.getSheetByName(
        "DANH SÁCH ĐIỀN CA TRỰC",
      );
      if (!registrationSheet) {
        throw new Error('Không tìm thấy trang tính "DANH SÁCH ĐIỀN CA TRỰC".');
      }
      var registrationName = String(data.hoTen || "").trim();
      var registrationDate = String(data.ngayTruc || "");
      var registrationRole = String(data.vaiTro || "").trim();
      if (!registrationName) {
        throw new Error("Thiếu họ tên. Hãy tải lại trang đăng ký và nhập họ tên trước khi gửi.");
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(registrationDate)) {
        throw new Error("Ngày trực không hợp lệ. Hãy tải lại trang và chọn ngày trực.");
      }
      if (registrationRole !== "Cộng tác viên" && registrationRole !== "Quản ca") {
        throw new Error("Vai trò đăng ký không hợp lệ. Hãy tải lại trang và chọn lại vai trò.");
      }
      if (!Array.isArray(data.caTruc) || data.caTruc.length === 0) {
        throw new Error("Cần chọn ít nhất một ca trực.");
      }
      var allowedShifts = ["Ca 1", "Ca 2", "Ca 3", "Ca 4"];
      if (data.caTruc.some(function (shift) {
        return allowedShifts.indexOf(shift) < 0;
      })) {
        throw new Error("Ca trực gửi lên không hợp lệ. Hãy tải lại trang và chọn lại ca.");
      }
      registrationSheet.appendRow([
        registrationName,
        registrationDate,
        data.caTruc.join(", "),
        registrationRole,
        new Date(),
      ]);
      result = { result: "success" };
    } else if (data.action === "diemDanh") {
      var attendanceSheet = spreadsheet.getSheetByName("NHẬT KÝ CA");
      if (!attendanceSheet) {
        throw new Error('Không tìm thấy trang tính "NHẬT KÝ CA".');
      }
      if (!Array.isArray(data.caTruc) || data.caTruc.length === 0) {
        throw new Error("Cần chọn ít nhất một ca trực.");
      }
      var days = [
        "Chủ Nhật",
        "Thứ 2",
        "Thứ 3",
        "Thứ 4",
        "Thứ 5",
        "Thứ 6",
        "Thứ 7",
      ];
      var date = new Date(data.ngayTruc + "T00:00:00");
      var weekday = days[date.getDay()];
      data.caTruc.forEach(function (shift) {
        attendanceSheet.appendRow([
          data.hoTen,
          data.team,
          data.ngayTruc,
          shift,
          weekday,
          new Date(),
          "Điểm danh",
          "",
        ]);
      });
      result = { result: "success" };
    } else if (data.action === "quanCa") {
      result = finalizeQuanCa(data);
    } else {
      throw new Error("Thao tác không được hỗ trợ.");
    }

    savePostStatus(requestId, { result: "success", response: result });
    return jsonOutput(result);
  } catch (error) {
    savePostStatus(requestId, { error: error.message || String(error) });
    throw error;
  }
}

function getPostStatus(requestId) {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(String(requestId || ""))) {
    throw new Error("Mã yêu cầu không hợp lệ.");
  }
  var value = CacheService.getScriptCache().get("postStatus_" + requestId);
  return value ? JSON.parse(value) : { pending: true };
}

function savePostStatus(requestId, status) {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(String(requestId || ""))) return;
  CacheService.getScriptCache().put(
    "postStatus_" + requestId,
    JSON.stringify(status),
    300,
  );
}

function jsonOutput(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function apiOutput(value, callback) {
  if (callback) {
    return ContentService.createTextOutput(
      callback + "(" + JSON.stringify(value) + ");",
    ).setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return jsonOutput(value);
}

function getQuanCaDraftSheet() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName("DANH SÁCH QUẢN CA");
  if (!sheet) {
    sheet = spreadsheet.insertSheet("DANH SÁCH QUẢN CA");
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "ID",
      "Họ tên",
      "Team",
      "Mặt hàng",
      "Số lượng xuất",
      "Số lượng trả",
      "Trạng thái",
      "Cập nhật lúc",
    ]);
  }
  return sheet;
}

function getQuanCaProductPrices() {
  return getProductCatalog().reduce(function (prices, product) {
    if (product.price !== null) prices[product.name] = product.price;
    return prices;
  }, {});
}

function getProductCatalog() {
  var priceUnitMultiplier = 1000;
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
    "CÁC MẶT HÀNG GÂY QUỸ",
  );
  if (!sheet)
    throw new Error('Không tìm thấy trang tính "CÁC MẶT HÀNG GÂY QUỸ".');

  var range = sheet.getDataRange();
  var values = range.getValues();
  var displayValues = range.getDisplayValues();
  var formulas = range.getFormulas();
  var richTextValues = range.getRichTextValues();
  var headerRow = -1;
  var nameColumn = -1;
  var priceColumn = -1;
  var imageColumn = -1;
  var noteColumn = -1;

  for (var rowIndex = 0; rowIndex < Math.min(values.length, 20); rowIndex++) {
    var headers = displayValues[rowIndex].map(normalizeProductHeader);
    var candidateName = headers.findIndex(function (header) {
      return (
        header.indexOf("ten mat hang") >= 0 ||
        header.indexOf("ten san pham") >= 0
      );
    });
    var candidatePrice = headers.findIndex(function (header) {
      return header.indexOf("gia ban") >= 0;
    });
    if (candidateName < 0 || candidatePrice < 0) continue;

    headerRow = rowIndex;
    nameColumn = candidateName;
    priceColumn = candidatePrice;
    imageColumn = headers.findIndex(function (header) {
      return (
        header.indexOf("hinh anh") >= 0 ||
        header === "anh" ||
        header.indexOf("image") >= 0
      );
    });
    noteColumn = headers.findIndex(function (header) {
      return header.indexOf("ghi chu") >= 0 || header.indexOf("mo ta") >= 0;
    });
    break;
  }

  if (headerRow < 0) {
    throw new Error(
      'Không tìm thấy hàng tiêu đề có cột "Tên mặt hàng" và "Giá bán" trong trang tính "CÁC MẶT HÀNG GÂY QUỸ".',
    );
  }
  if (imageColumn < 0 && values[0].length >= 7) imageColumn = 6;

  var anchoredImages = getAnchoredProductImages(sheet, imageColumn);
  var imageUrlColumn = values[0].length >= 7 ? 6 : imageColumn;
  var products = [];
  var productsByName = Object.create(null);
  var currentProduct = null;

  for (
    var productRow = headerRow + 1;
    productRow < values.length;
    productRow++
  ) {
    var name = String(displayValues[productRow][nameColumn] || "").trim();
    var imageUrl = "";
    var imageValue = imageColumn >= 0 ? values[productRow][imageColumn] : "";
    var imageFormula =
      imageColumn >= 0 ? formulas[productRow][imageColumn] : "";
    var imageRichText =
      imageColumn >= 0 ? richTextValues[productRow][imageColumn] : null;
    var imageUrlFromG =
      imageUrlColumn >= 0
        ? extractProductImage(
            values[productRow][imageUrlColumn],
            formulas[productRow][imageUrlColumn],
            richTextValues[productRow][imageUrlColumn],
          )
        : "";

    if (imageColumn >= 0) {
      imageUrl =
        extractProductImage(imageValue, imageFormula, imageRichText) ||
        anchoredImages[productRow + 1] ||
        extractProductImage(displayValues[productRow][imageColumn], "") ||
        imageUrlFromG;
    } else {
      imageUrl = imageUrlFromG;
    }

    if (name) {
      var productKey = normalizeProductHeader(name);
      currentProduct = productsByName[productKey];
      if (!currentProduct) {
        currentProduct = {
          name: name,
          price: null,
          image: "",
          images: [],
          imageUnavailable: false,
          note: "",
        };
        productsByName[productKey] = currentProduct;
        products.push(currentProduct);
      }

      var rawPrice = values[productRow][priceColumn];
      if (rawPrice !== "" && rawPrice !== null) {
        var price =
          typeof rawPrice === "number"
            ? rawPrice
            : parseProductPrice(displayValues[productRow][priceColumn]);
        if (price !== null && (!isFinite(price) || price < 0)) {
          throw new Error('Giá bán không hợp lệ cho mặt hàng "' + name + '".');
        }
        if (price !== null && currentProduct.price === null) {
          currentProduct.price = price * priceUnitMultiplier;
        }
      }

      if (noteColumn >= 0) {
        currentProduct.note =
          String(displayValues[productRow][noteColumn] || "").trim() ||
          currentProduct.note;
      }
    } else if (!currentProduct) {
      continue;
    }

    if (imageUrl && currentProduct.images.indexOf(imageUrl) < 0) {
      currentProduct.images.push(imageUrl);
    } else if (isCellImageValue(imageValue) && !imageUrl) {
      currentProduct.imageUnavailable = true;
    }
  }

  products.forEach(function (product) {
    product.image = product.images.length ? product.images[0] : "";
  });
  return products;
}

function normalizeProductHeader(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseProductPrice(value) {
  var normalized = String(value || "").replace(/[^\d-]/g, "");
  return normalized ? Number(normalized) : null;
}

function isCellImageValue(value) {
  return (
    value &&
    typeof value === "object" &&
    value.valueType === SpreadsheetApp.ValueType.IMAGE
  );
}

function extractProductImage(value, formula, richTextValue) {
  if (isCellImageValue(value)) {
    try {
      var contentUrl = value.getContentUrl();
      if (contentUrl) return contentUrl;
    } catch (error) {
      try {
        var sourceUrl = value.getUrl();
        if (sourceUrl) return sourceUrl;
      } catch (fallbackError) {
        // Continue with the cell link or formula.
      }
    }
  }

  if (richTextValue) {
    var link = richTextValue.getLinkUrl();
    if (link) return extractProductImage(link, "");
    var runs = richTextValue.getRuns();
    for (var runIndex = 0; runIndex < runs.length; runIndex++) {
      link = runs[runIndex].getLinkUrl();
      if (link) return extractProductImage(link, "");
    }
  }

  var image = String(value || "").trim();
  var match = String(formula || "").match(/=IMAGE\(\s*["']([^"']+)["']/i);
  if (!match)
    match = String(formula || "").match(/=HYPERLINK\(\s*["']([^"']+)["']/i);
  if (match) image = match[1];
  if (!image) return "";

  var driveId =
    image.match(/\/d\/([A-Za-z0-9_-]+)/) ||
    image.match(/[?&]id=([A-Za-z0-9_-]+)/);
  if (driveId) return driveId[1];
  if (/^[A-Za-z0-9_-]{20,}$/.test(image)) return image;
  return /^https?:\/\//i.test(image) ? image : "";
}

function getAnchoredProductImages(sheet, imageColumn) {
  var imagesByRow = {};
  if (imageColumn < 0) return imagesByRow;

  sheet.getImages().forEach(function (image) {
    var anchor = image.getAnchorCell();
    if (anchor.getColumn() !== imageColumn + 1) return;
    var url = image.getUrl();
    if (url) imagesByRow[anchor.getRow()] = extractProductImage(url, "") || url;
  });
  return imagesByRow;
}

function listQuanCaDrafts() {
  var sheet = getQuanCaDraftSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  return sheet
    .getRange(2, 1, lastRow - 1, 8)
    .getValues()
    .filter(function (row) {
      return row[0] !== "";
    })
    .map(function (row) {
      return {
        id: String(row[0]),
        hoTen: String(row[1] || ""),
        team: String(row[2] || ""),
        matHang: String(row[3] || ""),
        xuat: row[4] === "" ? "" : String(row[4]),
        traLai: row[5] === "" ? "" : String(row[5]),
        trangThai: String(row[6] || "Chưa CK"),
        savedAt:
          row[7] instanceof Date ? row[7].toISOString() : String(row[7] || ""),
      };
    });
}

function saveQuanCaDraft(draft) {
  validateQuanCaDraft(draft, false);

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = getQuanCaDraftSheet();
    var lastRow = sheet.getLastRow();
    var rows =
      lastRow >= 2 ? sheet.getRange(2, 1, lastRow - 1, 8).getValues() : [];
    var draftId = draft.id ? String(draft.id) : Utilities.getUuid();
    var matchingIndex = rows.findIndex(function (row) {
      return String(row[0]) === draftId;
    });
    var values = [
      draftId,
      String(draft.hoTen).trim(),
      String(draft.team).trim(),
      String(draft.matHang).trim(),
      Number(draft.xuat),
      draft.traLai === "" || draft.traLai === null ? "" : Number(draft.traLai),
      String(draft.trangThai || "Chưa CK"),
      new Date(),
    ];

    if (matchingIndex >= 0) {
      sheet
        .getRange(matchingIndex + 2, 1, 1, values.length)
        .setValues([values]);
    } else {
      sheet.appendRow(values);
    }
    return { result: "success", id: draftId };
  } finally {
    lock.releaseLock();
  }
}

function deleteQuanCaDraft(draftId) {
  if (!draftId) throw new Error("Thiếu mã bản nháp cần xóa.");

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = getQuanCaDraftSheet();
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) throw new Error("Không tìm thấy bản nháp.");
    var ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
    var matchingIndex = ids.findIndex(function (row) {
      return row[0] === String(draftId);
    });
    if (matchingIndex < 0) throw new Error("Không tìm thấy bản nháp cần xóa.");

    sheet.deleteRow(matchingIndex + 2);
    return { result: "success" };
  } finally {
    lock.releaseLock();
  }
}

function finalizeQuanCa(data) {
  validateQuanCaDraft(data, true);

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var journalSheet = spreadsheet.getSheetByName("NHẬT KÝ CA");
    if (!journalSheet)
      throw new Error('Không tìm thấy trang tính "NHẬT KÝ CA".');
    if (data.id && !hasQuanCaDraftWithoutLock(data.id)) {
      throw new Error("Bản nháp này không còn tồn tại hoặc đã được hoàn tất.");
    }

    var normalizedName = String(data.matHang).trim().toLocaleLowerCase();
    var prices = getQuanCaProductPrices();
    var productName = Object.keys(prices).find(function (name) {
      return name.toLocaleLowerCase() === normalizedName;
    });
    if (
      !productName ||
      !isFinite(Number(prices[productName])) ||
      Number(prices[productName]) < 0
    ) {
      throw new Error(
        'Chưa khai báo đơn giá cho mặt hàng "' + data.matHang + '".',
      );
    }

    var remainingQuantity = Number(data.xuat) - Number(data.traLai);
    var amount = remainingQuantity * Number(prices[productName]);
    var date = new Date();
    var days = [
      "Chủ Nhật",
      "Thứ 2",
      "Thứ 3",
      "Thứ 4",
      "Thứ 5",
      "Thứ 6",
      "Thứ 7",
    ];
    var today = Utilities.formatDate(
      date,
      Session.getScriptTimeZone(),
      "yyyy-MM-dd",
    );
    var details =
      "Mặt hàng: " +
      data.matHang +
      " | Xuất: " +
      data.xuat +
      " | Trả: " +
      data.traLai +
      " | Còn lại: " +
      remainingQuantity +
      " | Tiền: " +
      amount +
      " | Trạng thái: " +
      data.trangThai;

    journalSheet.appendRow([
      data.hoTen,
      data.team,
      today,
      "N/A",
      days[date.getDay()],
      date,
      "Quản ca",
      details,
    ]);

    if (data.id) {
      deleteQuanCaDraftWithoutLock(data.id);
    }
    return { result: "success", thanhTien: amount };
  } finally {
    lock.releaseLock();
  }
}

function deleteQuanCaDraftWithoutLock(draftId) {
  var matchingRow = findQuanCaDraftRowWithoutLock(draftId);
  if (matchingRow > 0) getQuanCaDraftSheet().deleteRow(matchingRow);
}

function hasQuanCaDraftWithoutLock(draftId) {
  return findQuanCaDraftRowWithoutLock(draftId) > 0;
}

function findQuanCaDraftRowWithoutLock(draftId) {
  var sheet = getQuanCaDraftSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  var ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
  var matchingIndex = ids.findIndex(function (row) {
    return row[0] === String(draftId);
  });
  return matchingIndex >= 0 ? matchingIndex + 2 : 0;
}

function validateQuanCaDraft(data, isFinal) {
  if (!data || !String(data.hoTen || "").trim())
    throw new Error("Vui lòng nhập họ tên người nhận hàng.");
  if (!String(data.team || "").trim()) throw new Error("Vui lòng nhập team.");
  if (!String(data.matHang || "").trim())
    throw new Error("Vui lòng nhập tên mặt hàng.");
  if (
    data.xuat === "" ||
    data.xuat === null ||
    !isFinite(Number(data.xuat)) ||
    Number(data.xuat) < 0
  ) {
    throw new Error("Số lượng xuất không hợp lệ.");
  }

  if (
    isFinal &&
    (data.traLai === "" ||
      data.traLai === null ||
      !isFinite(Number(data.traLai)) ||
      Number(data.traLai) < 0)
  ) {
    throw new Error("Số lượng trả lại không hợp lệ.");
  }
  if (
    data.traLai !== "" &&
    data.traLai !== null &&
    (!isFinite(Number(data.traLai)) ||
      Number(data.traLai) < 0 ||
      Number(data.traLai) > Number(data.xuat))
  ) {
    throw new Error("Số lượng trả lại phải từ 0 đến số lượng đã xuất.");
  }
}
