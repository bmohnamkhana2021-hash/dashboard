// Supabase Configuration
const SUPABASE_URL = 'https://kijqcmumynutyhodxjwo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_3vIQeWE4irMp3ni9vSw7fg_2sgzjurY';

// Initialize Supabase Client
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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
window.switchView = function(viewName) {
    currentView = viewName;
    
    const navDashboard = document.getElementById('navDashboard');
    const navEcReport = document.getElementById('navEcReport');
    const navDelivery = document.getElementById('navDelivery');
    
    const dashboardView = document.getElementById('dashboardView');
    const ecReportView = document.getElementById('ecReportView');
    const deliveryView = document.getElementById('deliveryView');

    navDashboard.classList.remove('active');
    navEcReport.classList.remove('active');
    if (navDelivery) navDelivery.classList.remove('active');
    
    dashboardView.style.display = 'none';
    ecReportView.style.display = 'none';
    if (deliveryView) deliveryView.style.display = 'none';

    if (viewName === 'dashboard') {
        navDashboard.classList.add('active');
        dashboardView.style.display = 'block';
        renderTable();
    } else if (viewName === 'ec-report') {
        navEcReport.classList.add('active');
        ecReportView.style.display = 'block';
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

window.handleSort = function(field) {
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

window.handleSearch = function() {
    searchTerm = searchInput.value;
    renderTable();
}

// ----------------------------------------------------
// EC MEETING REPORT VIEW LOGIC
// ----------------------------------------------------
async function fetchEcMeetingData() {
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
        const monthsArr = Array.from(monthsMap.values()).sort((a,b) => {
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

window.handleFilterChange = function(source) {
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
window.openEditModal = function(id) {
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

window.closeEditModal = function() {
    editModal.classList.remove('active');
}

window.saveRecord = async function(event) {
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
window.openDeleteConfirm = function(id) {
    recordToDeleteId = id;
    confirmModal.classList.add('active');
}

window.closeConfirmModal = function() {
    confirmModal.classList.remove('active');
    recordToDeleteId = null;
}

window.executeDeleteRecord = async function() {
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
        monthsArr.sort((a,b) => monthOrder.indexOf(a) - monthOrder.indexOf(b));

        filterDelMonth.innerHTML = '<option value="">All Months</option>' + 
            monthsArr.map(m => `<option value="${m}">${m}</option>`).join('');
        filterDelMonth.value = monthsArr.includes(selMonth) ? selMonth : "";
    }
}

window.handleDelFilterChange = function(source) {
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
window.openEditDeliveryModal = function(id) {
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

window.closeEditDeliveryModal = function() {
    editDeliveryModal.classList.remove('active');
    editDeliveryForm.reset();
}

window.saveDeliveryRecord = async function(e) {
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
window.openDeliveryDeleteConfirm = function(id) {
    deliveryRecordToDeleteId = id;
    confirmDeliveryModal.classList.add('active');
}

window.closeDeliveryConfirmModal = function() {
    confirmDeliveryModal.classList.remove('active');
    deliveryRecordToDeleteId = null;
}

window.executeDeleteDeliveryRecord = async function() {
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
window.openDelDefaultersModal = function() {
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

window.closeDelDefaultersModal = function() {
    defaultersDeliveryModal.classList.remove('active');
}

// ----------------------------------------------------
// DELIVERY SUB-VIEW SWITCHING (Facility vs Monthly)
// ----------------------------------------------------
let delCurrentSubView = 'facility'; // 'facility' or 'monthly'
let delMonthlyInitialized = false;

window.switchDelSubView = function(subView) {
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

window.toggleFacilityDropdown = function() {
    const dropdown = document.getElementById('facilityMultiselect');
    dropdown.classList.toggle('open');
    if (dropdown.classList.contains('open')) {
        // Focus search
        setTimeout(() => document.getElementById('facilitySearchInput').focus(), 50);
    }
}

window.toggleFacilityCheckbox = function(facility, event) {
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

window.toggleAllFacilities = function() {
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

window.filterFacilityOptions = function() {
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
document.addEventListener('click', function(e) {
    const dropdown = document.getElementById('facilityMultiselect');
    if (dropdown && !dropdown.contains(e.target)) {
        dropdown.classList.remove('open');
    }
});

window.handleDelMonthlyFilterChange = function() {
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
    tbody.appendChild(totalTr);
}

// Export Monthly Breakdown to Excel
window.exportDelMonthlyToExcel = function() {
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
    XLSX.writeFile(workbook, `Delivery_Monthly_${getFYLabel(fyStart).replace(/\s/g, '_')}_${new Date().toISOString().slice(0,10)}.xlsx`);
}

// Export Monthly Breakdown to PDF
window.exportDelMonthlyToPDF = function() {
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
        didParseCell: function(data) {
            if (data.row.index === tableData.length - 1) {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.textColor = [122, 28, 49];
                data.cell.styles.fillColor = [252, 235, 235];
            }
        },
        margin: { top: 25, bottom: 15, left: 14, right: 14 }
    });

    doc.save(`Delivery_Monthly_${getFYLabel(fyStart).replace(/\s/g, '_')}_${new Date().toISOString().slice(0,10)}.pdf`);
}

// ----------------------------------------------------
// EXPORT TO EXCEL & PDF LOGIC
// ----------------------------------------------------
window.exportEcToExcel = function() {
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

    XLSX.writeFile(workbook, `EC_Meeting_Report_${new Date().toISOString().slice(0,10)}.xlsx`);
}

window.exportEcToPDF = function() {
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
        didParseCell: function(data) {
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
    doc.save(`EC_Meeting_Report_${new Date().toISOString().slice(0,10)}.pdf`);
}

window.exportDelToExcel = function() {
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

    XLSX.writeFile(workbook, `Delivery_Coverage_Report_${new Date().toISOString().slice(0,10)}.xlsx`);
}

window.exportDelToPDF = function() {
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
        didParseCell: function(data) {
            if (data.row.index === tableData.length - 1) {
                data.cell.styles.fontStyle = 'bold';
                data.cell.styles.textColor = [122, 28, 49]; // Maroon
                data.cell.styles.fillColor = [252, 235, 235]; // Light pink
            }
        },
        margin: { top: 25, bottom: 15, left: 14, right: 14 }
    });

    doc.save(`Delivery_Coverage_Report_${new Date().toISOString().slice(0,10)}.pdf`);
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
window.openDefaultersModal = function() {
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

window.closeDefaultersModal = function() {
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
    }
});

// Start dashboard view
initDashboard();
