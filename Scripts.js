        // DÁN WEB APP URL ĐÃ DEPLOY TỪ GOOGLE APPS SCRIPT VÀO ĐÂY
        const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyPk6PYT4WS9CMXcw6xM7F3Z-jT6gY7C2JUTykZSewgOT1k-E94uqzBSQC5YQ-Rnu7H/exec";
        let currentQuanCaDraftId = null;

        // Danh mục sản phẩm và giá được tải từ Google Sheets.
        let PRODUCT_PRICES = {};

document.getElementById('ddNgay').valueAsDate = new Date();

        const productContainer = document.getElementById('productContainer');
        productContainer.textContent = 'Đang tải danh sách mặt hàng...';

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    const activeButton = document.querySelector(`.nav-btn[data-tab="${tabId}"]`);
    if (activeButton) activeButton.classList.add('active');
}

function getQuanCaDraft() {
    return {
        hoTen: document.getElementById('qcHoTen').value,
        team: document.getElementById('qcTeam').value,
        matHang: document.getElementById('qcMatHang').value,
        xuat: document.getElementById('qcXuat').value,
        traLai: document.getElementById('qcTra').value,
        trangThai: document.getElementById('qcTrangThai').value,
        savedAt: new Date().toISOString()
    };
}

function apiGet(action, params = {}) {
    return new Promise((resolve, reject) => {
        const callbackName = `jsonp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const script = document.createElement('script');
        const url = new URL(SCRIPT_URL);
        url.searchParams.set('action', action);
        url.searchParams.set('callback', callbackName);
        Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

        const cleanup = () => {
            delete window[callbackName];
            script.remove();
            clearTimeout(timeoutId);
        };
        const timeoutId = setTimeout(() => {
            cleanup();
            reject(new Error('Hết thời gian chờ Apps Script. Kiểm tra URL triển khai và quyền truy cập.'));
        }, 15000);

        window[callbackName] = data => {
            cleanup();
            if (data && data.error) {
                reject(new Error(data.error));
                return;
            }
            resolve(data);
        };
        script.onerror = () => {
            cleanup();
            reject(new Error('Không gọi được Apps Script. Kiểm tra URL triển khai và quyền truy cập.'));
        };
        script.src = url.toString();
        document.head.appendChild(script);
    });
}

function renderProductCatalog(products) {
    productContainer.replaceChildren();
    const productOptions = document.getElementById('productNameOptions');
    if (productOptions) productOptions.replaceChildren();
    const unavailableImageNames = [];

    if (!Array.isArray(products) || products.length === 0) {
        productContainer.textContent = 'Chưa có mặt hàng nào trong danh sách.';
        return;
    }

    products.forEach(product => {
        const card = document.createElement('article');
        card.className = 'product-card';
        const images = Array.isArray(product.images) && product.images.length
            ? product.images
            : (product.image ? [product.image] : []);

        if (images.length > 0) {
            const gallery = document.createElement('div');
            gallery.className = 'product-gallery';
            const mainImage = document.createElement('img');
            mainImage.className = 'product-image';
            mainImage.alt = `${product.name} - ảnh 1`;
            mainImage.loading = 'lazy';
            const toImageUrl = source => /^https?:\/\//i.test(source)
                ? source
                : `https://drive.google.com/thumbnail?id=${encodeURIComponent(source)}&sz=w600`;
            mainImage.src = toImageUrl(images[0]);
            mainImage.addEventListener('error', () => {
                const placeholder = document.createElement('div');
                placeholder.className = 'product-img-placeholder';
                placeholder.setAttribute('aria-hidden', 'true');
                placeholder.textContent = 'Xuân 2027';
                mainImage.replaceWith(placeholder);
            }, { once: true });
            gallery.appendChild(mainImage);

            if (images.length > 1) {
                const thumbnails = document.createElement('div');
                thumbnails.className = 'product-thumbnails';
                images.forEach((source, index) => {
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'product-thumbnail';
                    button.setAttribute('aria-label', `Xem ảnh ${index + 1} của ${product.name}`);
                    button.setAttribute('aria-pressed', String(index === 0));
                    if (index === 0) button.classList.add('active');

                    const thumbnail = document.createElement('img');
                    thumbnail.src = toImageUrl(source);
                    thumbnail.alt = '';
                    thumbnail.loading = 'lazy';
                    button.appendChild(thumbnail);
                    button.addEventListener('click', () => {
                        mainImage.src = toImageUrl(source);
                        mainImage.alt = `${product.name} - ảnh ${index + 1}`;
                        thumbnails.querySelectorAll('.product-thumbnail').forEach(item => {
                            const selected = item === button;
                            item.classList.toggle('active', selected);
                            item.setAttribute('aria-pressed', String(selected));
                        });
                    });
                    thumbnails.appendChild(button);
                });
                gallery.appendChild(thumbnails);
            }
            card.appendChild(gallery);
        } else {
            const placeholder = document.createElement('div');
            placeholder.className = 'product-img-placeholder';
            placeholder.setAttribute('aria-hidden', 'true');
            placeholder.textContent = 'Xuân 2027';
            card.appendChild(placeholder);
            if (product.imageUnavailable) unavailableImageNames.push(product.name);
        }

        const title = document.createElement('h4');
        title.textContent = product.name;
        const price = document.createElement('p');
        price.textContent = product.price === null
            ? (product.note || 'Liên hệ để biết giá')
            : `${Number(product.price).toLocaleString('vi-VN')} VNĐ`;
        card.append(title, price);
        if (product.note && product.price !== null) {
            const note = document.createElement('p');
            note.className = 'product-note';
            note.textContent = product.note;
            card.appendChild(note);
        }
        productContainer.appendChild(card);

        if (productOptions) {
            const option = document.createElement('option');
            option.value = product.name;
            productOptions.appendChild(option);
        }
    });

    if (unavailableImageNames.length > 0) {
        const warning = document.createElement('p');
        warning.className = 'form-status';
        warning.dataset.state = 'error';
        warning.textContent = `Không đọc được ảnh trong Sheet cho: ${unavailableImageNames.join(', ')}. Hãy lưu URL ảnh vào cột hình ảnh hoặc dùng =IMAGE("URL").`;
        productContainer.prepend(warning);
    }
}

