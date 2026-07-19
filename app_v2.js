// Supabase Configuration
const SUPABASE_URL = 'https://kijqcmumynutyhodxjwo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_3vIQeWE4irMp3ni9vSw7fg_2sgzjurY';

// Initialize Supabase Client safely so the UI can still load in restricted environments.
const supabaseClient = window.supabase && typeof window.supabase.createClient === 'function'
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;

function guardSupabaseAccess(targetBody, fallbackMessage = 'Unable to fetch data from the configured data source.') {
    if (supabaseClient) return false;

    if (targetBody) {
        targetBody.innerHTML = `
            <tr class="no-data-row">
                <td colspan="13" style="color: var(--color-maroon); font-weight: 600;">
                    ${fallbackMessage}
                </td>
            </tr>
        `;
    }

    showToast('Supabase is unavailable in this browser context. Serve the page over HTTP and retry.', 'error');
    return true;
}

// GP to SC (Sub Center) Mapping
const gpMapping = {
    'Freserganj': [
        'Amarabati', 'Bijoybati', 'Debnibas', 'Shibpur'
    ],
    'Moushuni': [
        'Bagdanga', 'Baliara New', 'Baliara Old', 'Kusumtala', 'Moushuni 1st Gheri'
    ],
    'Budhakhali': [
        'Bishalaxmipur', 'Budhakhali', 'Fatikpur', 'Rajnagar Srinathgram I', 'Rajnagar Srinathgram II'
    ],
    'Haripur': [
        'Dakshin Chandanpiri', 'Dakshin Chandranagar', 'Haripur', 'Maharajganj', 'Uttar Chandanpiri'
    ],
    'Shibrampur': [
        'Dakshin Durgapur', 'Dakshin Shibrampur', 'Patibunia', 'Radhanagar', 'Rajnagar', 'Uttar Shibrampur'
    ],
    'Namkhana': [
        'Debnagar', 'Dwariknagar', 'Namkhana I', 'Namkhana II', 'Shibnagar Abad I', 'Shibnagar Abad II'
    ],
    'Narayanpur': [
        'Ganeshnagar East', 'Ganeshnagar West', 'Iswaripur', 'Nandabhanga', 'Narayanpur Part', 'Narayanpur PHC SC'
    ]
};

// List of all 37 Sub Centers supposed to report
const default_units = [
    'Narayanpur PHC SC', 'Debnagar', 'Dakshin Chandanpiri', 'Patibunia',
    'Dakshin Durgapur', 'Debnibas', 'Shibpur', 'Bagdanga', 'Haripur',
    'Baliara New', 'Uttar Chandanpiri', 'Namkhana II', 'Namkhana I',
    'Bijoybati', 'Uttar Shibrampur', 'Moushuni 1st Gheri', 'Iswaripur',
    'Dwariknagar', 'Baliara Old', 'Shibnagar Abad II', 'Fatikpur',
    'Bishalaxmipur', 'Ganeshnagar West', 'Dakshin Shibrampur', 'Shibnagar Abad I',
    'Rajnagar Srinathgram I', 'Maharajganj', 'Amarabati', 'Rajnagar Srinathgram II',
    'Nandabhanga', 'Narayanpur Part', 'Dakshin Chandranagar', 'Budhakhali',
    'Ganeshnagar East', 'Radhanagar', 'Rajnagar', 'Kusumtala'
];

// State Management
let gpList = [];
let sortField = null; // 'gp' or 'count'
let sortDirection = 'asc'; // 'asc' or 'desc'
let searchTerm = '';

// EC Meeting Report State
let ecMeetingData = [];
let filteredEcData = [];
let currentDefaulters = []; // Store non-reporting facilities
let recordToDeleteId = null;
let currentView = 'dashboard';

// Delivery Coverage Report State
let deliveryData = [];
let filteredDeliveryData = [];
let currentDelDefaulters = [];
let deliveryRecordToDeleteId = null;

// WPD Report State
let wpdData = [];
let filteredWpdData = [];

// IDCF Report State (Google Sheet as Database)
const IDCF_SHEET_ID = '1UoB53GQLIRC_uTNczEsDqB8rWSmH6-pVSDWAiVC51IE';
// Set this URL after deploying the Apps Script (see idcf_apps_script.js for instructions)
let IDCF_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwtw-O0IjmFZq67-VbCTF-cWgHK1J1mRPhu6iuRdXZLIgVHW1qPu8FrDTRy3rXaqzXo/exec';
let idcfData = [];
let filteredIdcfData = [];
let currentIdcfDefaulters = [];
let idcfRecordToDeleteId = null;

// Vitamin A Report State
let vitaminAData = [];
let filteredVitaminAData = [];
let currentVitaminADefaulters = [];
let vitaminARecordToDeleteId = null;

// DOM Elements - Dashboard View
const tableBody = document.getElementById('tableBody');
const searchInput = document.getElementById('searchInput');
const statGps = document.getElementById('statGps');
const statScs = document.getElementById('statScs');

// DOM Elements - EC Report View
const filterYear = document.getElementById('filterYear');
const filterMonth = document.getElementById('filterMonth');
const filterDate = document.getElementById('filterDate');
const reportTableBody = document.getElementById('reportTableBody');

// DOM Elements - Delivery View
const filterDelYear = document.getElementById('filterDelYear');
const filterDelMonth = document.getElementById('filterDelMonth');
const deliveryTableBody = document.getElementById('deliveryTableBody');

// DOM Elements - WPD View
const filterWpdYear = document.getElementById('filterWpdYear');
const filterWpdMonth = document.getElementById('filterWpdMonth');
const filterWpdDate = document.getElementById('filterWpdDate');
const filterWpdFacility = document.getElementById('filterWpdFacility');
const wpdTableHead = document.getElementById('wpdTableHead');
const wpdTableBody = document.getElementById('wpdTableBody');

// DOM Elements - Modals & Forms
const editModal = document.getElementById('editModal');
const confirmModal = document.getElementById('confirmModal');
const editForm = document.getElementById('editForm');
const editDeliveryModal = document.getElementById('editDeliveryModal');
const confirmDeliveryModal = document.getElementById('confirmDeliveryModal');
const editDeliveryForm = document.getElementById('editDeliveryForm');
const defaultersDeliveryModal = document.getElementById('defaultersDeliveryModal');

// Initialize Application
function initDashboard() {
    // Convert mapping to list of objects
    gpList = Object.entries(gpMapping).map(([gp, scList]) => ({
        gp,
        scList: [...scList].sort(),
        count: scList.length
    }));

    // Calculate metrics
    const totalGps = gpList.length;
    const totalScs = gpList.reduce((sum, item) => sum + item.count, 0);

    // Display metrics
    if (statGps) statGps.textContent = totalGps;
    if (statScs) statScs.textContent = totalScs;

    renderTable();
}

// ----------------------------------------------------
// VIEW SWITCHING LOGIC (SPA)
// ----------------------------------------------------
window.switchView = function (viewName) {
    currentView = viewName;

    const navDashboard = document.getElementById('navDashboard');
    const navEcReport = document.getElementById('navEcReport');
    const navDelivery = document.getElementById('navDelivery');
    const navWpdReport = document.getElementById('navWpdReport');
    const navIdcf = document.getElementById('navIdcf');
    const navVitaminA = document.getElementById('navVitaminA');

    const dashboardView = document.getElementById('dashboardView');
    const ecReportView = document.getElementById('ecReportView');
    const deliveryView = document.getElementById('deliveryView');
    const wpdReportView = document.getElementById('wpdReportView');
    const idcfView = document.getElementById('idcfView');
    const vitaminAView = document.getElementById('vitaminAView');

    if (navDashboard) navDashboard.classList.remove('active');
    if (navEcReport) navEcReport.classList.remove('active');
    if (navDelivery) navDelivery.classList.remove('active');
    if (navWpdReport) navWpdReport.classList.remove('active');
    if (navIdcf) navIdcf.classList.remove('active');
    if (navVitaminA) navVitaminA.classList.remove('active');

    if (dashboardView) dashboardView.style.display = 'none';
    if (ecReportView) ecReportView.style.display = 'none';
    if (deliveryView) deliveryView.style.display = 'none';
    if (wpdReportView) wpdReportView.style.display = 'none';
    if (idcfView) idcfView.style.display = 'none';
    if (vitaminAView) vitaminAView.style.display = 'none';

    if (viewName === 'dashboard') {
        if (navDashboard) navDashboard.classList.add('active');
        if (dashboardView) dashboardView.style.display = 'block';
        renderTable();
    } else if (viewName === 'ec-report') {
        if (navEcReport) navEcReport.classList.add('active');
        if (ecReportView) ecReportView.style.display = 'block';
        if (ecMeetingData.length === 0) {
            fetchEcMeetingData();
        } else {
            drawReportTable();
        }
    } else if (viewName === 'delivery') {
        if (navDelivery) navDelivery.classList.add('active');
        if (deliveryView) deliveryView.style.display = 'block';
        if (deliveryData.length === 0) {
            fetchDeliveryData();
        } else {
            drawDeliveryTable();
        }
    } else if (viewName === 'wpd-report') {
        if (navWpdReport) navWpdReport.classList.add('active');
        if (wpdReportView) wpdReportView.style.display = 'block';
        if (wpdData.length === 0) {
            fetchWpdData();
        } else {
            applyWpdFilters();
        }
    } else if (viewName === 'idcf') {
        if (navIdcf) navIdcf.classList.add('active');
        if (idcfView) idcfView.style.display = 'block';
        if (idcfData.length === 0) {
            fetchIdcfData();
        } else {
            drawIdcfTable();
        }
    } else if (viewName === 'vitamin-a') {
        if (navVitaminA) navVitaminA.classList.add('active');
        if (vitaminAView) vitaminAView.style.display = 'block';
        if (vitaminAData.length === 0) {
            fetchVitaminAData();
        } else {
            drawVitaminATable();
        }
    }
}