function apiPost(payload) {
    const requestId = window.crypto && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    return fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ ...payload, requestId }),
        signal: controller.signal
    })
        .then(async () => {
            for (let attempt = 0; attempt < 15; attempt++) {
                const status = await apiGet('getPostStatus', { requestId });
                if (status.error) throw new Error(status.error);
                if (!status.pending) return status.response;
                await wait(700);
            }
            throw new Error('Đã gửi yêu cầu nhưng chưa nhận được trạng thái từ Apps Script. Hãy tải lại danh sách trước khi gửi lại.');
        })
        .catch(error => {
            if (error.name === 'AbortError') {
                throw new Error('Hết thời gian chờ gửi dữ liệu. Kiểm tra kết nối và Danh sách quản ca trước khi gửi lại.');
            }
            throw error;
        })
        .finally(() => clearTimeout(timeoutId));
}

function wait(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function saveDraftAndConfirm(draft) {
    await apiPost({ action: 'saveQuanCaDraft', draft });
    for (let attempt = 0; attempt < 5; attempt++) {
        const drafts = await apiGet('listQuanCaDrafts');
        const savedDraft = drafts.find(item => item.id === draft.id);
        if (savedDraft && savedDraft.hoTen === draft.hoTen &&
            savedDraft.team === draft.team && savedDraft.matHang === draft.matHang &&
            String(savedDraft.xuat) === String(draft.xuat) &&
            String(savedDraft.traLai) === String(draft.traLai)) {
            return savedDraft;
        }
        await wait(400);
    }
    throw new Error('Không xác nhận được bản nháp trong Google Sheets. Hãy tải lại danh sách và kiểm tra kết nối.');
}

function renderQuanCaDrafts(drafts) {
    const container = document.getElementById('quanCaDraftList');
    container.replaceChildren();

    if (drafts.length === 0) {
        const emptyMessage = document.createElement('p');
        emptyMessage.className = 'form-status';
        emptyMessage.textContent = 'Chưa có bản ghi nào. Bấm “Thêm bản ghi mới” để bắt đầu.';
        container.appendChild(emptyMessage);
        return;
    }

    drafts
        .slice()
        .sort((a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0))
        .forEach(draft => {
            const card = document.createElement('article');
            card.className = 'manager-draft-card';

            const details = document.createElement('div');
            const title = document.createElement('h3');
            title.textContent = draft.hoTen || 'Chưa nhập tên người nhận';
            const summary = document.createElement('p');
            summary.textContent = `Team: ${draft.team || 'Chưa nhập'} · Mặt hàng: ${draft.matHang || 'Chưa nhập'}`;
            const quantities = document.createElement('p');
            quantities.textContent = `Xuất: ${draft.xuat || '—'} · Trả: ${draft.traLai || 'Chưa cập nhật'} · Còn lại: ${draft.xuat && draft.traLai !== '' ? Math.max(0, Number(draft.xuat) - Number(draft.traLai)) : '—'}`;
            const savedTime = document.createElement('p');
            savedTime.textContent = draft.savedAt
                ? `Lưu lần cuối: ${new Date(draft.savedAt).toLocaleString('vi-VN')}`
                : 'Bản nháp';
            details.append(title, summary, quantities, savedTime);

            const actions = document.createElement('div');
            actions.className = 'manager-draft-actions';
            const editButton = document.createElement('button');
            editButton.type = 'button';
            editButton.textContent = 'Mở / cập nhật';
            editButton.addEventListener('click', () => openQuanCaDraft(draft.id));
            const deleteButton = document.createElement('button');
            deleteButton.type = 'button';
            deleteButton.textContent = 'Xóa';
            deleteButton.addEventListener('click', () => deleteQuanCaDraft(draft.id));
            actions.append(editButton, deleteButton);
            card.append(details, actions);
            container.appendChild(card);
        });
}

function openQuanCaDraft(draftId) {
    apiGet('listQuanCaDrafts')
        .then(drafts => {
            const draft = drafts.find(item => item.id === draftId);
            if (!draft) {
                showQuanCaStatus('Không tìm thấy bản ghi quản ca này.', 'error');
                return;
            }

            currentQuanCaDraftId = draft.id;
            document.getElementById('qcHoTen').value = draft.hoTen || '';
            document.getElementById('qcTeam').value = draft.team || '';
            document.getElementById('qcMatHang').value = draft.matHang || '';
            document.getElementById('qcXuat').value = draft.xuat || '';
            document.getElementById('qcTra').value = draft.traLai || '';
            document.getElementById('qcTrangThai').value = draft.trangThai || 'Chưa CK';
            capNhatThanhTienQuanCa();
            showQuanCaStatus('Đang cập nhật bản ghi đã lưu. Bấm “Lưu tạm” để cập nhật bản nháp hoặc lưu cuối ca.', 'success');
            switchTab('diem-danh');
            document.getElementById('formQuanCa').scrollIntoView({ behavior: 'smooth', block: 'start' });
        })
        .catch(error => showQuanCaStatus(`Không thể mở bản ghi: ${error.message}`, 'error'));
}

function deleteQuanCaDraft(draftId) {
    if (!window.confirm('Bạn có chắc muốn xóa bản ghi quản ca này?')) return;
    apiPost({ action: 'deleteQuanCaDraft', id: draftId })
        .then(() => apiGet('listQuanCaDrafts'))
        .then(drafts => {
            if (drafts.some(draft => draft.id === draftId)) {
                throw new Error('Bản ghi vẫn còn trong danh sách.');
            }
            if (currentQuanCaDraftId === draftId) currentQuanCaDraftId = null;
            showQuanCaStatus('Đã xóa bản ghi quản ca.', 'success');
            restoreQuanCaDraft();
        })
        .catch(error => showQuanCaStatus(`Không thể xóa bản ghi: ${error.message}`, 'error'));
}

function taoBanGhiQuanCaMoi() {
    currentQuanCaDraftId = null;
    document.getElementById('formQuanCa').reset();
    document.getElementById('qcConLai').value = '';
    document.getElementById('qcTien').value = '';
    document.getElementById('qcTienHint').textContent = 'Thành tiền = (số lượng xuất − số lượng trả) × đơn giá mặt hàng.';
    showQuanCaStatus('Đang tạo bản ghi quản ca mới.', 'success');
    switchTab('diem-danh');
    document.getElementById('formQuanCa').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function showQuanCaStatus(message, state) {
    const status = document.getElementById('qcDraftStatus');
    status.textContent = message;
    status.dataset.state = state || '';
}

function capNhatThanhTienQuanCa() {
    const tenMatHang = document.getElementById('qcMatHang').value.trim();
    const soLuongXuat = Number(document.getElementById('qcXuat').value);
    const traLaiInput = document.getElementById('qcTra').value;
    const soLuongTra = Number(traLaiInput);
    const remainingInput = document.getElementById('qcConLai');
    const amountInput = document.getElementById('qcTien');
    const amountHint = document.getElementById('qcTienHint');
    const normalizedName = tenMatHang.toLocaleLowerCase('vi');
    const matchedName = Object.keys(PRODUCT_PRICES).find(
        name => name.toLocaleLowerCase('vi') === normalizedName
    );

    amountInput.value = '';
    remainingInput.value = '';
    if (!tenMatHang || !document.getElementById('qcXuat').value || !traLaiInput) {
        amountHint.textContent = 'Thành tiền = (số lượng xuất − số lượng trả) × đơn giá mặt hàng.';
        return null;
    }

    if (soLuongTra > soLuongXuat) {
        amountHint.textContent = 'Số lượng trả không thể lớn hơn số lượng xuất.';
        return null;
    }

    const soLuongConLai = soLuongXuat - soLuongTra;
    remainingInput.value = String(soLuongConLai);
    if (!matchedName || !Number.isFinite(PRODUCT_PRICES[matchedName]) || PRODUCT_PRICES[matchedName] < 0) {
        amountHint.textContent = `Chưa khai báo đơn giá cho "${tenMatHang}" trong PRODUCT_PRICES.`;
        return null;
    }

    const thanhTien = soLuongConLai * PRODUCT_PRICES[matchedName];
    amountInput.value = String(thanhTien);
    amountHint.textContent = `${soLuongConLai} còn lại × ${PRODUCT_PRICES[matchedName].toLocaleString('vi-VN')} VNĐ = ${thanhTien.toLocaleString('vi-VN')} VNĐ.`;
    return { soLuongConLai, thanhTien };
}

function saveQuanCaDraft() {
    const draftData = { ...getQuanCaDraft(), id: currentQuanCaDraftId };
    if (!draftData.hoTen.trim() || !draftData.team.trim() || !draftData.matHang.trim() || !draftData.xuat) {
        showQuanCaStatus('Vui lòng nhập tên người nhận, team, mặt hàng và số lượng xuất trước khi lưu tạm.', 'error');
        return;
    }

    showQuanCaStatus('Đang lưu bản nháp lên Google Sheets...', '');
    draftData.id = currentQuanCaDraftId || (window.crypto && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    saveDraftAndConfirm(draftData)
        .then(savedDraft => {
            currentQuanCaDraftId = savedDraft.id;
            showQuanCaStatus('Đã lưu bản ghi dùng chung trong Danh sách quản ca.', 'success');
            restoreQuanCaDraft();
        })
        .catch(error => showQuanCaStatus(`Không thể lưu bản nháp: ${error.message}`, 'error'));
}

function restoreQuanCaDraft() {
    const container = document.getElementById('quanCaDraftList');
    container.textContent = 'Đang tải danh sách quản ca...';
    apiGet('listQuanCaDrafts')
    .then(renderQuanCaDrafts)
    .catch(error => {
        container.textContent = `Không thể tải danh sách quản ca: ${error.message}`;
    });
}

document.getElementById('btnLuuTam').addEventListener('click', saveQuanCaDraft);
['qcMatHang', 'qcXuat', 'qcTra'].forEach(id => {
    document.getElementById(id).addEventListener('input', capNhatThanhTienQuanCa);
});
restoreQuanCaDraft();
apiGet('getProducts')
    .then(products => {
        PRODUCT_PRICES = products.reduce((prices, product) => {
            if (product.price !== null) prices[product.name] = Number(product.price);
            return prices;
        }, {});
        renderProductCatalog(products);
        capNhatThanhTienQuanCa();
    })
    .catch(error => {
        productContainer.textContent = `Không thể tải danh sách mặt hàng: ${error.message}`;
        showQuanCaStatus(`Không thể tải bảng giá: ${error.message}`, 'error');
    });

function submitForm(e, actionType) {
    e.preventDefault();
    
    let payload = { action: actionType };

    if (actionType === 'dangKyCa') {
        const caSelected = Array.from(document.querySelectorAll('input[name="dkCa"]:checked')).map(cb => cb.value);
        if(caSelected.length === 0) { alert("Vui lòng chọn ít nhất 1 ca trực!"); return; }
        const hoTen = document.getElementById('dkHoTen').value.trim();
        const ngayTruc = document.getElementById('dkNgay').value;
        if (!hoTen || !ngayTruc) {
            alert("Vui lòng nhập họ tên và chọn ngày trực.");
            return;
        }

        payload.hoTen = hoTen;
        payload.ngayTruc = ngayTruc;
        payload.caTruc = caSelected;
        payload.vaiTro = document.getElementById('dkVaiTro').value;
    }

    if (actionType === 'diemDanh') {
        const caSelected = Array.from(document.querySelectorAll('input[name="ddCa"]:checked')).map(cb => cb.value);
        if(caSelected.length === 0) { alert("Vui lòng chọn ít nhất 1 ca trực!"); return; }
        
        payload.hoTen = document.getElementById('ddHoTen').value;
        payload.team = document.getElementById('ddTeam').value;
        payload.ngayTruc = document.getElementById('ddNgay').value;
        payload.caTruc = caSelected;
    }

    if (actionType === 'quanCa') {
        const quanCaAmount = capNhatThanhTienQuanCa();
        if (!document.getElementById('qcTra').value) {
            alert("Vui lòng nhập số lượng trả trước khi lưu nhật ký cuối ca. Nếu chưa biết, hãy chọn Lưu tạm.");
            return;
        }
        if (Number(document.getElementById('qcTra').value) > Number(document.getElementById('qcXuat').value)) {
            alert("Số lượng trả lại không thể lớn hơn số lượng đã xuất.");
            return;
        }
        if (!quanCaAmount) {
            alert("Chưa thể tính thành tiền. Vui lòng kiểm tra số lượng và khai báo đơn giá mặt hàng trong PRODUCT_PRICES.");
            return;
        }

        payload.hoTen = document.getElementById('qcHoTen').value;
        payload.team = document.getElementById('qcTeam').value;
        payload.matHang = document.getElementById('qcMatHang').value;
        payload.xuat = document.getElementById('qcXuat').value;
        payload.traLai = document.getElementById('qcTra').value;
        payload.thanhTien = quanCaAmount.thanhTien;
        payload.trangThai = document.getElementById('qcTrangThai').value;
        payload.id = currentQuanCaDraftId;

        showQuanCaStatus('Đang lưu nhật ký cuối ca lên Google Sheets...', '');
        const finalizeDraft = async () => {
            if (!currentQuanCaDraftId) {
                payload.id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
                const savedDraft = await saveDraftAndConfirm({ ...getQuanCaDraft(), id: payload.id });
                currentQuanCaDraftId = savedDraft.id;
            }
            await apiPost(payload);
            return apiGet('listQuanCaDrafts');
        };
        finalizeDraft()
            .then(drafts => {
                if (drafts.some(draft => draft.id === currentQuanCaDraftId)) {
                    throw new Error('Nhật ký chưa được xác nhận. Bản nháp vẫn còn trong danh sách; hãy kiểm tra lại trước khi gửi lần nữa.');
                }
                e.target.reset();
                currentQuanCaDraftId = null;
                document.getElementById('qcConLai').value = '';
                document.getElementById('qcTien').value = '';
                document.getElementById('qcTienHint').textContent = 'Thành tiền = (số lượng xuất − số lượng trả) × đơn giá mặt hàng.';
                showQuanCaStatus('Đã lưu nhật ký cuối ca và xóa bản nháp tương ứng.', 'success');
                restoreQuanCaDraft();
            })
            .catch(error => showQuanCaStatus(`Không thể xác nhận nhật ký cuối ca: ${error.message}`, 'error'));
        return;
    }

    apiPost(payload)
    .then(() => {
        const message = actionType === 'dangKyCa'
            ? 'Đăng ký ca đã được ghi nhận trên Google Sheets.'
            : 'Điểm danh đã được ghi nhận trên Google Sheets.';
        alert(message);
        e.target.reset();
    })
    .catch(error => alert(`Chưa gửi được dữ liệu: ${error.message}`));
}
// Giờ công bố lịch trực hằng ngày.
const GIO_DANG_BAI = 21;
const PHUT_DANG_BAI = 0;

function kiemTraGioVaLoadLich() {
    const now = new Date();
    const currentHour = now.getHours();

    if (currentHour >= GIO_DANG_BAI) {
        taiDuLieuLichTrucTuSheet();
    } else {
        document.getElementById('scheduleView').innerHTML = `
            <div class="day-schedule">
                <h3 style="color: var(--primary-color); text-align:center;">
                    🕒 Lịch trực sẽ được công bố vào lúc ${GIO_DANG_BAI}h${PHUT_DANG_BAI === 0 ? '00' : PHUT_DANG_BAI} hằng ngày!
                </h3>
            </div>`;
    }
}

function taiDuLieuLichTrucTuSheet() {
    document.getElementById('scheduleView').innerHTML = '<p style="text-align:center;">⏳ Đang tải dữ liệu lịch trực từ Google Sheets...</p>';

    apiGet('getLichTruc')
        .then(data => {
            hienThiGiaoDienLichTruc(data);
        })
        .catch(error => {
            document.getElementById('scheduleView').textContent = `Không thể tải dữ liệu lịch trực: ${error.message}`;
        });
}

function hienThiGiaoDienLichTruc(rows) {
    const lichTheoNgay = {};

    rows.forEach(row => {
        const hoTen = row[0];
        const ngayTruc = row[1];
        const caTrucStr = row[2];
        const vaiTro = row[3];

        if (!hoTen || !ngayTruc) return;

        if (!lichTheoNgay[ngayTruc]) {
            lichTheoNgay[ngayTruc] = {
                ca1: { mems: [], manager: [] },
                ca2: { mems: [], manager: [] },
                ca3: { mems: [], manager: [] },
                ca4: { mems: [], manager: [] }
            };
        }

        const cacCa = caTrucStr.split(',').map(item => item.trim());
        cacCa.forEach(ca => {
            let caKey = null;
            if (ca.includes("Ca 1")) caKey = "ca1";
            if (ca.includes("Ca 2")) caKey = "ca2";
            if (ca.includes("Ca 3")) caKey = "ca3";
            if (ca.includes("Ca 4")) caKey = "ca4";

            if (caKey) {
                if (vaiTro === "Quản ca") {
                    lichTheoNgay[ngayTruc][caKey].manager.push(hoTen);
                } else {
                    lichTheoNgay[ngayTruc][caKey].mems.push(hoTen);
                }
            }
        });
    });

    let htmlOutput = "";
    const nameMap = { "ca1": "Ca 1 (7h30 - 9h30)", "ca2": "Ca 2 (9h30 - 11h30)", "ca3": "Ca 3 (13h30 - 15h30)", "ca4": "Ca 4 (15h30 - 17h30)" };

    for (let ngay in lichTheoNgay) {
        const ngayData = lichTheoNgay[ngay];
        let shiftsHtml = "";
        const managerInfo = [];

        ["ca1", "ca2", "ca3", "ca4"].forEach(key => {
            const ctvList = ngayData[key].mems.join(", ") || "Trống";
            const qlList = ngayData[key].manager.join(", ");

            shiftsHtml += `<div class="shift-block"><b>${nameMap[key]}:</b> ${ctvList}</div>`;

            if (qlList) {
                managerInfo.push(`<b>${key.toUpperCase()}:</b> ${qlList}`);
            }
        });

        const managerHtml = managerInfo.length > 0
            ? managerInfo.join(" | ")
            : "Chưa có Quản ca đăng ký";

        htmlOutput += `
            <div class="day-schedule">
                <h3>Ngày: ${ngay}</h3>
                ${shiftsHtml}
                <div class="manager-info">
                    Quản ca phụ trách: <br> ${managerHtml}
                </div>
            </div>`;
    }

    if (htmlOutput === "") htmlOutput = "<p>Chưa có dữ liệu lịch trực.</p>";
    document.getElementById('scheduleView').innerHTML = htmlOutput;
}

document.querySelector('.nav-btn[data-tab="lich-truc"]').addEventListener('click', kiemTraGioVaLoadLich);

setInterval(() => {
    const now = new Date();
    if (now.getHours() === GIO_DANG_BAI && now.getMinutes() === PHUT_DANG_BAI) {
        if (document.getElementById('lich-truc').classList.contains('active')) {
            taiDuLieuLichTrucTuSheet();
        }
    }
}, 60000);