// ----------------------------------------------------
// DASHBOARD VIEW LOGIC (GP wise SC Count)
// ----------------------------------------------------
function renderTable() {
    let displayList = [...gpList];

    // Filter logic
    if (searchTerm.trim() !== '') {
        const query = searchTerm.toLowerCase();
        displayList = displayList.filter(item => {
            const gpMatch = item.gp.toLowerCase().includes(query);
            const matchingScs = item.scList.filter(sc => sc.toLowerCase().includes(query));
            return gpMatch || matchingScs.length > 0;
        });
    }

    // Sort logic
    if (sortField) {
        displayList.sort((a, b) => {
            let valA = sortField === 'gp' ? a.gp : a.count;
            let valB = sortField === 'gp' ? b.gp : b.count;

            if (typeof valA === 'string') {
                return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            } else {
                return sortDirection === 'asc' ? valA - valB : valB - valA;
            }
        });
    }

    tableBody.innerHTML = '';

    if (displayList.length === 0) {
        tableBody.innerHTML = `
            <tr class="no-data-row">
                <td colspan="4" class="text-center">No Gram Panchayats or Sub Centers match your search.</td>
            </tr>
        `;
        return;
    }

    displayList.forEach((item, index) => {
        const scsHtml = item.scList.map(sc => {
            const isMatch = searchTerm && sc.toLowerCase().includes(searchTerm.toLowerCase());
            const highlightedSc = highlightText(sc, searchTerm);
            return isMatch ? `<mark class="sc-highlight">${highlightedSc}</mark>` : highlightedSc;
        }).join(', ');

        const row = document.createElement('tr');
        row.className = 'main-row';
        row.innerHTML = `
            <td class="text-center sl-no">${index + 1}</td>
            <td class="gp-name-cell">
                <span class="gp-name-text">${highlightText(item.gp, searchTerm)} GP</span>
            </td>
            <td class="text-center">
                <span class="sc-count-badge">${item.count}</span>
            </td>
            <td class="sc-list-cell">
                <div class="sc-list-text">${scsHtml}</div>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function highlightText(text, search) {
    if (!search || search.trim() === '') return text;
    const regex = new RegExp(`(${escapeRegExp(search)})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

window.handleSort = function (field) {
    if (sortField === field) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortField = field;
        sortDirection = 'asc';
    }

    document.getElementById('sortIconGp').className = 'fas fa-sort';
    document.getElementById('sortIconCount').className = 'fas fa-sort';

    const activeIconId = field === 'gp' ? 'sortIconGp' : 'sortIconCount';
    const activeIcon = document.getElementById(activeIconId);
    activeIcon.className = sortDirection === 'asc' ? 'fas fa-sort-up active' : 'fas fa-sort-down active';

    renderTable();
}

window.handleSearch = function () {
    searchTerm = searchInput.value;
    renderTable();
}

window.refreshDashboard = function () {
    if (searchInput) {
        searchInput.value = '';
        searchTerm = '';
    }
    initDashboard();
}

// ----------------------------------------------------
// EC MEETING REPORT VIEW LOGIC
// ----------------------------------------------------
async function fetchEcMeetingData() {
    if (guardSupabaseAccess(reportTableBody, 'Supabase is not available. The EC report cannot load in this browser session.')) {
        return;
    }

    try {
        reportTableBody.innerHTML = `
            <tr class="loading-row">
                <td colspan="13"><i class="fas fa-spinner fa-spin"></i> Fetching records from Supabase...</td>
            </tr>
        `;

        const { data, error } = await supabaseClient
            .from('ec_meeting')
            .select('*')
            .order('meeting_date', { ascending: false })
            .limit(5000);

        if (error) throw error;

        ecMeetingData = data || [];

        updateCascadingDropdowns('init');
        applyEcFilters();
    } catch (error) {
        console.error('Error fetching EC data:', error);
        reportTableBody.innerHTML = `
            <tr class="no-data-row">
                <td colspan="13" style="color: var(--color-maroon); font-weight: 600;">
                    Error fetching data from Supabase: ${error.message || 'Check database connection.'}
                </td>
            </tr>
        `;
    }
}

// Cascading filters dropdowns logic
function updateCascadingDropdowns(source) {
    const selYear = filterYear.value || "";
    const selMonth = filterMonth.value || "";
    const selDate = filterDate.value || "";

    let yearsSet = new Set();
    let monthsMap = new Map(); // Store display values
    let datesSet = new Set();

    ecMeetingData.forEach(row => {
        if (!row.meeting_date) return;
        const d = new Date(row.meeting_date);
        if (isNaN(d.getTime())) return;

        const yyyy = d.getFullYear().toString();
        const locMonth = d.toLocaleString('default', { month: 'long', year: 'numeric' });
        const dateStr = row.meeting_date;

        yearsSet.add(yyyy);

        if (!selYear || yyyy === selYear) {
            monthsMap.set(locMonth, locMonth);
        }

        if ((!selYear || yyyy === selYear) && (!selMonth || locMonth === selMonth)) {
            datesSet.add(dateStr);
        }
    });

    // Populate Year dropdown on init
    if (source === 'init') {
        const yearsArr = Array.from(yearsSet).sort().reverse();
        filterYear.innerHTML = '<option value="">All Years</option>' +
            yearsArr.map(y => `<option value="${y}">${y}</option>`).join('');
        filterYear.value = selYear;
    }

    // Populate Month dropdown depending on Year selection
    if (source === 'init' || source === 'year') {
        const monthsArr = Array.from(monthsMap.values()).sort((a, b) => {
            // Sort months reverse chronologically
            return new Date(b) - new Date(a);
        });
        filterMonth.innerHTML = '<option value="">All Months</option>' +
            monthsArr.map(m => `<option value="${m}">${m}</option>`).join('');
        // check if old selection is still valid
        filterMonth.value = monthsArr.includes(selMonth) ? selMonth : "";
    }

    // Populate Date dropdown depending on Year and Month selection
    if (source === 'init' || source === 'year' || source === 'month') {
        const datesArr = Array.from(datesSet).sort().reverse();
        filterDate.innerHTML = '<option value="">All Dates</option>' +
            datesArr.map(d => `<option value="${d}">${formatDateDDMMYYYY(d)}</option>`).join('');
        filterDate.value = datesArr.includes(selDate) ? selDate : "";
    }
}

window.handleFilterChange = function (source) {
    updateCascadingDropdowns(source);
    applyEcFilters();
}

function applyEcFilters() {
    const fYear = filterYear.value || "";
    const fMonth = filterMonth.value || "";
    const fDate = filterDate.value || "";

    filteredEcData = ecMeetingData.filter(row => {
        if (!row.meeting_date) return false;
        const d = new Date(row.meeting_date);
        if (isNaN(d.getTime())) return false;

        const yyyy = d.getFullYear().toString();
        const locMonth = d.toLocaleString('default', { month: 'long', year: 'numeric' });

        if (fYear && yyyy !== fYear) return false;
        if (fMonth && locMonth !== fMonth) return false;
        if (fDate && row.meeting_date !== fDate) return false;

        return true;
    }).sort((a, b) => (a.reporting_unit || '').localeCompare(b.reporting_unit || ''));

    // Calculate report compliance stats
    const reportedSet = new Set(filteredEcData.map(r => r.reporting_unit).filter(Boolean));
    currentDefaulters = default_units.filter(sc => !reportedSet.has(sc));

    // Update KPI display
    document.getElementById('repToReport').textContent = default_units.length;
    document.getElementById('repReported').textContent = reportedSet.size;
    document.getElementById('repDefaulters').textContent = currentDefaulters.length;

    drawReportTable();
}

function drawReportTable() {
    reportTableBody.innerHTML = '';

    if (filteredEcData.length === 0) {
        reportTableBody.innerHTML = `
            <tr class="no-data-row">
                <td colspan="13" class="text-center">No reports match your selected filters.</td>
            </tr>
        `;
        return;
    }

    // Totals counters
    let sumTotalEc = 0;
    let sumTeenageEc = 0;
    let sumFSteril = 0;
    let sumMSteril = 0;
    let sumIucd = 0;
    let sumAntara = 0;
    let sumCc = 0;
    let sumOp = 0;
    let sumEcp = 0;
    let sumChhaya = 0;

    filteredEcData.forEach(row => {
        sumTotalEc += parseInt(row.total_ec_attended) || 0;
        sumTeenageEc += parseInt(row.teenage_ec_attended) || 0;
        sumFSteril += parseInt(row.female_sterilization) || 0;
        sumMSteril += parseInt(row.male_sterilization) || 0;
        sumIucd += parseInt(row.iucd) || 0;
        sumAntara += parseInt(row.antara) || 0;
        sumCc += parseInt(row.cc) || 0;
        sumOp += parseInt(row.op) || 0;
        sumEcp += parseInt(row.ecp) || 0;
        sumChhaya += parseInt(row.chhaya) || 0;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${formatDateDDMMYYYY(row.meeting_date)}</td>
            <td style="font-weight: 600;">${row.reporting_unit || ''}</td>
            <td class="text-center">${row.total_ec_attended || 0}</td>
            <td class="text-center">${row.teenage_ec_attended || 0}</td>
            <td class="text-center">${row.female_sterilization || 0}</td>
            <td class="text-center">${row.male_sterilization || 0}</td>
            <td class="text-center">${row.iucd || 0}</td>
            <td class="text-center">${row.antara || 0}</td>
            <td class="text-center">${row.cc || 0}</td>
            <td class="text-center">${row.op || 0}</td>
            <td class="text-center">${row.ecp || 0}</td>
            <td class="text-center">${row.chhaya || 0}</td>
            <td class="text-center">
                <button class="btn-action-edit" onclick="openEditModal(${row.id})" title="Edit Row">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-action-delete" onclick="openDeleteConfirm(${row.id})" title="Delete Row">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        reportTableBody.appendChild(tr);
    });

    // Add Grand Total sticky row at the bottom
    const totalTr = document.createElement('tr');
    totalTr.className = 'grand-total-row';
    totalTr.innerHTML = `
        <td colspan="2" class="text-right">Grand Total</td>
        <td class="text-center">${sumTotalEc}</td>
        <td class="text-center">${sumTeenageEc}</td>
        <td class="text-center">${sumFSteril}</td>
        <td class="text-center">${sumMSteril}</td>
        <td class="text-center">${sumIucd}</td>
        <td class="text-center">${sumAntara}</td>
        <td class="text-center">${sumCc}</td>
        <td class="text-center">${sumOp}</td>
        <td class="text-center">${sumEcp}</td>
        <td class="text-center">${sumChhaya}</td>
        <td></td>
    `;
    reportTableBody.appendChild(totalTr);
}

// ----------------------------------------------------
// CRUD OPERATIONS LOGIC
// ----------------------------------------------------

// EDIT DIALOG ACTIONS
window.openEditModal = function (id) {
    const record = ecMeetingData.find(r => r.id === id);
    if (!record) return;

    document.getElementById('edit-id').value = record.id;
    document.getElementById('edit-reporting-unit').value = record.reporting_unit || '';
    document.getElementById('edit-meeting-date').value = record.meeting_date || '';
    document.getElementById('edit-total-ec').value = record.total_ec_attended || 0;
    document.getElementById('edit-teenage-ec').value = record.teenage_ec_attended || 0;
    document.getElementById('edit-f-steril').value = record.female_sterilization || 0;
    document.getElementById('edit-m-steril').value = record.male_sterilization || 0;
    document.getElementById('edit-iucd').value = record.iucd || 0;
    document.getElementById('edit-antara').value = record.antara || 0;
    document.getElementById('edit-cc').value = record.cc || 0;
    document.getElementById('edit-op').value = record.op || 0;
    document.getElementById('edit-ecp').value = record.ecp || 0;
    document.getElementById('edit-chhaya').value = record.chhaya || 0;

    editModal.classList.add('active');
}

window.closeEditModal = function () {
    editModal.classList.remove('active');
}

window.saveRecord = async function (event) {
    event.preventDefault();

    const id = document.getElementById('edit-id').value;
    const btnSave = document.getElementById('btnSaveRecord');

    btnSave.disabled = true;
    btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    const updatedData = {
        meeting_date: document.getElementById('edit-meeting-date').value,
        total_ec_attended: parseInt(document.getElementById('edit-total-ec').value) || 0,
        teenage_ec_attended: parseInt(document.getElementById('edit-teenage-ec').value) || 0,
        female_sterilization: parseInt(document.getElementById('edit-f-steril').value) || 0,
        male_sterilization: parseInt(document.getElementById('edit-m-steril').value) || 0,
        iucd: parseInt(document.getElementById('edit-iucd').value) || 0,
        antara: parseInt(document.getElementById('edit-antara').value) || 0,
        cc: parseInt(document.getElementById('edit-cc').value) || 0,
        op: parseInt(document.getElementById('edit-op').value) || 0,
        ecp: parseInt(document.getElementById('edit-ecp').value) || 0,
        chhaya: parseInt(document.getElementById('edit-chhaya').value) || 0
    };

    // Calculate month string from selected date e.g. "October, 2025"
    const d = new Date(updatedData.meeting_date);
    if (!isNaN(d.getTime())) {
        updatedData.month = d.toLocaleString('default', { month: 'long', year: 'numeric' });
    }

    try {
        const { error } = await supabaseClient
            .from('ec_meeting')
            .update(updatedData)
            .eq('id', id);

        if (error) throw error;

        showToast('Record updated successfully!');
        closeEditModal();
        fetchEcMeetingData(); // Reload records from database
    } catch (error) {
        console.error('Error updating record:', error);
        showToast('Failed to update record: ' + error.message, 'error');
    } finally {
        btnSave.disabled = false;
        btnSave.innerHTML = 'Save Changes';
    }
}

// DELETE DIALOG ACTIONS
window.openDeleteConfirm = function (id) {
    recordToDeleteId = id;
    confirmModal.classList.add('active');
}

window.closeConfirmModal = function () {
    confirmModal.classList.remove('active');
    recordToDeleteId = null;
}

window.executeDeleteRecord = async function () {
    if (!recordToDeleteId) return;

    const btnDelete = document.getElementById('btnConfirmDelete');
    btnDelete.disabled = true;
    btnDelete.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';

    try {
        const { error } = await supabaseClient
            .from('ec_meeting')
            .delete()
            .eq('id', recordToDeleteId);

        if (error) throw error;

        showToast('Record deleted successfully!');
        closeConfirmModal();
        fetchEcMeetingData(); // Reload records from database
    } catch (error) {
        console.error('Error deleting record:', error);
        showToast('Failed to delete record: ' + error.message, 'error');
    } finally {
        btnDelete.disabled = false;
        btnDelete.innerHTML = 'Yes, Delete';
    }
}

// ----------------------------------------------------
// DELIVERY COVERAGE VIEW LOGIC
// ----------------------------------------------------
async function fetchDeliveryData() {
    deliveryTableBody.innerHTML = `
        <tr class="loading-row">
            <td colspan="12">Loading delivery data...</td>
        </tr>
    `;

    try {
        const { data, error } = await supabaseClient
            .from('delivery_coverage')
            .select('*')
            .order('reporting_year', { ascending: false })
            .order('reporting_month', { ascending: false });

        if (error) throw error;

        deliveryData = data || [];
        updateDelCascadingDropdowns('init');
        applyDelFilters();

        // Also initialize monthly breakdown dropdowns if data is now available
        if (!delMonthlyInitialized) {
            initDelMonthlyDropdowns();
            delMonthlyInitialized = true;
        }
    } catch (error) {
        console.error('Error fetching delivery data:', error);
        showToast('Failed to load delivery data: ' + error.message, 'error');
        deliveryTableBody.innerHTML = `
            <tr>
                <td colspan="12" class="text-center py-4 text-red-600 font-semibold">
                    <i class="fas fa-exclamation-triangle"></i> Error loading data from Supabase
                </td>
            </tr>
        `;
    }
}

function updateDelCascadingDropdowns(source) {
    const selYear = filterDelYear.value;
    const selMonth = filterDelMonth.value;

    const yearsSet = new Set();
    const monthsSet = new Set();

    deliveryData.forEach(row => {
        if (row.reporting_year) yearsSet.add(row.reporting_year);
        if (selYear) {
            if (row.reporting_year === selYear && row.reporting_month) {
                monthsSet.add(row.reporting_month);
            }
        } else {
            if (row.reporting_month) monthsSet.add(row.reporting_month);
        }
    });

    if (source === 'init') {
        const yearsArr = Array.from(yearsSet).sort().reverse();
        filterDelYear.innerHTML = '<option value="">All Years</option>' +
            yearsArr.map(y => `<option value="${y}">${y}</option>`).join('');
        filterDelYear.value = "";
    }

    if (source === 'init' || source === 'year') {
        const monthsArr = Array.from(monthsSet);
        const monthOrder = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        monthsArr.sort((a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b));

        filterDelMonth.innerHTML = '<option value="">All Months</option>' +
            monthsArr.map(m => `<option value="${m}">${m}</option>`).join('');
        filterDelMonth.value = monthsArr.includes(selMonth) ? selMonth : "";
    }
}

window.handleDelFilterChange = function (source) {
    updateDelCascadingDropdowns(source);
    applyDelFilters();
}

function applyDelFilters() {
    const fYear = filterDelYear.value || "";
    const fMonth = filterDelMonth.value || "";

    filteredDeliveryData = deliveryData.filter(row => {
        if (fYear && row.reporting_year !== fYear) return false;
        if (fMonth && row.reporting_month !== fMonth) return false;
        return true;
    }).sort((a, b) => (a.facility || '').localeCompare(b.facility || ''));

    // Calculate report compliance stats
    const reportedSet = new Set(filteredDeliveryData.map(r => r.facility).filter(Boolean));
    currentDelDefaulters = default_units.filter(sc => !reportedSet.has(sc));

    // Update KPI display
    document.getElementById('delToReport').textContent = default_units.length;
    document.getElementById('delReported').textContent = reportedSet.size;
    document.getElementById('delDefaulters').textContent = currentDelDefaulters.length;

    drawDeliveryTable();
}

function drawDeliveryTable() {
    deliveryTableBody.innerHTML = '';

    if (filteredDeliveryData.length === 0) {
        deliveryTableBody.innerHTML = `
            <tr>
                <td colspan="12" style="text-align: center; padding: 20px; color: var(--color-text-muted);">No records found matching filters.</td>
            </tr>
        `;
        return;
    }

    let sumHome = 0, sumGovt = 0, sumPrivate = 0, sumNormal = 0, sumCs = 0, sumTotal = 0, sumLive = 0, sumStill = 0, sumAbortion = 0;

    filteredDeliveryData.forEach(row => {
        sumHome += parseInt(row.delivery_home) || 0;
        sumGovt += parseInt(row.delivery_govt) || 0;
        sumPrivate += parseInt(row.delivery_private) || 0;
        sumNormal += parseInt(row.normal_delivery) || 0;
        sumCs += parseInt(row.cs_delivery) || 0;
        sumTotal += parseInt(row.total_delivery) || 0;
        sumLive += parseInt(row.live_birth) || 0;
        sumStill += parseInt(row.still_birth) || 0;
        sumAbortion += parseInt(row.total_abortion) || 0;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.gp || ''}</td>
            <td class="font-semibold text-gray-700">${row.facility || ''}</td>
            <td class="text-center">${row.delivery_home ?? 0}</td>
            <td class="text-center">${row.delivery_govt ?? 0}</td>
            <td class="text-center">${row.delivery_private ?? 0}</td>
            <td class="text-center">${row.normal_delivery ?? 0}</td>
            <td class="text-center">${row.cs_delivery ?? 0}</td>
            <td class="text-center">${row.total_delivery ?? 0}</td>
            <td class="text-center">${row.live_birth ?? 0}</td>
            <td class="text-center">${row.still_birth ?? 0}</td>
            <td class="text-center">${row.total_abortion ?? 0}</td>
            <td>
                <div class="action-buttons flex gap-2 justify-center">
                    <button class="btn-action-edit" onclick="openEditDeliveryModal(${row.id})" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="btn-action-delete" onclick="openDeliveryDeleteConfirm(${row.id})" title="Delete"><i class="fas fa-trash-alt"></i></button>
                </div>
            </td>
        `;
        deliveryTableBody.appendChild(tr);
    });

    // Create Sticky Grand Total Row
    const tfootRow = document.createElement('tr');
    tfootRow.className = 'grand-total-row';
    tfootRow.innerHTML = `
        <td colspan="2" class="font-bold text-maroon text-right">Grand Total</td>
        <td class="text-center font-bold text-maroon">${sumHome}</td>
        <td class="text-center font-bold text-maroon">${sumGovt}</td>
        <td class="text-center font-bold text-maroon">${sumPrivate}</td>
        <td class="text-center font-bold text-maroon">${sumNormal}</td>
        <td class="text-center font-bold text-maroon">${sumCs}</td>
        <td class="text-center font-bold text-maroon">${sumTotal}</td>
        <td class="text-center font-bold text-maroon">${sumLive}</td>
        <td class="text-center font-bold text-maroon">${sumStill}</td>
        <td class="text-center font-bold text-maroon">${sumAbortion}</td>
        <td></td>
    `;
    deliveryTableBody.appendChild(tfootRow);
}

// EDIT DELIVERY DIALOG ACTIONS
window.openEditDeliveryModal = function (id) {
    const record = deliveryData.find(r => r.id === id);
    if (!record) return;

    document.getElementById('edit-del-id').value = record.id;
    document.getElementById('edit-del-reporting-unit').value = record.facility || '';
    document.getElementById('edit-del-year').value = record.reporting_year || '';
    document.getElementById('edit-del-month').value = record.reporting_month || '';

    document.getElementById('edit-del-home').value = record.delivery_home ?? 0;
    document.getElementById('edit-del-govt').value = record.delivery_govt ?? 0;
    document.getElementById('edit-del-private').value = record.delivery_private ?? 0;
    document.getElementById('edit-del-normal').value = record.normal_delivery ?? 0;
    document.getElementById('edit-del-cs').value = record.cs_delivery ?? 0;
    document.getElementById('edit-del-total').value = record.total_delivery ?? 0;
    document.getElementById('edit-del-live').value = record.live_birth ?? 0;
    document.getElementById('edit-del-still').value = record.still_birth ?? 0;
    document.getElementById('edit-del-abortion').value = record.total_abortion ?? 0;

    editDeliveryModal.classList.add('active');
}

window.closeEditDeliveryModal = function () {
    editDeliveryModal.classList.remove('active');
    editDeliveryForm.reset();
}

window.saveDeliveryRecord = async function (e) {
    e.preventDefault();

    const id = parseInt(document.getElementById('edit-del-id').value);
    const btnSave = document.getElementById('btnSaveDeliveryRecord');
    btnSave.disabled = true;
    btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    const updatedData = {
        delivery_home: parseInt(document.getElementById('edit-del-home').value) || 0,
        delivery_govt: parseInt(document.getElementById('edit-del-govt').value) || 0,
        delivery_private: parseInt(document.getElementById('edit-del-private').value) || 0,
        normal_delivery: parseInt(document.getElementById('edit-del-normal').value) || 0,
        cs_delivery: parseInt(document.getElementById('edit-del-cs').value) || 0,
        total_delivery: parseInt(document.getElementById('edit-del-total').value) || 0,
        live_birth: parseInt(document.getElementById('edit-del-live').value) || 0,
        still_birth: parseInt(document.getElementById('edit-del-still').value) || 0,
        total_abortion: parseInt(document.getElementById('edit-del-abortion').value) || 0
    };

    try {
        const { error } = await supabaseClient
            .from('delivery_coverage')
            .update(updatedData)
            .eq('id', id);

        if (error) throw error;

        showToast('Delivery record updated successfully!');
        closeEditDeliveryModal();
        fetchDeliveryData(); // Reload records
    } catch (error) {
        console.error('Error updating delivery record:', error);
        showToast('Failed to update record: ' + error.message, 'error');
    } finally {
        btnSave.disabled = false;
        btnSave.innerHTML = 'Save Changes';
    }
}

// DELETE DELIVERY DIALOG ACTIONS
window.openDeliveryDeleteConfirm = function (id) {
    deliveryRecordToDeleteId = id;
    confirmDeliveryModal.classList.add('active');
}

window.closeDeliveryConfirmModal = function () {
    confirmDeliveryModal.classList.remove('active');
    deliveryRecordToDeleteId = null;
}

window.executeDeleteDeliveryRecord = async function () {
    if (!deliveryRecordToDeleteId) return;

    const btnDelete = document.getElementById('btnConfirmDelDelete');
    btnDelete.disabled = true;
    btnDelete.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';

    try {
        const { error } = await supabaseClient
            .from('delivery_coverage')
            .delete()
            .eq('id', deliveryRecordToDeleteId);

        if (error) throw error;

        showToast('Delivery record deleted successfully!');
        closeDeliveryConfirmModal();
        fetchDeliveryData(); // Reload records
    } catch (error) {
        console.error('Error deleting delivery record:', error);
        showToast('Failed to delete record: ' + error.message, 'error');
    } finally {
        btnDelete.disabled = false;
        btnDelete.innerHTML = 'Yes, Delete';
    }
}

// DELIVERY DEFAULTERS MODAL ACTIONS
window.openDelDefaultersModal = function () {
    const container = document.getElementById('delDefaultersListContainer');
    container.innerHTML = '';

    if (currentDelDefaulters.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 24px; color: var(--color-text-muted);">
                <i class="fas fa-check-circle" style="color: #2e7d32; font-size: 2.5rem; margin-bottom: 12px; display: block;"></i>
                All facilities have reported. No defaulters!
            </div>
        `;
    } else {
        const sortedDefaulters = [...currentDelDefaulters].sort();
        container.innerHTML = sortedDefaulters.map(sc => `
            <div class="defaulter-item">
                <i class="fas fa-exclamation-circle"></i>
                <span>${sc}</span>
            </div>
        `).join('');
    }

    defaultersDeliveryModal.classList.add('active');
}

window.closeDelDefaultersModal = function () {
    defaultersDeliveryModal.classList.remove('active');
}

// ----------------------------------------------------
// DELIVERY SUB-VIEW SWITCHING (Facility vs Monthly)
// ----------------------------------------------------
let delCurrentSubView = 'facility'; // 'facility' or 'monthly'
let delMonthlyInitialized = false;

window.switchDelSubView = function (subView) {
    delCurrentSubView = subView;

    const tabFacility = document.getElementById('tabFacilityView');
    const tabMonthly = document.getElementById('tabMonthlyView');
    const sectionFacility = document.getElementById('delFacilitySection');
    const sectionMonthly = document.getElementById('delMonthlySection');
    const exportBtns = document.getElementById('deliveryExportBtns');
    const subtitle = document.getElementById('deliverySubtitle');

    tabFacility.classList.remove('active');
    tabMonthly.classList.remove('active');

    if (subView === 'facility') {
        tabFacility.classList.add('active');
        sectionFacility.style.display = '';
        sectionMonthly.style.display = 'none';
        exportBtns.style.display = '';
        subtitle.textContent = 'Facility wise breakdown of delivery data elements';
    } else {
        tabMonthly.classList.add('active');
        sectionFacility.style.display = 'none';
        sectionMonthly.style.display = '';
        exportBtns.style.display = 'none';
        subtitle.textContent = 'Financial year wise monthly breakdown of delivery data';

        // Initialize FY dropdowns on first switch (data may already be loaded)
        if (!delMonthlyInitialized && deliveryData.length > 0) {
            initDelMonthlyDropdowns();
            delMonthlyInitialized = true;
        }
    }
}

// Financial year months order: April (index 0) → March (index 11)
const FY_MONTHS = [
    'April', 'May', 'June', 'July', 'August', 'September',
    'October', 'November', 'December', 'January', 'February', 'March'
];

// Map month name to its calendar month number (1-12)
const MONTH_NUMBER = {
    'January': 1, 'February': 2, 'March': 3, 'April': 4,
    'May': 5, 'June': 6, 'July': 7, 'August': 8,
    'September': 9, 'October': 10, 'November': 11, 'December': 12
};

/**
 * Determine which FY a record belongs to based on its reporting_year and reporting_month.
 * FY 2025-26 = April 2025 → March 2026
 * So if month is Jan/Feb/Mar, the FY start year is (reporting_year - 1)
 */
function getFYStartYear(reportingYear, reportingMonth) {
    const yr = parseInt(reportingYear);
    const mn = MONTH_NUMBER[reportingMonth];
    if (!yr || !mn) return null;
    // Jan, Feb, Mar belong to the FY that started the previous April
    return mn <= 3 ? yr - 1 : yr;
}

function getFYLabel(startYear) {
    return `FY ${startYear}-${(startYear + 1).toString().slice(-2)}`;
}

function initDelMonthlyDropdowns() {
    const filterFY = document.getElementById('filterDelFY');

    // Collect unique FY start years
    const fySet = new Set();
    deliveryData.forEach(row => {
        const fy = getFYStartYear(row.reporting_year, row.reporting_month);
        if (fy !== null) fySet.add(fy);
    });

    const fyArr = Array.from(fySet).sort().reverse();
    filterFY.innerHTML = '<option value="">Select FY</option>' +
        fyArr.map(fy => `<option value="${fy}">${getFYLabel(fy)}</option>`).join('');

    // Populate facility checkboxes in the multi-select
    populateFacilityCheckboxes();
}

// --- Multi-Select Facility Helpers ---
let selectedFacilities = new Set(default_units); // Start with all selected

function populateFacilityCheckboxes() {
    const container = document.getElementById('facilityOptionsList');
    const sortedFacilities = [...default_units].sort();

    container.innerHTML = sortedFacilities.map(f => {
        const checked = selectedFacilities.has(f) ? 'checked' : '';
        const safeId = 'fac_' + f.replace(/[^a-zA-Z0-9]/g, '_');
        return `
            <div class="multiselect-option" onclick="toggleFacilityCheckbox('${f.replace(/'/g, "\\'")}', event)">
                <input type="checkbox" id="${safeId}" ${checked} data-facility="${f}">
                <label for="${safeId}">${f}</label>
            </div>
        `;
    }).join('');

    updateFacilityMultiselectLabel();
}

function getSelectedFacilities() {
    return selectedFacilities;
}

function updateFacilityMultiselectLabel() {
    const label = document.getElementById('facilityMultiselectLabel');
    const badge = document.getElementById('facilityMultiselectBadge');
    const selectAllCb = document.getElementById('facilitySelectAll');
    const total = default_units.length;
    const count = selectedFacilities.size;

    if (count === 0) {
        label.textContent = 'None Selected';
        badge.style.display = 'inline-block';
        badge.textContent = '0';
        if (selectAllCb) selectAllCb.checked = false;
    } else if (count === total) {
        label.textContent = 'All Facilities';
        badge.style.display = 'none';
        if (selectAllCb) selectAllCb.checked = true;
    } else {
        // Show first selected name + count
        const first = [...selectedFacilities].sort()[0];
        label.textContent = count === 1 ? first : `${first} +${count - 1} more`;
        badge.style.display = 'inline-block';
        badge.textContent = count;
        if (selectAllCb) selectAllCb.indeterminate = true;
    }
}

window.toggleFacilityDropdown = function () {
    const dropdown = document.getElementById('facilityMultiselect');
    dropdown.classList.toggle('open');
    if (dropdown.classList.contains('open')) {
        // Focus search
        setTimeout(() => document.getElementById('facilitySearchInput').focus(), 50);
    }
}

window.toggleFacilityCheckbox = function (facility, event) {
    // Don't toggle twice when clicking the checkbox itself
    if (event.target.tagName === 'INPUT') {
        // checkbox already toggled by browser
        if (event.target.checked) {
            selectedFacilities.add(facility);
        } else {
            selectedFacilities.delete(facility);
        }
    } else {
        // Clicked the row/label — toggle manually
        if (selectedFacilities.has(facility)) {
            selectedFacilities.delete(facility);
        } else {
            selectedFacilities.add(facility);
        }
        // Update checkbox visual
        const cb = event.currentTarget.querySelector('input[type="checkbox"]');
        if (cb) cb.checked = selectedFacilities.has(facility);
    }
    updateFacilityMultiselectLabel();
    drawDelMonthlyTable();
}

window.toggleAllFacilities = function () {
    const selectAllCb = document.getElementById('facilitySelectAll');
    const allChecked = selectedFacilities.size === default_units.length;

    if (allChecked) {
        // Uncheck all
        selectedFacilities.clear();
        selectAllCb.checked = false;
    } else {
        // Check all
        default_units.forEach(f => selectedFacilities.add(f));
        selectAllCb.checked = true;
    }
    selectAllCb.indeterminate = false;

    // Update all checkboxes in the list
    const checkboxes = document.querySelectorAll('#facilityOptionsList input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = selectedFacilities.has(cb.dataset.facility);
    });

    updateFacilityMultiselectLabel();
    drawDelMonthlyTable();
}

window.filterFacilityOptions = function () {
    const query = document.getElementById('facilitySearchInput').value.toLowerCase();
    const options = document.querySelectorAll('#facilityOptionsList .multiselect-option');
    options.forEach(opt => {
        const label = opt.querySelector('label');
        if (label && label.textContent.toLowerCase().includes(query)) {
            opt.style.display = '';
        } else {
            opt.style.display = 'none';
        }
    });
}

// Close multi-select dropdown on click outside
document.addEventListener('click', function (e) {
    const dropdown = document.getElementById('facilityMultiselect');
    if (dropdown && !dropdown.contains(e.target)) {
        dropdown.classList.remove('open');
    }
});

window.handleDelMonthlyFilterChange = function () {
    drawDelMonthlyTable();
}

function drawDelMonthlyTable() {
    const tbody = document.getElementById('delMonthlyTableBody');
    const selFY = document.getElementById('filterDelFY').value;
    const selFacilities = getSelectedFacilities();

    if (!selFY) {
        tbody.innerHTML = `
            <tr class="no-data-row">
                <td colspan="10" class="text-center">Select a Financial Year to view monthly breakdown.</td>
            </tr>
        `;
        return;
    }

    const fyStart = parseInt(selFY);

    // Filter delivery data for the selected FY and selected facilities
    const fyFiltered = deliveryData.filter(row => {
        const fy = getFYStartYear(row.reporting_year, row.reporting_month);
        if (fy !== fyStart) return false;
        if (selFacilities.size > 0 && selFacilities.size < default_units.length) {
            if (!selFacilities.has(row.facility)) return false;
        } else if (selFacilities.size === 0) {
            return false; // No facilities selected
        }
        return true;
    });

    // Aggregate month-wise
    const monthAgg = {};
    FY_MONTHS.forEach(m => {
        monthAgg[m] = {
            delivery_home: 0, delivery_govt: 0, delivery_private: 0,
            normal_delivery: 0, cs_delivery: 0, total_delivery: 0,
            live_birth: 0, still_birth: 0, total_abortion: 0,
            hasData: false
        };
    });

    fyFiltered.forEach(row => {
        const month = row.reporting_month;
        if (!monthAgg[month]) return;
        monthAgg[month].delivery_home += parseInt(row.delivery_home) || 0;
        monthAgg[month].delivery_govt += parseInt(row.delivery_govt) || 0;
        monthAgg[month].delivery_private += parseInt(row.delivery_private) || 0;
        monthAgg[month].normal_delivery += parseInt(row.normal_delivery) || 0;
        monthAgg[month].cs_delivery += parseInt(row.cs_delivery) || 0;
        monthAgg[month].total_delivery += parseInt(row.total_delivery) || 0;
        monthAgg[month].live_birth += parseInt(row.live_birth) || 0;
        monthAgg[month].still_birth += parseInt(row.still_birth) || 0;
        monthAgg[month].total_abortion += parseInt(row.total_abortion) || 0;
        monthAgg[month].hasData = true;
    });

    tbody.innerHTML = '';

    if (selFacilities.size === 0) {
        tbody.innerHTML = `
            <tr class="no-data-row">
                <td colspan="10" class="text-center">Select at least one facility.</td>
            </tr>
        `;
        return;
    }

    // Grand total accumulators
    let gtHome = 0, gtGovt = 0, gtPvt = 0, gtNormal = 0, gtCs = 0, gtTotal = 0, gtLive = 0, gtStill = 0, gtAbortion = 0;

    FY_MONTHS.forEach(month => {
        const d = monthAgg[month];
        // Determine the calendar year for display
        const calYear = MONTH_NUMBER[month] <= 3 ? fyStart + 1 : fyStart;
        const displayLabel = `${month} ${calYear}`;

        gtHome += d.delivery_home;
        gtGovt += d.delivery_govt;
        gtPvt += d.delivery_private;
        gtNormal += d.normal_delivery;
        gtCs += d.cs_delivery;
        gtTotal += d.total_delivery;
        gtLive += d.live_birth;
        gtStill += d.still_birth;
        gtAbortion += d.total_abortion;

        const tr = document.createElement('tr');
        // Dim rows with no data
        if (!d.hasData) {
            tr.style.opacity = '0.45';
        }
        tr.innerHTML = `
            <td style="font-weight: 600;">${displayLabel}</td>
            <td class="text-center">${d.delivery_home}</td>
            <td class="text-center">${d.delivery_govt}</td>
            <td class="text-center">${d.delivery_private}</td>
            <td class="text-center">${d.normal_delivery}</td>
            <td class="text-center">${d.cs_delivery}</td>
            <td class="text-center">${d.total_delivery}</td>
            <td class="text-center">${d.live_birth}</td>
            <td class="text-center">${d.still_birth}</td>
            <td class="text-center">${d.total_abortion}</td>
        `;
        tbody.appendChild(tr);
    });

    // Grand total row
    const totalTr = document.createElement('tr');
    totalTr.className = 'grand-total-row';
    totalTr.innerHTML = `
        <td class="font-bold text-maroon text-right">Grand Total</td>
        <td class="text-center font-bold text-maroon">${gtHome}</td>
        <td class="text-center font-bold text-maroon">${gtGovt}</td>
        <td class="text-center font-bold text-maroon">${gtPvt}</td>
        <td class="text-center font-bold text-maroon">${gtNormal}</td>
        <td class="text-center font-bold text-maroon">${gtCs}</td>
        <td class="text-center font-bold text-maroon">${gtTotal}</td>
        <td class="text-center font-bold text-maroon">${gtLive}</td>
        <td class="text-center font-bold text-maroon">${gtStill}</td>
        <td class="text-center font-bold text-maroon">${gtAbortion}</td>
    `;
    let tfoot = tbody.parentNode.querySelector('tfoot'); if(!tfoot) { tfoot = document.createElement('tfoot'); tbody.parentNode.appendChild(tfoot); } tfoot.innerHTML = ''; tfoot.appendChild(totalTr);
}

// Export Monthly Breakdown to Excel
window.exportDelMonthlyToExcel = function () {
    const selFY = document.getElementById('filterDelFY').value;
    if (!selFY) {
        showToast('Select a Financial Year first!', 'error');
        return;
    }
    const selFacilities = getSelectedFacilities();
    const fyStart = parseInt(selFY);

    // Rebuild aggregation
    const fyFiltered = deliveryData.filter(row => {
        const fy = getFYStartYear(row.reporting_year, row.reporting_month);
        if (fy !== fyStart) return false;
        if (selFacilities.size > 0 && selFacilities.size < default_units.length) {
            if (!selFacilities.has(row.facility)) return false;
        } else if (selFacilities.size === 0) {
            return false;
        }
        return true;
    });

    const monthAgg = {};
    FY_MONTHS.forEach(m => {
        monthAgg[m] = { delivery_home: 0, delivery_govt: 0, delivery_private: 0, normal_delivery: 0, cs_delivery: 0, total_delivery: 0, live_birth: 0, still_birth: 0, total_abortion: 0 };
    });
    fyFiltered.forEach(row => {
        const month = row.reporting_month;
        if (!monthAgg[month]) return;
        monthAgg[month].delivery_home += parseInt(row.delivery_home) || 0;
        monthAgg[month].delivery_govt += parseInt(row.delivery_govt) || 0;
        monthAgg[month].delivery_private += parseInt(row.delivery_private) || 0;
        monthAgg[month].normal_delivery += parseInt(row.normal_delivery) || 0;
        monthAgg[month].cs_delivery += parseInt(row.cs_delivery) || 0;
        monthAgg[month].total_delivery += parseInt(row.total_delivery) || 0;
        monthAgg[month].live_birth += parseInt(row.live_birth) || 0;
        monthAgg[month].still_birth += parseInt(row.still_birth) || 0;
        monthAgg[month].total_abortion += parseInt(row.total_abortion) || 0;
    });

    const rows = [];
    let gtHome = 0, gtGovt = 0, gtPvt = 0, gtNormal = 0, gtCs = 0, gtTotal = 0, gtLive = 0, gtStill = 0, gtAbortion = 0;

    FY_MONTHS.forEach(month => {
        const d = monthAgg[month];
        const calYear = MONTH_NUMBER[month] <= 3 ? fyStart + 1 : fyStart;
        gtHome += d.delivery_home; gtGovt += d.delivery_govt; gtPvt += d.delivery_private;
        gtNormal += d.normal_delivery; gtCs += d.cs_delivery; gtTotal += d.total_delivery;
        gtLive += d.live_birth; gtStill += d.still_birth; gtAbortion += d.total_abortion;

        rows.push({
            'Month': `${month} ${calYear}`,
            'Home Del.': d.delivery_home, 'Govt Del.': d.delivery_govt, 'Pvt Del.': d.delivery_private,
            'Normal Del.': d.normal_delivery, 'CS Del.': d.cs_delivery, 'Total Del.': d.total_delivery,
            'Live Birth': d.live_birth, 'Still Birth': d.still_birth, 'Abortion': d.total_abortion
        });
    });

    rows.push({
        'Month': 'Grand Total',
        'Home Del.': gtHome, 'Govt Del.': gtGovt, 'Pvt Del.': gtPvt,
        'Normal Del.': gtNormal, 'CS Del.': gtCs, 'Total Del.': gtTotal,
        'Live Birth': gtLive, 'Still Birth': gtStill, 'Abortion': gtAbortion
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    const facCount = selFacilities.size;
    const sheetLabel = facCount === default_units.length ? 'All Facilities' : `${facCount} Facilities`;
    const sheetName = `${sheetLabel} - ${getFYLabel(fyStart)}`;
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.substring(0, 31));
    worksheet['!cols'] = [{ wch: 18 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
    XLSX.writeFile(workbook, `Delivery_Monthly_${getFYLabel(fyStart).replace(/\s/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// Export Monthly Breakdown to PDF
window.exportDelMonthlyToPDF = function () {
    const selFY = document.getElementById('filterDelFY').value;
    if (!selFY) {
        showToast('Select a Financial Year first!', 'error');
        return;
    }
    const selFacilities = getSelectedFacilities();
    const fyStart = parseInt(selFY);

    const fyFiltered = deliveryData.filter(row => {
        const fy = getFYStartYear(row.reporting_year, row.reporting_month);
        if (fy !== fyStart) return false;
        if (selFacilities.size > 0 && selFacilities.size < default_units.length) {
            if (!selFacilities.has(row.facility)) return false;
        } else if (selFacilities.size === 0) {
            return false;
        }
        return true;
    });

    const monthAgg = {};
    FY_MONTHS.forEach(m => {
        monthAgg[m] = { delivery_home: 0, delivery_govt: 0, delivery_private: 0, normal_delivery: 0, cs_delivery: 0, total_delivery: 0, live_birth: 0, still_birth: 0, total_abortion: 0 };
    });
    fyFiltered.forEach(row => {
        const month = row.reporting_month;
        if (!monthAgg[month]) return;
        monthAgg[month].delivery_home += parseInt(row.delivery_home) || 0;
        monthAgg[month].delivery_govt += parseInt(row.delivery_govt) || 0;
        monthAgg[month].delivery_private += parseInt(row.delivery_private) || 0;
        monthAgg[month].normal_delivery += parseInt(row.normal_delivery) || 0;
        monthAgg[month].cs_delivery += parseInt(row.cs_delivery) || 0;
        monthAgg[month].total_delivery += parseInt(row.total_delivery) || 0;
        monthAgg[month].live_birth += parseInt(row.live_birth) || 0;
        monthAgg[month].still_birth += parseInt(row.still_birth) || 0;
        monthAgg[month].total_abortion += parseInt(row.total_abortion) || 0;
    });

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(122, 28, 49);
    doc.text(`Delivery Coverage - Monthly Breakdown`, 14, 15);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    const facCount = selFacilities.size;
    const facilityLabel = facCount === default_units.length ? 'All Facilities' : `${facCount} of ${default_units.length} Facilities`;
    doc.text(`${getFYLabel(fyStart)} | ${facilityLabel} | Generated: ${new Date().toLocaleDateString()}`, 14, 21);

    const headers = [
        [
            { content: 'Month', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
            { content: 'Place of Delivery', colSpan: 3, styles: { halign: 'center' } },
            { content: 'Method of Delivery', colSpan: 3, styles: { halign: 'center' } },
            { content: 'Pregnancy Outcome', colSpan: 3, styles: { halign: 'center' } }
        ],
        ['Home', 'Govt', 'Pvt', 'Normal', 'CS', 'Total', 'Live Birth', 'Still Birth', 'Abortion']
    ];

    const tableData = [];
    let gtHome = 0, gtGovt = 0, gtPvt = 0, gtNormal = 0, gtCs = 0, gtTotal = 0, gtLive = 0, gtStill = 0, gtAbortion = 0;

    FY_MONTHS.forEach(month => {
        const d = monthAgg[month];
        const calYear = MONTH_NUMBER[month] <= 3 ? fyStart + 1 : fyStart;
        gtHome += d.delivery_home; gtGovt += d.delivery_govt; gtPvt += d.delivery_private;
        gtNormal += d.normal_delivery; gtCs += d.cs_delivery; gtTotal += d.total_delivery;
        gtLive += d.live_birth; gtStill += d.still_birth; gtAbortion += d.total_abortion;

        tableData.push([
            `${month} ${calYear}`,
            d.delivery_home, d.delivery_govt, d.delivery_private,
            d.normal_delivery, d.cs_delivery, d.total_delivery,
            d.live_birth, d.still_birth, d.total_abortion
        ]);
    });

    tableData.push([
        'Grand Total',
        gtHome, gtGovt, gtPvt, gtNormal, gtCs, gtTotal, gtLive, gtStill, gtAbortion
    ]);

    doc.autoTable({
        startY: 25,
        head: headers,
        body: tableData,
        theme: 'grid',
        headStyles: {
            fillColor: [122, 28, 49],
            textColor: [255, 255, 255],
            fontSize: 8.5,
            fontStyle: 'bold',
            halign: 'center'
        },
        bodyStyles: {
            fontSize: 8,
            textColor: [50, 50, 50]
        },
        alternateRowStyles: {
            fillColor: [248, 248, 248]
        },
        columnStyles: {
            0: { cellWidth: 35, fontStyle: 'bold' },
            1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' },
            4: { halign: 'center' }, 5: { halign: 'center' }, 6: { halign: 'center' },
            7: { halign: 'center' }, 8: { halign: 'center' }, 9: { halign: 'center' }
        },
        didParseCell: function (data) {
            if (data.row.index === tableData.length - 1) {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.textColor = [122, 28, 49];
                data.cell.styles.fillColor = [252, 235, 235];
            }
        },
        margin: { top: 25, bottom: 15, left: 14, right: 14 }
    });

    doc.save(`Delivery_Monthly_${getFYLabel(fyStart).replace(/\s/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ----------------------------------------------------
// WPD REPORT VIEW LOGIC
// ----------------------------------------------------
function getWpdRowValue(row, candidates) {
    for (const candidate of candidates) {
        if (!candidate) continue;
        const value = row?.[candidate];
        if (value !== undefined && value !== null && value !== '') return value;
    }
    return '';
}

function getWpdDisplayColumns(rows) {
    const exclude = new Set([
        'id', 'created_at', 'updated_at', 'inserted_at', 'updated_on', 'timestamp',
        'reporting_year', 'year', 'reporting_month', 'month', 'date', 'meeting_date', 'reporting_date', 'date_of_reporting',
        'gp', 'gram_panchayat'
    ]);
    const priority = ['facility', 'facility_name', 'reporting_unit', 'subcenter', 'sub_center_name', 'subcenter_name', 'subcentre', 'sub_center'];

    const columns = [];
    const seen = new Set();

    priority.forEach(key => {
        if (rows.some(row => row && Object.prototype.hasOwnProperty.call(row, key))) {
            if (!exclude.has(key.toLowerCase())) {
                columns.push(key);
                seen.add(key);
            }
        }
    });

    rows.forEach(row => {
        Object.keys(row || {}).forEach(key => {
            const normalized = key.toLowerCase();
            if (seen.has(key) || exclude.has(normalized)) return;
            columns.push(key);
            seen.add(key);
        });
    });

    return columns.filter(Boolean);
}

function formatWpdColumnName(key) {
    let name = String(key).replace(/_/g, ' ');
    
    // Abbreviate common long words for a compact table header
    const abbreviations = {
        'distribution': 'Dist.',
        'sterilization': 'Ster.',
        'subcenter': 'SC',
        'sub center': 'SC',
        'subcentre': 'SC',
        'facility name': 'Facility',
        'reporting unit': 'Facility',
        'number of': 'No.',
        'condom': 'Cndm',
        'injectable': 'Inj.',
        'contraceptive': 'Contra.',
        'population': 'Pop.'
    };
    
    for (const [full, abbr] of Object.entries(abbreviations)) {
        const regex = new RegExp(`\\b${full}\\b`, 'gi');
        name = name.replace(regex, abbr);
    }

    return name.replace(/\b\w/g, char => char.toUpperCase());
}

function formatWpdCellValue(value) {
    if (value === null || value === undefined || value === '') return '-';
    if (typeof value === 'number') return value.toLocaleString();
    return String(value);
}

async function fetchWpdData() {
    const dashContainer = document.getElementById('wpdTableBody');
    if (dashContainer) {
        dashContainer.innerHTML = '<tr class="loading-row"><td colspan="8"><i class="fas fa-spinner fa-spin"></i> Loading WPD data...</td></tr>';
    }

    if (guardSupabaseAccess(dashContainer, 'Supabase is not available. The WPD report cannot load in this browser session.')) {
        return;
    }

    try {
        const tableCandidates = ['wpf_service_delivery_subcenter'];
        let data = [];
        let lastError = null;
        let usedTable = '';

        for (const tableName of tableCandidates) {
            try {
                const { data: tableData, error } = await supabaseClient
                    .from(tableName)
                    .select('*')
                    .order('sub_center', { ascending: true })
                    .limit(5000);

                if (error) {
                    lastError = error;
                    continue;
                }

                if (Array.isArray(tableData) && tableData.length > 0) {
                    data = tableData;
                    usedTable = tableName;
                    break;
                }

                if (Array.isArray(tableData) && tableData.length === 0) {
                    lastError = { message: `Table ${tableName} returned no rows.` };
                }
            } catch (innerError) {
                lastError = innerError;
            }
        }

        if (data.length === 0) {
            wpdData = [];
            populateWpdFilters();
            applyWpdFilters();
            const dashEl = document.getElementById('wpdTableBody');
            if (dashEl) dashEl.innerHTML = '<tr class="no-data-row"><td colspan="8" class="text-center" style="padding:2rem">No WPF records have been submitted yet.</td></tr>';
            return;
        }

        wpdData = data;
        populateWpdFilters();
        applyWpdFilters();
    } catch (error) {
        console.error('Error fetching WPD data:', error);
        const dashEl = document.getElementById('wpdTableBody');
        if (dashEl) dashEl.innerHTML = '<tr class="no-data-row"><td colspan="8" style="color:var(--color-maroon);font-weight:600;padding:2rem">Error loading WPD data: ' + (error.message || 'Check Supabase connection.') + '</td></tr>';
    }
}

// --- WPD Multi-Select State ---
let selectedWpdDates = new Set();
let selectedWpdFacilities = new Set();
let allWpdDates = [];
let allWpdFacilities = [];

function populateWpdFilters() {
    if (!filterWpdYear || !filterWpdMonth) return;

    const selectedYear = filterWpdYear.value || '';
    const selectedMonth = filterWpdMonth.value || '';

    const years = [...new Set(wpdData.map(row => {
        let dateVal = getWpdRowValue(row, ['date_of_reporting', 'reporting_date', 'date']);
        if (dateVal) {
            let d = new Date(dateVal);
            if (!isNaN(d)) return d.getFullYear();
        }
        return getWpdRowValue(row, ['reporting_year', 'year']);
    }).filter(Boolean))].map(v => String(v)).sort((a, b) => Number(b) - Number(a));

    const months = [...new Set(wpdData.map(row => {
        let dateVal = getWpdRowValue(row, ['date_of_reporting', 'reporting_date', 'date']);
        if (dateVal) {
            let d = new Date(dateVal);
            if (!isNaN(d)) {
                return String(d.getMonth() + 1).padStart(2, '0');
            }
        }
        return getWpdRowValue(row, ['reporting_month', 'month']);
    }).filter(Boolean))].map(v => String(v).padStart(2, '0')).sort();
    
    // Update global lists for Dates and Facilities based on data
    allWpdFacilities = [...new Set(wpdData.map(row => getWpdRowValue(row, ['facility', 'facility_name', 'reporting_unit', 'subcenter', 'sub_center_name', 'subcenter_name', 'subcentre', 'sub_center'])).filter(Boolean))]
        .map(v => String(v))
        .sort((a, b) => a.localeCompare(b));
    allWpdDates = [...new Set(wpdData.map(row => getWpdRowValue(row, ['date_of_reporting', 'reporting_date', 'date'])).filter(Boolean))]
        .map(v => String(v))
        .sort((a, b) => new Date(b) - new Date(a));

    filterWpdYear.innerHTML = '<option value="">All Years</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
    filterWpdMonth.innerHTML = '<option value="">All Months</option>' + months.map(m => `<option value="${m}">${m}</option>`).join('');
    filterWpdYear.value = years.includes(selectedYear) ? selectedYear : '';
    filterWpdMonth.value = months.includes(selectedMonth) ? selectedMonth : '';

    // Initialize all selections if they are empty (first load)
    if (selectedWpdFacilities.size === 0 && allWpdFacilities.length > 0) {
        allWpdFacilities.forEach(f => selectedWpdFacilities.add(f));
    }
    if (selectedWpdDates.size === 0 && allWpdDates.length > 0) {
        allWpdDates.forEach(d => selectedWpdDates.add(d));
    }

    populateWpdDateCheckboxes();
    populateWpdFacilityCheckboxes();
}

// --- WPD Date Multi-Select ---
function populateWpdDateCheckboxes() {
    const container = document.getElementById('wpdDateOptionsList');
    if(!container) return;
    container.innerHTML = allWpdDates.map(d => {
        const checked = selectedWpdDates.has(d) ? 'checked' : '';
        const safeId = 'wpddate_' + d.replace(/[^a-zA-Z0-9]/g, '_');
        return `
            <div class="multiselect-option" onclick="toggleWpdDateCheckbox('${d.replace(/'/g, "\\'")}', event)">
                <input type="checkbox" id="${safeId}" ${checked} data-date="${d}">
                <label for="${safeId}">${d}</label>
            </div>
        `;
    }).join('');
    updateWpdDateLabel();
}

function updateWpdDateLabel() {
    const label = document.getElementById('wpdDateMultiselectLabel');
    const badge = document.getElementById('wpdDateMultiselectBadge');
    const selectAllCb = document.getElementById('wpdDateSelectAll');
    if(!label) return;
    
    const count = selectedWpdDates.size;
    const total = allWpdDates.length;

    if (count === 0) {
        label.textContent = 'None Selected';
        badge.style.display = 'inline-block';
        badge.textContent = '0';
        if (selectAllCb) selectAllCb.checked = false;
    } else if (count === total && total > 0) {
        label.textContent = 'All Dates';
        badge.style.display = 'none';
        if (selectAllCb) selectAllCb.checked = true;
    } else {
        const first = [...selectedWpdDates].sort()[0];
        label.textContent = count === 1 ? first : `${first} +${count - 1}`;
        badge.style.display = 'inline-block';
        badge.textContent = count;
        if (selectAllCb) selectAllCb.indeterminate = true;
    }
}

window.toggleWpdDateDropdown = function () {
    const dropdown = document.getElementById('wpdDateMultiselect');
    dropdown.classList.toggle('open');
    if (dropdown.classList.contains('open')) {
        setTimeout(() => document.getElementById('wpdDateSearchInput').focus(), 50);
    }
}

// Toggle WPD Filter Section (Collapsible Card)
window.toggleWpdFilterSection = function () {
    const filterCard = document.getElementById('wpdFilterCard') || document.querySelector('.wpd-filter-card');
    if (filterCard) {
        filterCard.classList.toggle('expanded');
    }
}


window.toggleWpdDateCheckbox = function (date, event) {
    if (event.target.tagName === 'INPUT') {
        if (event.target.checked) selectedWpdDates.add(date);
        else selectedWpdDates.delete(date);
    } else {
        if (selectedWpdDates.has(date)) selectedWpdDates.delete(date);
        else selectedWpdDates.add(date);
        const cb = event.currentTarget.querySelector('input[type="checkbox"]');
        if (cb) cb.checked = selectedWpdDates.has(date);
    }
    updateWpdDateLabel();
    applyWpdFilters();
}

window.toggleAllWpdDates = function () {
    const selectAllCb = document.getElementById('wpdDateSelectAll');
    const allChecked = selectedWpdDates.size === allWpdDates.length;
    if (allChecked) {
        selectedWpdDates.clear();
        selectAllCb.checked = false;
    } else {
        allWpdDates.forEach(d => selectedWpdDates.add(d));
        selectAllCb.checked = true;
    }
    selectAllCb.indeterminate = false;
    document.querySelectorAll('#wpdDateOptionsList input[type="checkbox"]').forEach(cb => {
        cb.checked = selectedWpdDates.has(cb.dataset.date);
    });
    updateWpdDateLabel();
    applyWpdFilters();
}

window.filterWpdDateOptions = function () {
    const query = document.getElementById('wpdDateSearchInput').value.toLowerCase();
    document.querySelectorAll('#wpdDateOptionsList .multiselect-option').forEach(opt => {
        const label = opt.querySelector('label');
        opt.style.display = (label && label.textContent.toLowerCase().includes(query)) ? '' : 'none';
    });
}

// --- WPD Facility Multi-Select ---
function populateWpdFacilityCheckboxes() {
    const container = document.getElementById('wpdFacilityOptionsList');
    if(!container) return;
    container.innerHTML = allWpdFacilities.map(f => {
        const checked = selectedWpdFacilities.has(f) ? 'checked' : '';
        const safeId = 'wpdfac_' + f.replace(/[^a-zA-Z0-9]/g, '_');
        return `
            <div class="multiselect-option" onclick="toggleWpdFacilityCheckbox('${f.replace(/'/g, "\\'")}', event)">
                <input type="checkbox" id="${safeId}" ${checked} data-facility="${f}">
                <label for="${safeId}">${f}</label>
            </div>
        `;
    }).join('');
    updateWpdFacilityLabel();
}

function updateWpdFacilityLabel() {
    const label = document.getElementById('wpdFacilityMultiselectLabel');
    const badge = document.getElementById('wpdFacilityMultiselectBadge');
    const selectAllCb = document.getElementById('wpdFacilitySelectAll');
    if(!label) return;
    
    const count = selectedWpdFacilities.size;
    const total = allWpdFacilities.length;

    if (count === 0) {
        label.textContent = 'None Selected';
        badge.style.display = 'inline-block';
        badge.textContent = '0';
        if (selectAllCb) selectAllCb.checked = false;
    } else if (count === total && total > 0) {
        label.textContent = 'All Facilities';
        badge.style.display = 'none';
        if (selectAllCb) selectAllCb.checked = true;
    } else {
        const first = [...selectedWpdFacilities].sort()[0];
        label.textContent = count === 1 ? first : `${first} +${count - 1}`;
        badge.style.display = 'inline-block';
        badge.textContent = count;
        if (selectAllCb) selectAllCb.indeterminate = true;
    }
}

window.toggleWpdFacilityDropdown = function () {
    const dropdown = document.getElementById('wpdFacilityMultiselect');
    dropdown.classList.toggle('open');
    if (dropdown.classList.contains('open')) {
        setTimeout(() => document.getElementById('wpdFacilitySearchInput').focus(), 50);
    }
}

window.toggleWpdFacilityCheckbox = function (facility, event) {
    if (event.target.tagName === 'INPUT') {
        if (event.target.checked) selectedWpdFacilities.add(facility);
        else selectedWpdFacilities.delete(facility);
    } else {
        if (selectedWpdFacilities.has(facility)) selectedWpdFacilities.delete(facility);
        else selectedWpdFacilities.add(facility);
        const cb = event.currentTarget.querySelector('input[type="checkbox"]');
        if (cb) cb.checked = selectedWpdFacilities.has(facility);
    }
    updateWpdFacilityLabel();
    applyWpdFilters();
}

window.toggleAllWpdFacilities = function () {
    const selectAllCb = document.getElementById('wpdFacilitySelectAll');
    const allChecked = selectedWpdFacilities.size === allWpdFacilities.length;
    if (allChecked) {
        selectedWpdFacilities.clear();
        selectAllCb.checked = false;
    } else {
        allWpdFacilities.forEach(f => selectedWpdFacilities.add(f));
        selectAllCb.checked = true;
    }
    selectAllCb.indeterminate = false;
    document.querySelectorAll('#wpdFacilityOptionsList input[type="checkbox"]').forEach(cb => {
        cb.checked = selectedWpdFacilities.has(cb.dataset.facility);
    });
    updateWpdFacilityLabel();
    applyWpdFilters();
}

window.filterWpdFacilityOptions = function () {
    const query = document.getElementById('wpdFacilitySearchInput').value.toLowerCase();
    document.querySelectorAll('#wpdFacilityOptionsList .multiselect-option').forEach(opt => {
        const label = opt.querySelector('label');
        opt.style.display = (label && label.textContent.toLowerCase().includes(query)) ? '' : 'none';
    });
}

// Close multi-select dropdowns on outside click (WPD)
document.addEventListener('click', function (e) {
    const dateDropdown = document.getElementById('wpdDateMultiselect');
    if (dateDropdown && !dateDropdown.contains(e.target)) dateDropdown.classList.remove('open');
    const facDropdown = document.getElementById('wpdFacilityMultiselect');
    if (facDropdown && !facDropdown.contains(e.target)) facDropdown.classList.remove('open');
});

window.handleWpdFilterChange = function () {
    applyWpdFilters();
}

function applyWpdFilters() {
    const fYear = filterWpdYear ? (filterWpdYear.value || '') : '';
    const fMonth = filterWpdMonth ? (filterWpdMonth.value || '') : '';

    filteredWpdData = wpdData.filter(row => {
        let yearValue = getWpdRowValue(row, ['reporting_year', 'year']);
        let monthValue = getWpdRowValue(row, ['reporting_month', 'month']);
        
        let dateVal = getWpdRowValue(row, ['date_of_reporting', 'reporting_date', 'date']);
        if (dateVal) {
            let d = new Date(dateVal);
            if (!isNaN(d)) {
                yearValue = String(d.getFullYear());
                monthValue = String(d.getMonth() + 1).padStart(2, '0');
            }
        }
        
        const facilityValue = String(getWpdRowValue(row, ['facility', 'facility_name', 'reporting_unit', 'subcenter', 'sub_center_name', 'subcenter_name', 'subcentre', 'sub_center']));
        const dateValue = String(getWpdRowValue(row, ['date_of_reporting', 'reporting_date', 'date']));

        if (fYear && String(yearValue) !== fYear) return false;
        if (fMonth && String(monthValue) !== fMonth) return false;
        if (selectedWpdFacilities.size > 0 && !selectedWpdFacilities.has(facilityValue)) return false;
        if (selectedWpdDates.size > 0 && !selectedWpdDates.has(dateValue)) return false;
        return true;
    });

    const totalRowsEl = document.getElementById('wpdTotalRows');
    if (totalRowsEl) totalRowsEl.textContent = filteredWpdData.length;

    drawWpdTable();
    
}

function groupWpdColumns(columns) {
    const groups = [];

    // Normalize inverted or prefix-less database columns to the baseName_suffix format
    const normalizeColName = (col) => {
        const c = String(col).toLowerCase().trim();
        
        // Motivation
        if (c === 'male_motivated_sterilization') return { normalized: 'motivation_male_for_nsv', original: col };
        if (c === 'female_motivated_sterilization') return { normalized: 'motivation_female_for_minilap', original: col };
        
        // Sterilization
        if (c === 'male_sterilization_conducted') return { normalized: 'sterilization_male', original: col };
        if (c === 'female_sterilization_conducted') return { normalized: 'sterilization_female', original: col };
        
        // IUCD Insertion
        if (c === 'interval_iucd_insertions') return { normalized: 'iucd_insertion_interval', original: col };
        if (c === 'ppiucd_insertions') return { normalized: 'iucd_insertion_ppiucd', original: col };
        if (c === 'paiucd_insertions') return { normalized: 'iucd_insertion_paiucd', original: col };

        // Expand contraceptives to match screenshot parent headers
        if (c.startsWith('condoms_')) return { normalized: c.replace('condoms_', 'condom_pieces_distributed_'), original: col };
        if (c.startsWith('mala_n_')) return { normalized: c.replace('mala_n_', 'strips_mala_n_distributed_'), original: col };
        if (c.startsWith('chayya_')) return { normalized: c.replace('chayya_', 'strips_of_chayya_distributed_'), original: col };
        if (c.startsWith('ecp_')) return { normalized: c.replace('ecp_', 'ecp_pills_distributed_'), original: col };

        return { normalized: col, original: col };
    };

    // Regex to match base name and known suffixes
    const groupRegex = /^(.+?)[_\s]+(\d(?:st|nd|rd|th)?(?:\s*dose)?|\d+|asha|facility|self[\s_]*care(?:[\s_]*boxes)?|outreach[\s_]*sessions|outreach|male[\s_]*for[\s_]*nsv|female[\s_]*for[\s_]*minilap|male|female|interval|ppiucd|paiucd)$/i;
    const groupMap = {};
    
    columns.forEach(col => {
        const info = normalizeColName(col);
        const match = info.normalized.match(groupRegex);
        if (match) {
            const baseName = match[1].trim();
            const suffix = match[2].trim();
            if (!groupMap[baseName]) groupMap[baseName] = [];
            groupMap[baseName].push({ original: info.original, suffix: suffix });
        } else {
            if (!groupMap[col]) groupMap[col] = [];
            groupMap[col].push({ original: col, suffix: col });
        }
    });

    const seenBase = new Set();
    columns.forEach(col => {
        const info = normalizeColName(col);
        const match = info.normalized.match(groupRegex);
        const baseName = match ? match[1].trim() : col;
        
        if (!seenBase.has(baseName)) {
            seenBase.add(baseName);
            const items = groupMap[baseName];
            if (items.length > 1) {
                const groupDef = {
                    isGroup: true,
                    name: baseName,
                    columns: items.map(i => ({ original: i.original, label: i.suffix }))
                };
                // Inject synthetic Total column
                groupDef.columns.push({
                    original: baseName + '_total',
                    label: 'Total',
                    isComputedTotal: true,
                    parentGroup: groupDef
                });
                groups.push(groupDef);
            } else {
                groups.push({
                    isGroup: false,
                    name: col,
                    columns: [{ original: col, label: col }]
                });
            }
        }
    });
    return groups;
}

function drawWpdTable() {
    const thead = document.getElementById('wpdTableHead');
    const tbody = document.getElementById('wpdTableBody');
    const tfoot = document.getElementById('wpdTableFoot');
    if (!thead || !tbody) return;

    thead.innerHTML = '';
    tbody.innerHTML = '';
    if (tfoot) tfoot.innerHTML = '';
    wpdStatMetrics = {};

    if (!filteredWpdData || filteredWpdData.length === 0) {
        thead.innerHTML = '<tr><th colspan="8">No WPD data matches the current filters.</th></tr>';
        return;
    }

    const textFields = ['facility','facility_name','reporting_unit','subcenter','sub_center_name','subcenter_name','subcentre','sub_center'];
    const columns = getWpdDisplayColumns(filteredWpdData);
    const groups = groupWpdColumns(columns);

    // Build flat list of data columns (skip text identifiers & computed totals)
    const flatCols = groups.flatMap(g => {
        if (g.isGroup) return g.columns.filter(c => !c.isComputedTotal);
        return textFields.includes((g.original || '').toLowerCase()) ? [] : [g];
    });

    // Find facility column (first text col)
    const facilityCol = columns.find(c => textFields.includes(c.toLowerCase())) || null;

    // ---- Aggregate per-facility for modal ----
    const facilityAgg = {};
    filteredWpdData.forEach(row => {
        const fac = getWpdRowValue(row, textFields) || 'Unknown';
        if (!facilityAgg[fac]) facilityAgg[fac] = {};
        flatCols.forEach(colDef => {
            if (!wpdStatMetrics[colDef.label]) wpdStatMetrics[colDef.label] = { data: [] };
            if (facilityAgg[fac][colDef.label] === undefined) facilityAgg[fac][colDef.label] = 0;
            const v = Number(getWpdRowValue(row, [colDef.original]));
            if (!isNaN(v)) facilityAgg[fac][colDef.label] += v;
        });
    });
    for (const fac in facilityAgg)
        for (const m in facilityAgg[fac])
            if (wpdStatMetrics[m]) wpdStatMetrics[m].data.push({ facility: fac, value: facilityAgg[fac][m] });
    for (const m in wpdStatMetrics)
        wpdStatMetrics[m].data.sort((a, b) => b.value - a.value);

    // ---- Build header rows ----
    const hasGroups = groups.some(g => g.isGroup);
    let topRow = '<tr>';
    let subRow = '<tr>';

    // Sl No
    topRow += `<th rowspan="${hasGroups ? 2 : 1}" class="freeze-col-1 text-center" style="min-width:36px;max-width:40px">#</th>`;

    // Facility
    if (facilityCol) {
        topRow += `<th rowspan="${hasGroups ? 2 : 1}" class="freeze-col-2 text-left" style="min-width:120px">Facility</th>`;
    }

    groups.forEach(group => {
        if (group.isGroup) {
            const dataCols = group.columns.filter(c => !c.isComputedTotal);
            if (!dataCols.length) return;
            const safeGrp = (group.name || '').replace(/'/g, "\\'");
            topRow += `<th colspan="${dataCols.length}" class="text-center" style="cursor:pointer;white-space:nowrap" onclick="openWpdModal('${safeGrp}')" title="Click for Top/Bottom 5">${formatWpdColumnName(group.name)} <i class='fas fa-chart-bar' style='font-size:0.65em;opacity:0.7'></i></th>`;
            dataCols.forEach(col => {
                const safeL = (col.label || '').replace(/'/g, "\\'");
                subRow += `<th class="text-center" style="font-size:0.7rem;min-width:54px;cursor:pointer;white-space:nowrap" onclick="openWpdModal('${safeL}')" title="Click for Top/Bottom 5">${col.label.toUpperCase()}</th>`;
            });
        } else {
            if (textFields.includes((group.original || '').toLowerCase())) return;
            const safeL = (group.label || group.name || '').replace(/'/g, "\\'");
            topRow += `<th rowspan="${hasGroups ? 2 : 1}" class="text-center" style="min-width:60px;cursor:pointer;white-space:nowrap" onclick="openWpdModal('${safeL}')" title="Click for Top/Bottom 5">${formatWpdColumnName(group.name)} <i class='fas fa-chart-bar' style='font-size:0.65em;opacity:0.7'></i></th>`;
        }
    });
    topRow += '<th rowspan="' + (hasGroups ? 2 : 1) + '" class="text-center" style="min-width:60px">Actions</th></tr>';
    subRow += '</tr>';
    thead.innerHTML = hasGroups ? (topRow + subRow) : topRow;

    // ---- Build body rows ----
    const colTotals = {};
    flatCols.forEach(c => colTotals[c.label] = 0);

    const rows = filteredWpdData.map((row, idx) => {
        let cells = `<td class="freeze-col-1 text-center" style="font-size:0.72rem">${idx + 1}</td>`;
        if (facilityCol) {
            const facVal = getWpdRowValue(row, textFields) || '-';
            cells += `<td class="freeze-col-2" style="font-weight:600;font-size:0.78rem;white-space:nowrap;max-width:160px;overflow:hidden;text-overflow:ellipsis" title="${facVal}">${facVal}</td>`;
        }
        flatCols.forEach(colDef => {
            const v = Number(getWpdRowValue(row, [colDef.original]));
            const display = isNaN(v) ? '-' : v.toLocaleString();
            if (!isNaN(v)) colTotals[colDef.label] += v;
            cells += `<td class="text-center" style="font-size:0.78rem">${display}</td>`;
        });
        cells += `<td class="text-center" style="white-space:nowrap">
            <button class="btn-action-edit" onclick="openEditWpdModal(${row.id})" title="Edit"><i class="fas fa-edit"></i></button>
            <button class="btn-action-delete" onclick="openDeleteWpdConfirm(${row.id})" title="Delete"><i class="fas fa-trash"></i></button>
        </td>`;
        return `<tr>${cells}</tr>`;
    });
    tbody.innerHTML = rows.join('');

    // ---- Build footer (grand total) ----
    if (tfoot) {
        let footCells = `<th class="freeze-col-1 text-center" style="font-size:0.72rem">-</th>`;
        if (facilityCol) footCells += `<th class="freeze-col-2" style="font-size:0.78rem;font-weight:800">TOTAL</th>`;
        flatCols.forEach(colDef => {
            footCells += `<td class="text-center" style="font-size:0.78rem;font-weight:700">${colTotals[colDef.label].toLocaleString()}</td>`;
        });
        footCells += '<td></td>';
        tfoot.innerHTML = `<tr class="grand-total-row">${footCells}</tr>`;
    }
}

// --- WPD CRUD Operations ---
let wpdRecordToDeleteId = null;

window.openEditWpdModal = function (id) {
    const record = wpdData.find(r => r.id === id);
    if (!record) return;

    document.getElementById('edit-wpd-id').value = record.id;
    const container = document.getElementById('editWpdFieldsContainer');
    container.innerHTML = '';

    const nonEditableFields = ['id', 'created_at', 'updated_at', 'inserted_at', 'updated_on', 'timestamp'];
    
    Object.keys(record).forEach(key => {
        if (nonEditableFields.includes(key.toLowerCase())) return;
        
        const value = record[key] !== null && record[key] !== undefined ? record[key] : '';
        const isReadonly = ['facility', 'sub_center', 'reporting_unit', 'gp', 'year', 'month'].includes(key.toLowerCase());
        
        let inputType = 'text';
        if (typeof value === 'number' || (value !== '' && !isNaN(value) && !isNaN(parseFloat(value)))) {
            inputType = 'number';
        } else if (key.toLowerCase().includes('date')) {
            inputType = 'date';
        }

        const div = document.createElement('div');
        div.className = 'flex flex-col gap-1.5';
        div.innerHTML = `
            <label class="text-[11px] font-bold text-gray-500 uppercase tracking-wider">${formatWpdColumnName(key)}</label>
            <input type="${inputType}" name="${key}" value="${value}" 
                class="w-full px-3 border border-gray-300 rounded-md text-sm font-semibold py-2 ${isReadonly ? 'text-gray-700 bg-gray-100 cursor-not-allowed outline-none' : 'text-gray-800 focus:outline-none focus:border-maroon focus:ring-1 focus:ring-maroon'}" 
                ${isReadonly ? 'readonly' : 'required'}>
        `;
        container.appendChild(div);
    });

    document.getElementById('editWpdModal').classList.add('active');
}

window.closeEditWpdModal = function () {
    document.getElementById('editWpdModal').classList.remove('active');
}

window.saveWpdRecord = async function (event) {
    event.preventDefault();
    const id = document.getElementById('edit-wpd-id').value;
    const form = document.getElementById('editWpdForm');
    const btnSave = document.getElementById('btnSaveWpdRecord');
    
    btnSave.disabled = true;
    btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    const formData = new FormData(form);
    const updatedData = {};
    
    formData.forEach((value, key) => {
        if (key === 'id') return;
        // Basic type inference
        if (value !== '' && !isNaN(value)) {
            updatedData[key] = Number(value);
        } else {
            updatedData[key] = value;
        }
    });

    try {
        const { error } = await supabaseClient
            .from('wpf_service_delivery_subcenter') // primary WPD table
            .update(updatedData)
            .eq('id', id);

        if (error) throw error;

        showToast('WPD Record updated successfully!');
        closeEditWpdModal();
        fetchWpdData(); // Reload
    } catch (error) {
        console.error('Error updating WPD record:', error);
        showToast('Failed to update record: ' + error.message, 'error');
    } finally {
        btnSave.disabled = false;
        btnSave.innerHTML = 'Save Changes';
    }
}

window.openDeleteWpdConfirm = function (id) {
    wpdRecordToDeleteId = id;
    document.getElementById('confirmWpdModal').classList.add('active');
}

window.closeWpdConfirmModal = function () {
    document.getElementById('confirmWpdModal').classList.remove('active');
    wpdRecordToDeleteId = null;
}

window.executeDeleteWpdRecord = async function () {
    if (!wpdRecordToDeleteId) return;

    const btnDelete = document.getElementById('btnConfirmWpdDelete');
    btnDelete.disabled = true;
    btnDelete.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';

    try {
        const { error } = await supabaseClient
            .from('wpf_service_delivery_subcenter')
            .delete()
            .eq('id', wpdRecordToDeleteId);

        if (error) throw error;

        showToast('WPD Record deleted successfully!');
        closeWpdConfirmModal();
        fetchWpdData(); // Reload
    } catch (error) {
        console.error('Error deleting WPD record:', error);
        showToast('Failed to delete record: ' + error.message, 'error');
    } finally {
        btnDelete.disabled = false;
        btnDelete.innerHTML = 'Yes, Delete';
    }
}

// --- WPD Defaulters Tracking ---
window.openWpdDefaultersModal = function () {
    const container = document.getElementById('wpdDefaultersListContainer');
    if (!container) return;

    // Get unique facilities present in the currently filtered WPD data
    const submittedFacilities = new Set(
        filteredWpdData.map(row => String(getWpdRowValue(row, ['facility', 'facility_name', 'reporting_unit', 'subcenter', 'sub_center_name', 'subcenter_name', 'subcentre', 'sub_center'])).trim().toLowerCase())
    );

    // Find which of the default_units are NOT in the submitted list
    const defaulters = default_units.filter(unit => !submittedFacilities.has(unit.trim().toLowerCase()));

    if (defaulters.length === 0) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center py-6 text-emerald-600">
                <i class="fas fa-check-circle text-3xl mb-2"></i>
                <p class="text-sm font-semibold">All facilities have submitted WPD data!</p>
            </div>
        `;
    } else {
        container.innerHTML = defaulters.sort().map(f => `
            <div class="flex items-center gap-3 p-3 bg-red-50 border border-red-100 rounded-md">
                <div class="w-2 h-2 rounded-full bg-red-500"></div>
                <span class="text-sm font-semibold text-gray-800">${f}</span>
                <span class="ml-auto text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">Not Submitted</span>
            </div>
        `).join('');
    }

    document.getElementById('defaultersWpdModal').classList.add('active');
}

window.closeWpdDefaultersModal = function () {
    document.getElementById('defaultersWpdModal').classList.remove('active');
}

window.exportWpdToExcel = function () {
    if (filteredWpdData.length === 0) {
        showToast('No WPD data to export!', 'error');
        return;
    }

    const columns = getWpdDisplayColumns(filteredWpdData);
    const groups = groupWpdColumns(columns);
    const flatColumns = groups.flatMap(g => g.columns);
    const hasAnyGroups = groups.some(g => g.isGroup);

    const aoa = [];
    const topHeaderRow = ['Sl No'];
    const bottomHeaderRow = [''];
    const merges = [];
    let currentColIdx = 1;

    if (hasAnyGroups) merges.push({ s: { r: 0, c: 0 }, e: { r: 1, c: 0 } });

    groups.forEach(group => {
        if (group.isGroup) {
            topHeaderRow.push(formatWpdColumnName(group.name));
            for (let i = 1; i < group.columns.length; i++) topHeaderRow.push('');
            merges.push({ s: { r: 0, c: currentColIdx }, e: { r: 0, c: currentColIdx + group.columns.length - 1 } });
            
            group.columns.forEach(col => bottomHeaderRow.push(col.label.toUpperCase()));
            currentColIdx += group.columns.length;
        } else {
            topHeaderRow.push(formatWpdColumnName(group.name));
            bottomHeaderRow.push('');
            if (hasAnyGroups) merges.push({ s: { r: 0, c: currentColIdx }, e: { r: 1, c: currentColIdx } });
            currentColIdx++;
        }
    });

    aoa.push(topHeaderRow);
    if (hasAnyGroups) aoa.push(bottomHeaderRow);

    const totals = {};
    flatColumns.forEach(col => totals[col.original] = 0);

    filteredWpdData.forEach((row, index) => {
        const dataRow = [index + 1];
        flatColumns.forEach(colDef => {
            let rawVal = 0;
            if (colDef.isComputedTotal) {
                colDef.parentGroup.columns.forEach(childCol => {
                    if (!childCol.isComputedTotal) {
                        const childVal = Number(getWpdRowValue(row, [childCol.original]));
                        if (!isNaN(childVal)) rawVal += childVal;
                    }
                });
            } else {
                rawVal = getWpdRowValue(row, [colDef.original]);
            }
            const numVal = Number(rawVal);
            if (!isNaN(numVal) && rawVal !== '' && rawVal !== null && rawVal !== undefined) totals[colDef.original] += numVal;
            dataRow.push(rawVal);
        });
        aoa.push(dataRow);
    });

    const totalRow = ['Total'];
    flatColumns.forEach(colDef => {
        const isLikelyNumeric = !['facility', 'facility_name', 'reporting_unit', 'subcenter', 'sub_center_name', 'subcenter_name', 'subcentre', 'sub_center'].includes(colDef.original.toLowerCase());
        totalRow.push(isLikelyNumeric ? totals[colDef.original] : '');
    });
    aoa.push(totalRow);

    const worksheet = XLSX.utils.aoa_to_sheet(aoa);
    if (merges.length > 0) worksheet['!merges'] = merges;
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'WPD Report');
    XLSX.writeFile(workbook, `WPD_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

window.exportWpdToPDF = function () {
    if (filteredWpdData.length === 0) {
        showToast('No WPD data to export!', 'error');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(122, 28, 49);
    doc.text('WPD Report', 14, 15);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 21);

    const columns = getWpdDisplayColumns(filteredWpdData);
    const groups = groupWpdColumns(columns);
    const flatColumns = groups.flatMap(g => g.columns);
    const hasAnyGroups = groups.some(g => g.isGroup);

    const headTop = [{ content: 'Sl No', rowSpan: hasAnyGroups ? 2 : 1, styles: { halign: 'center', valign: 'middle' } }];
    const headBottom = [];

    groups.forEach(group => {
        if (group.isGroup) {
            headTop.push({ content: formatWpdColumnName(group.name), colSpan: group.columns.length, styles: { halign: 'center' } });
            group.columns.forEach(col => {
                headBottom.push({ content: col.label.toUpperCase(), styles: { halign: 'center' } });
            });
        } else {
            headTop.push({ content: formatWpdColumnName(group.name), rowSpan: hasAnyGroups ? 2 : 1, styles: { halign: 'center', valign: 'middle' } });
        }
    });

    const headers = hasAnyGroups ? [headTop, headBottom] : [headTop];

    const totals = {};
    flatColumns.forEach(col => totals[col.original] = 0);

    const tableData = filteredWpdData.map((row, index) => {
        const dataRow = [index + 1];
        flatColumns.forEach(colDef => {
            let rawVal = 0;
            if (colDef.isComputedTotal) {
                colDef.parentGroup.columns.forEach(childCol => {
                    if (!childCol.isComputedTotal) {
                        const childVal = Number(getWpdRowValue(row, [childCol.original]));
                        if (!isNaN(childVal)) rawVal += childVal;
                    }
                });
            } else {
                rawVal = getWpdRowValue(row, [colDef.original]);
            }
            const numVal = Number(rawVal);
            if (!isNaN(numVal) && rawVal !== '' && rawVal !== null && rawVal !== undefined) totals[colDef.original] += numVal;
            dataRow.push(formatWpdCellValue(rawVal));
        });
        return dataRow;
    });

    const footData = [{ content: 'Total', styles: { fontStyle: 'bold', halign: 'center', fillColor: [240, 240, 240], textColor: [122, 28, 49] } }];
    flatColumns.forEach(colDef => {
        const isLikelyNumeric = !['facility', 'facility_name', 'reporting_unit', 'subcenter', 'sub_center_name', 'subcenter_name', 'subcentre', 'sub_center'].includes(colDef.original.toLowerCase());
        footData.push({ 
            content: isLikelyNumeric ? totals[colDef.original].toLocaleString() : '',
            styles: { fontStyle: 'bold', halign: 'center', fillColor: [240, 240, 240], textColor: [122, 28, 49] }
        });
    });

    doc.autoTable({
        startY: 25,
        head: headers,
        body: tableData,
        foot: [footData],
        theme: 'grid',
        headStyles: { fillColor: [122, 28, 49], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold', halign: 'center' },
        bodyStyles: { fontSize: 7.5, textColor: [50, 50, 50], halign: 'center' },
        footStyles: { fontSize: 8, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 248, 248] },
        margin: { top: 25, bottom: 15, left: 10, right: 10 }
    });

    doc.save(`WPD_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ----------------------------------------------------
// EXPORT TO EXCEL & PDF LOGIC
// ----------------------------------------------------
window.exportEcToExcel = function () {
    if (filteredEcData.length === 0) {
        showToast('No data to export!', 'error');
        return;
    }

    // Format rows
    const rows = filteredEcData.map((row, index) => ({
        'Sl No': index + 1,
        'Date': formatDateDDMMYYYY(row.meeting_date),
        'Facility': row.reporting_unit || '',
        'EC Attended': row.total_ec_attended ?? 0,
        'Teenage EC Attended': row.teenage_ec_attended ?? 0,
        'Female Sterilization': row.female_sterilization ?? 0,
        'Male Sterilization': row.male_sterilization ?? 0,
        'IUCD': row.iucd ?? 0,
        'Antara': row.antara ?? 0,
        'CC': row.cc ?? 0,
        'OP': row.op ?? 0,
        'ECP': row.ecp ?? 0,
        'Chhaya': row.chhaya ?? 0
    }));

    // Append grand totals
    let sumEc = 0, sumTeen = 0, sumFS = 0, sumMS = 0, sumIUCD = 0, sumAnt = 0, sumCC = 0, sumOP = 0, sumECP = 0, sumCh = 0;
    filteredEcData.forEach(r => {
        sumEc += r.total_ec_attended ?? 0;
        sumTeen += r.teenage_ec_attended ?? 0;
        sumFS += r.female_sterilization ?? 0;
        sumMS += r.male_sterilization ?? 0;
        sumIUCD += r.iucd ?? 0;
        sumAnt += r.antara ?? 0;
        sumCC += r.cc ?? 0;
        sumOP += r.op ?? 0;
        sumECP += r.ecp ?? 0;
        sumCh += r.chhaya ?? 0;
    });
    rows.push({
        'Sl No': 'Grand Total',
        'Date': '',
        'Facility': '',
        'EC Attended': sumEc,
        'Teenage EC Attended': sumTeen,
        'Female Sterilization': sumFS,
        'Male Sterilization': sumMS,
        'IUCD': sumIUCD,
        'Antara': sumAnt,
        'CC': sumCC,
        'OP': sumOP,
        'ECP': sumECP,
        'Chhaya': sumCh
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'EC Meeting Report');

    // Set column widths
    const maxColWidth = [{ wch: 8 }, { wch: 12 }, { wch: 22 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }];
    worksheet['!cols'] = maxColWidth;

    XLSX.writeFile(workbook, `EC_Meeting_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

window.exportEcToPDF = function () {
    if (filteredEcData.length === 0) {
        showToast('No data to export!', 'error');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    // Add title
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(122, 28, 49); // Maroon color
    doc.text("EC Meeting Report", 14, 15);

    // Add filters info
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    const fYear = filterYear.value || "All";
    const fMonth = filterMonth.value || "All";
    const fDate = filterDate.value ? formatDateDDMMYYYY(filterDate.value) : "All";
    doc.text(`Filters: Year - ${fYear} | Month - ${fMonth} | Date - ${fDate}   Generated: ${new Date().toLocaleDateString()}`, 14, 21);

    // Table Headers
    const headers = [['Sl No', 'Date', 'Facility', 'EC Att.', 'Teen. EC', 'F. Steril', 'M. Steril', 'IUCD', 'Antara', 'CC', 'OP', 'ECP', 'Chhaya']];

    // Table Data
    const tableData = filteredEcData.map((row, index) => [
        index + 1,
        formatDateDDMMYYYY(row.meeting_date),
        row.reporting_unit || '',
        row.total_ec_attended ?? 0,
        row.teenage_ec_attended ?? 0,
        row.female_sterilization ?? 0,
        row.male_sterilization ?? 0,
        row.iucd ?? 0,
        row.antara ?? 0,
        row.cc ?? 0,
        row.op ?? 0,
        row.ecp ?? 0,
        row.chhaya ?? 0
    ]);

    // Append grand totals
    let sumEc = 0, sumTeen = 0, sumFS = 0, sumMS = 0, sumIUCD = 0, sumAnt = 0, sumCC = 0, sumOP = 0, sumECP = 0, sumCh = 0;
    filteredEcData.forEach(r => {
        sumEc += r.total_ec_attended ?? 0;
        sumTeen += r.teenage_ec_attended ?? 0;
        sumFS += r.female_sterilization ?? 0;
        sumMS += r.male_sterilization ?? 0;
        sumIUCD += r.iucd ?? 0;
        sumAnt += r.antara ?? 0;
        sumCC += r.cc ?? 0;
        sumOP += r.op ?? 0;
        sumECP += r.ecp ?? 0;
        sumCh += r.chhaya ?? 0;
    });
    tableData.push([
        'Grand Total',
        '',
        '',
        sumEc,
        sumTeen,
        sumFS,
        sumMS,
        sumIUCD,
        sumAnt,
        sumCC,
        sumOP,
        sumECP,
        sumCh
    ]);

    // Generate Table
    doc.autoTable({
        startY: 25,
        head: headers,
        body: tableData,
        theme: 'grid',
        headStyles: {
            fillColor: [122, 28, 49], // Maroon
            textColor: [255, 255, 255],
            fontSize: 8.5,
            fontStyle: 'bold',
            halign: 'center'
        },
        bodyStyles: {
            fontSize: 8,
            textColor: [50, 50, 50]
        },
        alternateRowStyles: {
            fillColor: [248, 248, 248]
        },
        columnStyles: {
            0: { cellWidth: 15, halign: 'center' },
            1: { cellWidth: 22, halign: 'center' },
            2: { cellWidth: 42, fontStyle: 'bold' },
            3: { halign: 'center' },
            4: { halign: 'center' },
            5: { halign: 'center' },
            6: { halign: 'center' },
            7: { halign: 'center' },
            8: { halign: 'center' },
            9: { halign: 'center' },
            10: { halign: 'center' },
            11: { halign: 'center' },
            12: { halign: 'center' }
        },
        didParseCell: function (data) {
            // Bold the grand total row
            if (data.row.index === tableData.length - 1) {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.textColor = [122, 28, 49]; // Maroon text
                data.cell.styles.fillColor = [252, 235, 235]; // Light pink bg
            }
        },
        margin: { top: 25, bottom: 15, left: 14, right: 14 }
    });

    // Save PDF
    doc.save(`EC_Meeting_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
}

window.exportDelToExcel = function () {
    if (filteredDeliveryData.length === 0) {
        showToast('No data to export!', 'error');
        return;
    }
    const rows = filteredDeliveryData.map((row, index) => ({
        'Sl No': index + 1,
        'GP': row.gp || '',
        'Facility': row.facility || '',
        'Home Del.': row.delivery_home ?? 0,
        'Govt Del.': row.delivery_govt ?? 0,
        'Pvt Del.': row.delivery_private ?? 0,
        'Normal Del.': row.normal_delivery ?? 0,
        'CS Del.': row.cs_delivery ?? 0,
        'Total Del.': row.total_delivery ?? 0,
        'Live Birth': row.live_birth ?? 0,
        'Still Birth': row.still_birth ?? 0,
        'Abortion': row.total_abortion ?? 0
    }));

    let sumHome = 0, sumGovt = 0, sumPrivate = 0, sumNormal = 0, sumCs = 0, sumTotal = 0, sumLive = 0, sumStill = 0, sumAbortion = 0;
    filteredDeliveryData.forEach(r => {
        sumHome += r.delivery_home ?? 0;
        sumGovt += r.delivery_govt ?? 0;
        sumPrivate += r.delivery_private ?? 0;
        sumNormal += r.normal_delivery ?? 0;
        sumCs += r.cs_delivery ?? 0;
        sumTotal += r.total_delivery ?? 0;
        sumLive += r.live_birth ?? 0;
        sumStill += r.still_birth ?? 0;
        sumAbortion += r.total_abortion ?? 0;
    });
    rows.push({
        'Sl No': 'Grand Total',
        'GP': '',
        'Facility': '',
        'Home Del.': sumHome,
        'Govt Del.': sumGovt,
        'Pvt Del.': sumPrivate,
        'Normal Del.': sumNormal,
        'CS Del.': sumCs,
        'Total Del.': sumTotal,
        'Live Birth': sumLive,
        'Still Birth': sumStill,
        'Abortion': sumAbortion
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Delivery Coverage');

    const maxColWidth = [{ wch: 8 }, { wch: 15 }, { wch: 22 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
    worksheet['!cols'] = maxColWidth;

    XLSX.writeFile(workbook, `Delivery_Coverage_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

window.exportDelToPDF = function () {
    if (filteredDeliveryData.length === 0) {
        showToast('No data to export!', 'error');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(122, 28, 49); // Maroon
    doc.text("Delivery Coverage Report", 14, 15);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    const fYear = filterDelYear.value || "All";
    const fMonth = filterDelMonth.value || "All";
    doc.text(`Filters: Year - ${fYear} | Month - ${fMonth}   Generated: ${new Date().toLocaleDateString()}`, 14, 21);

    const headers = [
        [
            { content: 'Sl No', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
            { content: 'GP', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
            { content: 'Facility', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
            { content: 'Place of delivery', colSpan: 3, styles: { halign: 'center' } },
            { content: 'Method of Delivery', colSpan: 3, styles: { halign: 'center' } },
            { content: 'Pregnancy Outcome', colSpan: 3, styles: { halign: 'center' } }
        ],
        [
            'Home', 'Govt', 'Pvt',
            'Normal', 'CS', 'Total',
            'Live Birth', 'Still Birth', 'Abortion'
        ]
    ];

    const tableData = filteredDeliveryData.map((row, index) => [
        index + 1,
        row.gp || '',
        row.facility || '',
        row.delivery_home ?? 0,
        row.delivery_govt ?? 0,
        row.delivery_private ?? 0,
        row.normal_delivery ?? 0,
        row.cs_delivery ?? 0,
        row.total_delivery ?? 0,
        row.live_birth ?? 0,
        row.still_birth ?? 0,
        row.total_abortion ?? 0
    ]);

    let sumHome = 0, sumGovt = 0, sumPrivate = 0, sumNormal = 0, sumCs = 0, sumTotal = 0, sumLive = 0, sumStill = 0, sumAbortion = 0;
    filteredDeliveryData.forEach(r => {
        sumHome += r.delivery_home ?? 0;
        sumGovt += r.delivery_govt ?? 0;
        sumPrivate += r.delivery_private ?? 0;
        sumNormal += r.normal_delivery ?? 0;
        sumCs += r.cs_delivery ?? 0;
        sumTotal += r.total_delivery ?? 0;
        sumLive += r.live_birth ?? 0;
        sumStill += r.still_birth ?? 0;
        sumAbortion += r.total_abortion ?? 0;
    });
    tableData.push([
        'Grand Total',
        '',
        '',
        sumHome,
        sumGovt,
        sumPrivate,
        sumNormal,
        sumCs,
        sumTotal,
        sumLive,
        sumStill,
        sumAbortion
    ]);

    doc.autoTable({
        startY: 25,
        head: headers,
        body: tableData,
        theme: 'grid',
        headStyles: {
            fillColor: [122, 28, 49], // Maroon
            textColor: [255, 255, 255],
            fontSize: 8.5,
            fontStyle: 'bold',
            halign: 'center'
        },
        bodyStyles: {
            fontSize: 8,
            textColor: [50, 50, 50]
        },
        alternateRowStyles: {
            fillColor: [248, 248, 248]
        },
        columnStyles: {
            0: { cellWidth: 15, halign: 'center' },
            1: { cellWidth: 32 },
            2: { cellWidth: 42, fontStyle: 'bold' },
            3: { halign: 'center' },
            4: { halign: 'center' },
            5: { halign: 'center' },
            6: { halign: 'center' },
            7: { halign: 'center' },
            8: { halign: 'center' },
            9: { halign: 'center' },
            10: { halign: 'center' },
            11: { halign: 'center' }
        },
        didParseCell: function (data) {
            if (data.row.index === tableData.length - 1) {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.textColor = [122, 28, 49]; // Maroon
                data.cell.styles.fillColor = [252, 235, 235]; // Light pink
            }
        },
        margin: { top: 25, bottom: 15, left: 14, right: 14 }
    });

    doc.save(`Delivery_Coverage_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ----------------------------------------------------
// IDCF REPORT VIEW LOGIC (Google Sheet as Database)
// ----------------------------------------------------

// CSV parser no longer needed as we'll use JSON from Apps Script

async function fetchIdcfData() {
    const idcfTableBody = document.getElementById('idcfTableBody');
    idcfTableBody.innerHTML = `
        <tr class="loading-row">
            <td colspan="12"><i class="fas fa-spinner fa-spin"></i> Fetching IDCF data from Google Sheet...</td>
        </tr>
    `;

    try {
        if (!IDCF_SCRIPT_URL) {
            throw new Error('Apps Script URL is missing. Please add it to IDCF_SCRIPT_URL.');
        }

        // Fetch JSON data directly from the deployed Apps Script
        const response = await fetch(IDCF_SCRIPT_URL);
        if (!response.ok) throw new Error('Failed to fetch from Apps Script (HTTP ' + response.status + ')');
        const json = await response.json();

        if (!json.success) {
            throw new Error(json.message || 'Unknown error from Apps Script');
        }

        const rows = json.data || [];

        if (rows.length === 0) {
            idcfData = [];
        } else {
            idcfData = rows.map(row => {
                let reportingYear = '';
                if (row.timestamp) {
                    const d = new Date(row.timestamp);
                    if (!isNaN(d.getTime())) {
                        reportingYear = d.getFullYear().toString();
                    }
                }

                return {
                    _rowIndex: row._rowIndex,
                    timestamp: row.timestamp || '',
                    facility: (row.facility || '').toString().trim(),
                    reporting_year: reportingYear,
                    villages_served: parseInt(row.villages_served) || 0,
                    villages_ors_distributed: parseInt(row.villages_ors_distributed) || 0,
                    children_0_5: parseInt(row.children_0_5) || 0,
                    children_given_ors: parseInt(row.children_given_ors) || 0,
                    children_diarrhea: parseInt(row.children_diarrhea) || 0,
                    diarrhea_children_ors: parseInt(row.diarrhea_children_ors) || 0,
                    diarrhea_children_zinc: parseInt(row.diarrhea_children_zinc) || 0,
                    danger_sign_referred: parseInt(row.danger_sign_referred) || 0,
                    ors_corner_created: (row.ors_corner_created || '').toString().trim(),
                    schools_handwashing: parseInt(row.schools_handwashing) || 0
                };
            });
        }

        updateIdcfDropdowns('init');
        applyIdcfFilters();
    } catch (error) {
        console.error('Error fetching IDCF data:', error);
        idcfTableBody.innerHTML = `
            <tr class="no-data-row">
                <td colspan="12" style="color: var(--color-maroon); font-weight: 600;">
                    Error fetching data: ${error.message}
                </td>
            </tr>
        `;
    }
}

function updateIdcfDropdowns(source) {
    const filterEl = document.getElementById('filterIdcfYear');
    const selYear = filterEl.value || '';

    const yearsSet = new Set();
    idcfData.forEach(row => {
        if (row.reporting_year) yearsSet.add(row.reporting_year);
    });

    if (source === 'init') {
        const yearsArr = Array.from(yearsSet).sort().reverse();
        filterEl.innerHTML = '<option value="">All Years</option>' +
            yearsArr.map(y => `<option value="${y}">${y}</option>`).join('');
        filterEl.value = selYear;
    }
}

window.handleIdcfFilterChange = function () {
    applyIdcfFilters();
}

function applyIdcfFilters() {
    const fYear = document.getElementById('filterIdcfYear').value || '';

    filteredIdcfData = idcfData.filter(row => {
        if (fYear && row.reporting_year !== fYear) return false;
        return true;
    }).sort((a, b) => (a.facility || '').localeCompare(b.facility || ''));

    // Report compliance stats
    const reportedSet = new Set(filteredIdcfData.map(r => r.facility).filter(Boolean));
    currentIdcfDefaulters = default_units.filter(sc => !reportedSet.has(sc));

    document.getElementById('idcfToReport').textContent = default_units.length;
    document.getElementById('idcfReported').textContent = reportedSet.size;
    document.getElementById('idcfDefaulters').textContent = currentIdcfDefaulters.length;

    drawIdcfTable();
}

function drawIdcfTable() {
    const tbody = document.getElementById('idcfTableBody');
    tbody.innerHTML = '';

    if (filteredIdcfData.length === 0) {
        tbody.innerHTML = `
            <tr class="no-data-row">
                <td colspan="12" class="text-center">No IDCF reports match your selected filters.</td>
            </tr>
        `;
        return;
    }

    let sVS = 0, sVO = 0, sC5 = 0, sCO = 0, sD = 0, sDO = 0, sDZ = 0, sDR = 0, sSH = 0;

    filteredIdcfData.forEach(row => {
        sVS += parseInt(row.villages_served) || 0;
        sVO += parseInt(row.villages_ors_distributed) || 0;
        sC5 += parseInt(row.children_0_5) || 0;
        sCO += parseInt(row.children_given_ors) || 0;
        sD += parseInt(row.children_diarrhea) || 0;
        sDO += parseInt(row.diarrhea_children_ors) || 0;
        sDZ += parseInt(row.diarrhea_children_zinc) || 0;
        sDR += parseInt(row.danger_sign_referred) || 0;
        sSH += parseInt(row.schools_handwashing) || 0;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: 600;">${row.facility || ''}</td>
            <td class="text-center">${row.villages_served ?? 0}</td>
            <td class="text-center">${row.villages_ors_distributed ?? 0}</td>
            <td class="text-center">${row.children_0_5 ?? 0}</td>
            <td class="text-center">${row.children_given_ors ?? 0}</td>
            <td class="text-center">${row.children_diarrhea ?? 0}</td>
            <td class="text-center">${row.diarrhea_children_ors ?? 0}</td>
            <td class="text-center">${row.diarrhea_children_zinc ?? 0}</td>
            <td class="text-center">${row.danger_sign_referred ?? 0}</td>
            <td class="text-center">${row.ors_corner_created || ''}</td>
            <td class="text-center">${row.schools_handwashing ?? 0}</td>
            <td class="text-center">
                <button class="btn-action-edit" onclick="openEditIdcfModal(${row._rowIndex})" title="Edit Row">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-action-delete" onclick="openIdcfDeleteConfirm(${row._rowIndex})" title="Delete Row">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Grand Total sticky row
    const totalTr = document.createElement('tr');
    totalTr.className = 'grand-total-row';
    totalTr.innerHTML = `
        <td class="text-right">Grand Total</td>
        <td class="text-center">${sVS}</td>
        <td class="text-center">${sVO}</td>
        <td class="text-center">${sC5}</td>
        <td class="text-center">${sCO}</td>
        <td class="text-center">${sD}</td>
        <td class="text-center">${sDO}</td>
        <td class="text-center">${sDZ}</td>
        <td class="text-center">${sDR}</td>
        <td class="text-center"></td>
        <td class="text-center">${sSH}</td>
        <td></td>
    `;
    let tfoot = tbody.parentNode.querySelector('tfoot'); if(!tfoot) { tfoot = document.createElement('tfoot'); tbody.parentNode.appendChild(tfoot); } tfoot.innerHTML = ''; tfoot.appendChild(totalTr);
}

// --- IDCF EDIT ---
window.openEditIdcfModal = function (rowIndex) {
    const record = idcfData.find(r => r._rowIndex === rowIndex);
    if (!record) return;

    document.getElementById('edit-idcf-id').value = record._rowIndex;
    document.getElementById('edit-idcf-facility').value = record.facility || '';
    document.getElementById('edit-idcf-villages-served').value = record.villages_served ?? 0;
    document.getElementById('edit-idcf-villages-ors').value = record.villages_ors_distributed ?? 0;
    document.getElementById('edit-idcf-children-05').value = record.children_0_5 ?? 0;
    document.getElementById('edit-idcf-children-ors').value = record.children_given_ors ?? 0;
    document.getElementById('edit-idcf-diarrhea').value = record.children_diarrhea ?? 0;
    document.getElementById('edit-idcf-diarrhea-ors').value = record.diarrhea_children_ors ?? 0;
    document.getElementById('edit-idcf-diarrhea-zinc').value = record.diarrhea_children_zinc ?? 0;
    document.getElementById('edit-idcf-danger-ref').value = record.danger_sign_referred ?? 0;
    document.getElementById('edit-idcf-ors-corner').value = record.ors_corner_created || 'Yes';
    document.getElementById('edit-idcf-schools-hw').value = record.schools_handwashing ?? 0;

    document.getElementById('editIdcfModal').classList.add('active');
}

window.closeEditIdcfModal = function () {
    document.getElementById('editIdcfModal').classList.remove('active');
}

window.saveIdcfRecord = async function (event) {
    event.preventDefault();

    if (!IDCF_SCRIPT_URL) {
        showToast('Apps Script URL not configured. Deploy the script from the Google Sheet first (see idcf_apps_script.js).', 'error');
        return;
    }

    const rowIndex = parseInt(document.getElementById('edit-idcf-id').value);
    const btnSave = document.getElementById('btnSaveIdcfRecord');
    btnSave.disabled = true;
    btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    // values array maps to columns B through L (sheet columns 2-12)
    const values = [
        document.getElementById('edit-idcf-facility').value,
        parseInt(document.getElementById('edit-idcf-villages-served').value) || 0,
        parseInt(document.getElementById('edit-idcf-villages-ors').value) || 0,
        parseInt(document.getElementById('edit-idcf-children-05').value) || 0,
        parseInt(document.getElementById('edit-idcf-children-ors').value) || 0,
        parseInt(document.getElementById('edit-idcf-diarrhea').value) || 0,
        parseInt(document.getElementById('edit-idcf-diarrhea-ors').value) || 0,
        parseInt(document.getElementById('edit-idcf-diarrhea-zinc').value) || 0,
        parseInt(document.getElementById('edit-idcf-danger-ref').value) || 0,
        document.getElementById('edit-idcf-ors-corner').value,
        parseInt(document.getElementById('edit-idcf-schools-hw').value) || 0
    ];

    try {
        const response = await fetch(IDCF_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'edit', rowIndex: rowIndex, values: values })
        });
        const text = await response.text();
        let result;
        try { result = JSON.parse(text); } catch (e) { throw new Error('Unexpected response from server'); }
        if (!result.success) throw new Error(result.message || 'Update failed');

        showToast('IDCF record updated successfully!');
        closeEditIdcfModal();
        // Re-fetch fresh data (row indices may shift)
        idcfData = [];
        fetchIdcfData();
    } catch (error) {
        console.error('Error updating IDCF record:', error);
        showToast('Failed to update record: ' + error.message, 'error');
    } finally {
        btnSave.disabled = false;
        btnSave.innerHTML = 'Save Changes';
    }
}

// --- IDCF DELETE ---
window.openIdcfDeleteConfirm = function (rowIndex) {
    idcfRecordToDeleteId = rowIndex;
    document.getElementById('confirmIdcfModal').classList.add('active');
}

window.closeIdcfConfirmModal = function () {
    document.getElementById('confirmIdcfModal').classList.remove('active');
    idcfRecordToDeleteId = null;
}

window.executeDeleteIdcfRecord = async function () {
    if (!idcfRecordToDeleteId) return;

    if (!IDCF_SCRIPT_URL) {
        showToast('Apps Script URL not configured. Deploy the script from the Google Sheet first (see idcf_apps_script.js).', 'error');
        return;
    }

    const btnDelete = document.getElementById('btnConfirmIdcfDelete');
    btnDelete.disabled = true;
    btnDelete.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';

    try {
        const response = await fetch(IDCF_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'delete', rowIndex: idcfRecordToDeleteId })
        });
        const text = await response.text();
        let result;
        try { result = JSON.parse(text); } catch (e) { throw new Error('Unexpected response from server'); }
        if (!result.success) throw new Error(result.message || 'Delete failed');

        showToast('IDCF record deleted successfully!');
        closeIdcfConfirmModal();
        // Re-fetch fresh data (row indices shift after delete)
        idcfData = [];
        fetchIdcfData();
    } catch (error) {
        console.error('Error deleting IDCF record:', error);
        showToast('Failed to delete record: ' + error.message, 'error');
    } finally {
        btnDelete.disabled = false;
        btnDelete.innerHTML = 'Yes, Delete';
    }
}

// --- IDCF DEFAULTERS MODAL ---
window.openIdcfDefaultersModal = function () {
    const container = document.getElementById('idcfDefaultersListContainer');
    container.innerHTML = '';

    if (currentIdcfDefaulters.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 24px; color: var(--color-text-muted);">
                <i class="fas fa-check-circle" style="color: #2e7d32; font-size: 2.5rem; margin-bottom: 12px; display: block;"></i>
                All facilities have reported. No defaulters!
            </div>
        `;
    } else {
        const sortedDefaulters = [...currentIdcfDefaulters].sort();
        container.innerHTML = sortedDefaulters.map(sc => `
            <div class="defaulter-item">
                <i class="fas fa-exclamation-circle"></i>
                <span>${sc}</span>
            </div>
        `).join('');
    }

    document.getElementById('defaultersIdcfModal').classList.add('active');
}

window.closeIdcfDefaultersModal = function () {
    document.getElementById('defaultersIdcfModal').classList.remove('active');
}

// --- IDCF EXPORT TO EXCEL ---
window.exportIdcfToExcel = function () {
    if (filteredIdcfData.length === 0) {
        showToast('No data to export!', 'error');
        return;
    }

    const rows = filteredIdcfData.map((row, index) => ({
        'Sl No': index + 1,
        'Facility': row.facility || '',
        'Villages Served': row.villages_served ?? 0,
        'Villages ORS Distributed': row.villages_ors_distributed ?? 0,
        'Children (0-5 yrs)': row.children_0_5 ?? 0,
        'Children Given ORS': row.children_given_ors ?? 0,
        'Children with Diarrhea': row.children_diarrhea ?? 0,
        'Diarrhea Children ORS': row.diarrhea_children_ors ?? 0,
        'Diarrhea Children Zinc': row.diarrhea_children_zinc ?? 0,
        'Danger Sign Referred': row.danger_sign_referred ?? 0,
        'ORS Corner Created': row.ors_corner_created || '',
        'Schools Hand Washing': row.schools_handwashing ?? 0
    }));

    let tVS = 0, tVO = 0, tC5 = 0, tCO = 0, tD = 0, tDO = 0, tDZ = 0, tDR = 0, tSH = 0;
    filteredIdcfData.forEach(r => {
        tVS += r.villages_served ?? 0; tVO += r.villages_ors_distributed ?? 0;
        tC5 += r.children_0_5 ?? 0; tCO += r.children_given_ors ?? 0;
        tD += r.children_diarrhea ?? 0; tDO += r.diarrhea_children_ors ?? 0;
        tDZ += r.diarrhea_children_zinc ?? 0; tDR += r.danger_sign_referred ?? 0;
        tSH += r.schools_handwashing ?? 0;
    });
    rows.push({
        'Sl No': 'Grand Total', 'Facility': '',
        'Villages Served': tVS, 'Villages ORS Distributed': tVO,
        'Children (0-5 yrs)': tC5, 'Children Given ORS': tCO,
        'Children with Diarrhea': tD, 'Diarrhea Children ORS': tDO,
        'Diarrhea Children Zinc': tDZ, 'Danger Sign Referred': tDR,
        'ORS Corner Created': '', 'Schools Hand Washing': tSH
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'IDCF Report');
    worksheet['!cols'] = [
        { wch: 8 }, { wch: 22 }, { wch: 14 }, { wch: 20 }, { wch: 14 }, { wch: 16 },
        { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 16 }
    ];
    XLSX.writeFile(workbook, `IDCF_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// --- IDCF EXPORT TO PDF ---
window.exportIdcfToPDF = function () {
    if (filteredIdcfData.length === 0) {
        showToast('No data to export!', 'error');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(122, 28, 49);
    doc.text('IDCF Report', 14, 15);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    const fYear = document.getElementById('filterIdcfYear').value || 'All';
    doc.text(`Year: ${fYear}   Generated: ${new Date().toLocaleDateString()}`, 14, 21);

    const headers = [['Sl No', 'Facility', 'Vlg Served', 'Vlg ORS', 'Child (0-5)', 'Child ORS', 'Diarrhea', 'Dia. ORS', 'Dia. Zinc', 'Danger Ref.', 'ORS Corner', 'Schools HW']];

    const tableData = filteredIdcfData.map((row, index) => [
        index + 1, row.facility || '',
        row.villages_served ?? 0, row.villages_ors_distributed ?? 0,
        row.children_0_5 ?? 0, row.children_given_ors ?? 0,
        row.children_diarrhea ?? 0, row.diarrhea_children_ors ?? 0,
        row.diarrhea_children_zinc ?? 0, row.danger_sign_referred ?? 0,
        row.ors_corner_created || '', row.schools_handwashing ?? 0
    ]);

    let tVS = 0, tVO = 0, tC5 = 0, tCO = 0, tD = 0, tDO = 0, tDZ = 0, tDR = 0, tSH = 0;
    filteredIdcfData.forEach(r => {
        tVS += r.villages_served ?? 0; tVO += r.villages_ors_distributed ?? 0;
        tC5 += r.children_0_5 ?? 0; tCO += r.children_given_ors ?? 0;
        tD += r.children_diarrhea ?? 0; tDO += r.diarrhea_children_ors ?? 0;
        tDZ += r.diarrhea_children_zinc ?? 0; tDR += r.danger_sign_referred ?? 0;
        tSH += r.schools_handwashing ?? 0;
    });
    tableData.push(['Grand Total', '', tVS, tVO, tC5, tCO, tD, tDO, tDZ, tDR, '', tSH]);

    doc.autoTable({
        startY: 25,
        head: headers,
        body: tableData,
        theme: 'grid',
        headStyles: {
            fillColor: [122, 28, 49],
            textColor: [255, 255, 255],
            fontSize: 7.5,
            fontStyle: 'bold',
            halign: 'center'
        },
        bodyStyles: { fontSize: 7.5, textColor: [50, 50, 50] },
        alternateRowStyles: { fillColor: [248, 248, 248] },
        columnStyles: {
            0: { cellWidth: 12, halign: 'center' },
            1: { cellWidth: 38, fontStyle: 'bold' },
            2: { halign: 'center' }, 3: { halign: 'center' },
            4: { halign: 'center' }, 5: { halign: 'center' },
            6: { halign: 'center' }, 7: { halign: 'center' },
            8: { halign: 'center' }, 9: { halign: 'center' },
            10: { halign: 'center' }, 11: { halign: 'center' }
        },
        didParseCell: function (data) {
            if (data.row.index === tableData.length - 1) {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.textColor = [122, 28, 49];
                data.cell.styles.fillColor = [252, 235, 235];
            }
        },
        margin: { top: 25, bottom: 15, left: 14, right: 14 }
    });

    doc.save(`IDCF_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ----------------------------------------------------
// UTILITY FUNCTIONS
// ----------------------------------------------------
function formatDateDDMMYYYY(dateString) {
    if (!dateString) return "";
    const parts = dateString.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateString;
}

// Toast Notification System
function showToast(msg, type = 'success') {
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.top = '24px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.backgroundColor = type === 'success' ? 'var(--color-maroon)' : '#b22222';
    toast.style.color = '#ffffff';
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '6px';
    toast.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)';
    toast.style.zIndex = '9999';
    toast.style.fontWeight = '600';
    toast.style.fontSize = '0.9rem';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '10px';

    const icon = type === 'success' ? '<i class="fas fa-check-circle"></i>' : '<i class="fas fa-exclamation-circle"></i>';
    toast.innerHTML = `${icon}<span>${msg}</span>`;

    document.body.appendChild(toast);

    // Animate opacity
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.2s';
    setTimeout(() => toast.style.opacity = '1', 50);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 200);
    }, 3000);
}

// DEFAULTERS MODAL ACTIONS
window.openDefaultersModal = function () {
    const container = document.getElementById('defaultersListContainer');
    container.innerHTML = '';

    if (currentDefaulters.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 24px; color: var(--color-text-muted);">
                <i class="fas fa-check-circle" style="color: #2e7d32; font-size: 2.5rem; margin-bottom: 12px; display: block;"></i>
                All facilities have reported. No defaulters!
            </div>
        `;
    } else {
        // Sort alphabetically
        const sortedDefaulters = [...currentDefaulters].sort();
        container.innerHTML = sortedDefaulters.map(sc => `
            <div class="defaulter-item">
                <i class="fas fa-exclamation-circle"></i>
                <span>${sc}</span>
            </div>
        `).join('');
    }

    document.getElementById('defaultersModal').classList.add('active');
}

window.closeDefaultersModal = function () {
    document.getElementById('defaultersModal').classList.remove('active');
}

// Close modals on clicking overlay background
window.addEventListener('click', (e) => {
    if (e.target === editModal) closeEditModal();
    if (e.target === confirmModal) closeConfirmModal();
    if (e.target === document.getElementById('defaultersModal')) closeDefaultersModal();
    if (e.target === editDeliveryModal) closeEditDeliveryModal();
    if (e.target === confirmDeliveryModal) closeDeliveryConfirmModal();
    if (e.target === defaultersDeliveryModal) closeDelDefaultersModal();
    if (e.target === document.getElementById('editIdcfModal')) closeEditIdcfModal();
    if (e.target === document.getElementById('confirmIdcfModal')) closeIdcfConfirmModal();
    if (e.target === document.getElementById('defaultersIdcfModal')) closeIdcfDefaultersModal();
    if (e.target === document.getElementById('editVitaminAModal')) closeEditVitaminAModal();
    if (e.target === document.getElementById('confirmVitaminAModal')) closeVitaminAConfirmModal();
    if (e.target === document.getElementById('defaultersVitaminAModal')) closeVitaminADefaultersModal();
});

// Escape key to close modals
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeEditModal();
        closeConfirmModal();
        closeDefaultersModal();
        closeEditDeliveryModal();
        closeDeliveryConfirmModal();
        closeDelDefaultersModal();
        closeEditIdcfModal();
        closeIdcfConfirmModal();
        closeIdcfDefaultersModal();
        closeEditVitaminAModal();
        closeVitaminAConfirmModal();
        closeVitaminADefaultersModal();
    }
});

// ----------------------------------------------------
// VITAMIN A REPORT VIEW LOGIC
// ----------------------------------------------------
async function fetchVitaminAData() {
    const tbody = document.getElementById('vitaminATableBody');
    tbody.innerHTML = `<tr class="loading-row"><td colspan="12"><i class="fas fa-spinner fa-spin"></i> Fetching Vitamin A data...</td></tr>`;

    if (guardSupabaseAccess(tbody, 'Supabase is not available. The Vitamin A report cannot load in this browser session.')) {
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('vitamin_a_reports')
            .select('*')
            .order('report_year', { ascending: false })
            .order('report_round', { ascending: false })
            .limit(5000);

        if (error) throw error;
        vitaminAData = data || [];

        updateVitaminADropdowns('init');
        applyVitaminAFilters();
    } catch (error) {
        console.error('Error fetching Vitamin A data:', error);
        tbody.innerHTML = `<tr class="no-data-row"><td colspan="12" style="color: var(--color-maroon); font-weight: 600;">Error fetching data: ${error.message}</td></tr>`;
    }
}

function updateVitaminADropdowns(source) {
    const filterYear = document.getElementById('filterVitaminAYear');
    const filterRound = document.getElementById('filterVitaminARound');
    const selYear = filterYear.value;
    const selRound = filterRound.value;

    const yearsSet = new Set();
    const roundsSet = new Set();

    vitaminAData.forEach(row => {
        if (row.report_year) yearsSet.add(row.report_year);
        if (selYear) {
            if (row.report_year.toString() === selYear.toString() && row.report_round) {
                roundsSet.add(row.report_round);
            }
        } else {
            if (row.report_round) roundsSet.add(row.report_round);
        }
    });

    if (source === 'init') {
        const yearsArr = Array.from(yearsSet).sort().reverse();
        filterYear.innerHTML = '<option value="">All Years</option>' + yearsArr.map(y => `<option value="${y}">${y}</option>`).join('');
        filterYear.value = selYear;
    }

    if (source === 'init' || source === 'year') {
        const roundsArr = Array.from(roundsSet).sort().reverse();
        filterRound.innerHTML = '<option value="">All Rounds</option>' + roundsArr.map(r => `<option value="${r}">${r}</option>`).join('');
        filterRound.value = roundsArr.includes(selRound) ? selRound : '';
    }
}

window.handleVitaminAFilterChange = function (source) {
    updateVitaminADropdowns(source);
    applyVitaminAFilters();
}

function applyVitaminAFilters() {
    const fYear = document.getElementById('filterVitaminAYear').value;
    const fRound = document.getElementById('filterVitaminARound').value;

    filteredVitaminAData = vitaminAData.filter(row => {
        if (fYear && row.report_year.toString() !== fYear) return false;
        if (fRound && row.report_round !== fRound) return false;
        return true;
    }).sort((a, b) => (a.reporting_unit || '').localeCompare(b.reporting_unit || ''));

    const reportedSet = new Set(filteredVitaminAData.map(r => r.reporting_unit).filter(Boolean));
    currentVitaminADefaulters = default_units.filter(sc => !reportedSet.has(sc));

    document.getElementById('vitaminAToReport').textContent = default_units.length;
    document.getElementById('vitaminAReported').textContent = reportedSet.size;
    document.getElementById('vitaminADefaulters').textContent = currentVitaminADefaulters.length;

    drawVitaminATable();
}

function drawVitaminATable() {
    const tbody = document.getElementById('vitaminATableBody');
    tbody.innerHTML = '';

    if (filteredVitaminAData.length === 0) {
        tbody.innerHTML = `<tr class="no-data-row"><td colspan="12" class="text-center">No Vitamin A reports match your filters.</td></tr>`;
        return;
    }

    let s9d = 0, s9r = 0, s12d = 0, s12r = 0, s24d = 0, s24r = 0, s36d = 0, s36r = 0, std = 0, str = 0;

    filteredVitaminAData.forEach(row => {
        s9d += row.age_9_12_due ?? 0; s9r += row.age_9_12_rec ?? 0;
        s12d += row.age_12_24_due ?? 0; s12r += row.age_12_24_rec ?? 0;
        s24d += row.age_24_36_due ?? 0; s24r += row.age_24_36_rec ?? 0;
        s36d += row.age_36_60_due ?? 0; s36r += row.age_36_60_rec ?? 0;
        std += row.total_due ?? 0; str += row.total_rec ?? 0;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: 600;">${row.reporting_unit || ''}</td>
            <td class="text-center">${row.age_9_12_due ?? 0}</td><td class="text-center">${row.age_9_12_rec ?? 0}</td>
            <td class="text-center">${row.age_12_24_due ?? 0}</td><td class="text-center">${row.age_12_24_rec ?? 0}</td>
            <td class="text-center">${row.age_24_36_due ?? 0}</td><td class="text-center">${row.age_24_36_rec ?? 0}</td>
            <td class="text-center">${row.age_36_60_due ?? 0}</td><td class="text-center">${row.age_36_60_rec ?? 0}</td>
            <td class="text-center">${row.total_due ?? 0}</td><td class="text-center">${row.total_rec ?? 0}</td>
            <td class="text-center">
                <button class="btn-action-edit" onclick="openEditVitaminAModal(${row.id})" title="Edit Row"><i class="fas fa-edit"></i></button>
                <button class="btn-action-delete" onclick="openVitaminADeleteConfirm(${row.id})" title="Delete Row"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    const totalTr = document.createElement('tr');
    totalTr.className = 'grand-total-row';
    totalTr.innerHTML = `
        <td class="text-right font-bold">Grand Total</td>
        <td class="text-center">${s9d}</td><td class="text-center">${s9r}</td>
        <td class="text-center">${s12d}</td><td class="text-center">${s12r}</td>
        <td class="text-center">${s24d}</td><td class="text-center">${s24r}</td>
        <td class="text-center">${s36d}</td><td class="text-center">${s36r}</td>
        <td class="text-center">${std}</td><td class="text-center">${str}</td>
        <td></td>
    `;
    let tfoot = tbody.parentNode.querySelector('tfoot'); if(!tfoot) { tfoot = document.createElement('tfoot'); tbody.parentNode.appendChild(tfoot); } tfoot.innerHTML = ''; tfoot.appendChild(totalTr);
}

window.openEditVitaminAModal = function (id) {
    const record = vitaminAData.find(r => r.id === id);
    if (!record) return;

    document.getElementById('edit-va-id').value = record.id;
    document.getElementById('edit-va-facility').value = record.reporting_unit || '';
    document.getElementById('edit-va-round').value = record.report_round || '';

    document.getElementById('edit-va-9-12-due').value = record.age_9_12_due ?? 0;
    document.getElementById('edit-va-9-12-rec').value = record.age_9_12_rec ?? 0;
    document.getElementById('edit-va-12-24-due').value = record.age_12_24_due ?? 0;
    document.getElementById('edit-va-12-24-rec').value = record.age_12_24_rec ?? 0;
    document.getElementById('edit-va-24-36-due').value = record.age_24_36_due ?? 0;
    document.getElementById('edit-va-24-36-rec').value = record.age_24_36_rec ?? 0;
    document.getElementById('edit-va-36-60-due').value = record.age_36_60_due ?? 0;
    document.getElementById('edit-va-36-60-rec').value = record.age_36_60_rec ?? 0;

    document.getElementById('editVitaminAModal').classList.add('active');
}

window.closeEditVitaminAModal = function () {
    document.getElementById('editVitaminAModal').classList.remove('active');
}

window.saveVitaminARecord = async function (event) {
    event.preventDefault();
    const id = document.getElementById('edit-va-id').value;
    const btnSave = document.getElementById('btnSaveVitaminARecord');
    btnSave.disabled = true;
    btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    const d1 = parseInt(document.getElementById('edit-va-9-12-due').value) || 0;
    const r1 = parseInt(document.getElementById('edit-va-9-12-rec').value) || 0;
    const d2 = parseInt(document.getElementById('edit-va-12-24-due').value) || 0;
    const r2 = parseInt(document.getElementById('edit-va-12-24-rec').value) || 0;
    const d3 = parseInt(document.getElementById('edit-va-24-36-due').value) || 0;
    const r3 = parseInt(document.getElementById('edit-va-24-36-rec').value) || 0;
    const d4 = parseInt(document.getElementById('edit-va-36-60-due').value) || 0;
    const r4 = parseInt(document.getElementById('edit-va-36-60-rec').value) || 0;

    const totalDue = d1 + d2 + d3 + d4;
    const totalRec = r1 + r2 + r3 + r4;

    const updatedData = {
        age_9_12_due: d1, age_9_12_rec: r1,
        age_12_24_due: d2, age_12_24_rec: r2,
        age_24_36_due: d3, age_24_36_rec: r3,
        age_36_60_due: d4, age_36_60_rec: r4,
        total_due: totalDue, total_rec: totalRec
    };

    try {
        const { error } = await supabaseClient.from('vitamin_a_reports').update(updatedData).eq('id', id);
        if (error) throw error;
        showToast('Vitamin A record updated successfully!');
        closeEditVitaminAModal();
        fetchVitaminAData();
    } catch (error) {
        console.error('Error updating Vitamin A record:', error);
        showToast('Failed to update record: ' + error.message, 'error');
    } finally {
        btnSave.disabled = false;
        btnSave.innerHTML = 'Save Changes';
    }
}

window.openVitaminADeleteConfirm = function (id) {
    vitaminARecordToDeleteId = id;
    document.getElementById('confirmVitaminAModal').classList.add('active');
}

window.closeVitaminAConfirmModal = function () {
    document.getElementById('confirmVitaminAModal').classList.remove('active');
    vitaminARecordToDeleteId = null;
}

window.executeDeleteVitaminARecord = async function () {
    if (!vitaminARecordToDeleteId) return;
    const btnDelete = document.getElementById('btnConfirmVitaminADelete');
    btnDelete.disabled = true;
    btnDelete.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';

    try {
        const { error } = await supabaseClient.from('vitamin_a_reports').delete().eq('id', vitaminARecordToDeleteId);
        if (error) throw error;
        showToast('Vitamin A record deleted successfully!');
        closeVitaminAConfirmModal();
        fetchVitaminAData();
    } catch (error) {
        console.error('Error deleting Vitamin A record:', error);
        showToast('Failed to delete record: ' + error.message, 'error');
    } finally {
        btnDelete.disabled = false;
        btnDelete.innerHTML = 'Yes, Delete';
    }
}

window.openVitaminADefaultersModal = function () {
    const container = document.getElementById('vitaminADefaultersListContainer');
    if (currentVitaminADefaulters.length === 0) {
        container.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--color-text-muted);"><i class="fas fa-check-circle" style="color: #2e7d32; font-size: 2.5rem; margin-bottom: 12px; display: block;"></i>All facilities have reported. No defaulters!</div>`;
    } else {
        container.innerHTML = [...currentVitaminADefaulters].sort().map(sc => `<div class="defaulter-item"><i class="fas fa-exclamation-circle"></i><span>${sc}</span></div>`).join('');
    }
    document.getElementById('defaultersVitaminAModal').classList.add('active');
}

window.closeVitaminADefaultersModal = function () {
    document.getElementById('defaultersVitaminAModal').classList.remove('active');
}

window.exportVitaminAToExcel = function () {
    if (filteredVitaminAData.length === 0) {
        showToast('No data to export!', 'error');
        return;
    }
    const rows = filteredVitaminAData.map((row, index) => ({
        'Sl No': index + 1,
        'Facility': row.reporting_unit || '',
        '9-12m Due': row.age_9_12_due ?? 0, '9-12m Rec': row.age_9_12_rec ?? 0,
        '1-2y Due': row.age_12_24_due ?? 0, '1-2y Rec': row.age_12_24_rec ?? 0,
        '2-3y Due': row.age_24_36_due ?? 0, '2-3y Rec': row.age_24_36_rec ?? 0,
        '3-5y Due': row.age_36_60_due ?? 0, '3-5y Rec': row.age_36_60_rec ?? 0,
        'Total Due': row.total_due ?? 0, 'Total Rec': row.total_rec ?? 0
    }));

    let s9d = 0, s9r = 0, s12d = 0, s12r = 0, s24d = 0, s24r = 0, s36d = 0, s36r = 0, std = 0, str = 0;
    filteredVitaminAData.forEach(r => {
        s9d += r.age_9_12_due ?? 0; s9r += r.age_9_12_rec ?? 0;
        s12d += r.age_12_24_due ?? 0; s12r += r.age_12_24_rec ?? 0;
        s24d += r.age_24_36_due ?? 0; s24r += r.age_24_36_rec ?? 0;
        s36d += r.age_36_60_due ?? 0; s36r += r.age_36_60_rec ?? 0;
        std += r.total_due ?? 0; str += r.total_rec ?? 0;
    });
    rows.push({
        'Sl No': 'Grand Total', 'Facility': '',
        '9-12m Due': s9d, '9-12m Rec': s9r,
        '1-2y Due': s12d, '1-2y Rec': s12r,
        '2-3y Due': s24d, '2-3y Rec': s24r,
        '3-5y Due': s36d, '3-5y Rec': s36r,
        'Total Due': std, 'Total Rec': str
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Vitamin A');
    worksheet['!cols'] = [{ wch: 8 }, { wch: 22 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
    XLSX.writeFile(workbook, `VitaminA_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

window.exportVitaminAToPDF = function () {
    if (filteredVitaminAData.length === 0) {
        showToast('No data to export!', 'error');
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(122, 28, 49);
    doc.text('Vitamin A Report', 14, 15);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    const fYear = document.getElementById('filterVitaminAYear').value || 'All';
    const fRound = document.getElementById('filterVitaminARound').value || 'All';
    doc.text(`Year: ${fYear} | Round: ${fRound}   Generated: ${new Date().toLocaleDateString()}`, 14, 21);

    const headers = [
        [
            { content: 'Sl No', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
            { content: 'Facility', rowSpan: 2, styles: { valign: 'middle', halign: 'center' } },
            { content: '9-12 Months', colSpan: 2, styles: { halign: 'center' } },
            { content: '12-24 Months', colSpan: 2, styles: { halign: 'center' } },
            { content: '24-36 Months', colSpan: 2, styles: { halign: 'center' } },
            { content: '36-60 Months', colSpan: 2, styles: { halign: 'center' } },
            { content: 'Total', colSpan: 2, styles: { halign: 'center' } }
        ],
        ['Due', 'Rec', 'Due', 'Rec', 'Due', 'Rec', 'Due', 'Rec', 'Due', 'Rec']
    ];

    const tableData = filteredVitaminAData.map((row, index) => [
        index + 1, row.reporting_unit || '',
        row.age_9_12_due ?? 0, row.age_9_12_rec ?? 0,
        row.age_12_24_due ?? 0, row.age_12_24_rec ?? 0,
        row.age_24_36_due ?? 0, row.age_24_36_rec ?? 0,
        row.age_36_60_due ?? 0, row.age_36_60_rec ?? 0,
        row.total_due ?? 0, row.total_rec ?? 0
    ]);

    let s9d = 0, s9r = 0, s12d = 0, s12r = 0, s24d = 0, s24r = 0, s36d = 0, s36r = 0, std = 0, str = 0;
    filteredVitaminAData.forEach(r => {
        s9d += r.age_9_12_due ?? 0; s9r += r.age_9_12_rec ?? 0;
        s12d += r.age_12_24_due ?? 0; s12r += r.age_12_24_rec ?? 0;
        s24d += r.age_24_36_due ?? 0; s24r += r.age_24_36_rec ?? 0;
        s36d += r.age_36_60_due ?? 0; s36r += r.age_36_60_rec ?? 0;
        std += r.total_due ?? 0; str += r.total_rec ?? 0;
    });
    tableData.push(['Grand Total', '', s9d, s9r, s12d, s12r, s24d, s24r, s36d, s36r, std, str]);

    doc.autoTable({
        startY: 25, head: headers, body: tableData, theme: 'grid',
        headStyles: { fillColor: [122, 28, 49], textColor: [255, 255, 255], fontSize: 8.5, fontStyle: 'bold', halign: 'center' },
        bodyStyles: { fontSize: 8, textColor: [50, 50, 50] },
        alternateRowStyles: { fillColor: [248, 248, 248] },
        columnStyles: {
            0: { cellWidth: 15, halign: 'center' },
            1: { cellWidth: 40, fontStyle: 'bold' },
            2: { halign: 'center' }, 3: { halign: 'center' },
            4: { halign: 'center' }, 5: { halign: 'center' },
            6: { halign: 'center' }, 7: { halign: 'center' },
            8: { halign: 'center' }, 9: { halign: 'center' },
            10: { halign: 'center' }, 11: { halign: 'center' }
        },
        didParseCell: function (data) {
            if (data.row.index === tableData.length - 1) {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.textColor = [122, 28, 49];
                data.cell.styles.fillColor = [252, 235, 235];
            }
        },
        margin: { top: 25, bottom: 15, left: 14, right: 14 }
    });
    doc.save(`VitaminA_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// Start dashboard view
initDashboard();

window.toggleSidebar = function() { const sidebar = document.querySelector('.sidebar'); if(sidebar) sidebar.classList.toggle('hidden-sidebar'); };

let wpdStatMetrics = {};

window.openWpdModal = function(metricName) {
    const modal = document.getElementById('wpdModal');
    const title = document.getElementById('wpdModalTitle');
    const topList = document.getElementById('wpdModalTopList');
    const bottomList = document.getElementById('wpdModalBottomList');
    if (!modal || !title || !topList || !bottomList) return;

    title.textContent = metricName + ' - Top 5 & Bottom 5';
    topList.innerHTML = ''; bottomList.innerHTML = '';
    const data = wpdStatMetrics[metricName] ? wpdStatMetrics[metricName].data : [];
    
    if (data.length === 0) {
        topList.innerHTML = '<li><span class="fac-name text-muted">No data available</span></li>';
        bottomList.innerHTML = '<li><span class="fac-name text-muted">No data available</span></li>';
    } else {
        const top5 = data.slice(0, 5);
        const bottom5 = data.slice(-5).reverse();
        top5.forEach(item => { topList.innerHTML += '<li><span class="fac-name">' + item.facility + '</span><span class="fac-val">' + item.value.toLocaleString() + '</span></li>'; });
        bottom5.forEach(item => { bottomList.innerHTML += '<li><span class="fac-name">' + item.facility + '</span><span class="fac-val">' + item.value.toLocaleString() + '</span></li>'; });
    }
    modal.classList.add('active');
};

window.closeWpdModal = function(e) {
    if (e && e.target && e.target.closest('.modal-content') && !e.target.closest('.modal-close')) return;
    const modal = document.getElementById('wpdModal');
    if (modal) modal.classList.remove('active');
};
