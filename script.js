// ========================================
// UPI TRANSACTION ANALYTICS - JAVASCRIPT
// ========================================

// Global variables for uploaded data
let uploadedData = [];
let currentPage = 1;
let itemsPerPage = 10;
let filteredData = [];

document.addEventListener('DOMContentLoaded', () => {
    initCharts();
    setupNavigation();
    setupFormHandlers();
    setupUploadHandlers();
    animateOnScroll();
});

// ========== UPLOAD HANDLERS ==========
function setupUploadHandlers() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const browseBtn = document.getElementById('browseBtn');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const clearBtn = document.getElementById('clearBtn');
    const searchInput = document.getElementById('searchInput');
    const bankFilter = document.getElementById('bankFilter');
    const statusFilter = document.getElementById('statusFilter');

    // Drag and drop functionality
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        uploadArea.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, unhighlight, false);
    });

    function highlight(e) {
        uploadArea.classList.add('dragover');
    }

    function unhighlight(e) {
        uploadArea.classList.remove('dragover');
    }

    uploadArea.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }

    // Browse button
    browseBtn.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });

    // Analyze button
    analyzeBtn.addEventListener('click', () => {
        analyzeData();
    });

    // Clear button
    clearBtn.addEventListener('click', () => {
        clearData();
    });

    // Search and filter
    searchInput.addEventListener('input', filterData);
    bankFilter.addEventListener('change', filterData);
    statusFilter.addEventListener('change', filterData);
}

function handleFiles(files) {
    if (files.length === 0) return;

    const file = files[0];
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.csv')) {
        parseCSV(file);
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        parseExcel(file);
    } else {
        showNotification('Please upload a CSV or Excel file', 'error');
        return;
    }

    // Update UI
    document.getElementById('uploadArea').innerHTML = `
        <div class="upload-success">
            <i class="fas fa-check-circle"></i>
            <h3>File Uploaded Successfully</h3>
            <p>${file.name}</p>
        </div>
    `;
}

function parseCSV(file) {
    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            processData(results.data);
        },
        error: function(error) {
            showNotification('Error parsing CSV file', 'error');
            console.error(error);
        }
    });
}

function parseExcel(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // Convert to object format
        const headers = jsonData[0];
        const rows = jsonData.slice(1);
        const dataArray = rows.map(row => {
            const obj = {};
            headers.forEach((header, index) => {
                obj[header] = row[index];
            });
            return obj;
        });

        processData(dataArray);
    };
    reader.readAsArrayBuffer(file);
}

function processData(data) {
    uploadedData = data;
    validateData();
}

function validateData() {
    const requiredColumns = ['User_ID', 'Bank', 'Amount', 'Status', 'Time'];
    const headers = Object.keys(uploadedData[0] || {});
    const missingColumns = requiredColumns.filter(col => !headers.includes(col));

    const validationStatus = document.getElementById('validationStatus');
    const validationIcon = document.getElementById('validationIcon');
    const validationDetails = document.getElementById('validationDetails');

    if (missingColumns.length > 0) {
        validationIcon.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
        validationIcon.className = 'validation-status-icon error';
        validationDetails.innerHTML = `
            <div class="error-message">
                <strong>Invalid Dataset Format</strong>
                <p>Missing required columns: ${missingColumns.join(', ')}</p>
                <p>Required columns: ${requiredColumns.join(', ')}</p>
            </div>
        `;
        document.getElementById('analyzeBtn').disabled = true;
    } else {
        validationIcon.innerHTML = '<i class="fas fa-check-circle"></i>';
        validationIcon.className = 'validation-status-icon success';
        validationDetails.innerHTML = `
            <div class="success-message">
                <strong>✓ Dataset Validated</strong>
                <p>Found ${uploadedData.length} transactions</p>
                <p>All required columns present</p>
            </div>
        `;
        document.getElementById('analyzeBtn').disabled = false;
        document.getElementById('clearBtn').disabled = false;
    }

    validationStatus.style.display = 'block';
}

function analyzeData() {
    if (uploadedData.length === 0) return;

    // Calculate metrics
    const totalTransactions = uploadedData.length;
    const failedTransactions = uploadedData.filter(row => row.Status === 'Failed').length;
    const successRate = ((totalTransactions - failedTransactions) / totalTransactions * 100).toFixed(2);
    const failureRate = (failedTransactions / totalTransactions * 100).toFixed(2);

    // Bank analysis
    const bankStats = {};
    uploadedData.forEach(row => {
        const bank = row.Bank;
        if (!bankStats[bank]) {
            bankStats[bank] = { total: 0, failed: 0 };
        }
        bankStats[bank].total++;
        if (row.Status === 'Failed') {
            bankStats[bank].failed++;
        }
    });

    const bankFailureRates = Object.entries(bankStats).map(([bank, stats]) => ({
        bank,
        failureRate: (stats.failed / stats.total * 100).toFixed(2),
        total: stats.total,
        failed: stats.failed
    })).sort((a, b) => b.failureRate - a.failureRate);

    const worstBank = bankFailureRates[0];

    // Peak failure time analysis
    const hourlyFailures = {};
    uploadedData.filter(row => row.Status === 'Failed').forEach(row => {
        const hour = row.Time ? row.Time.split(':')[0] : 'Unknown';
        hourlyFailures[hour] = (hourlyFailures[hour] || 0) + 1;
    });

    const peakHour = Object.entries(hourlyFailures).sort((a, b) => b[1] - a[1])[0];

    // Churn analysis (simple heuristic: users with >3 failures)
    const userFailures = {};
    uploadedData.forEach(row => {
        const user = row.User_ID;
        if (!userFailures[user]) {
            userFailures[user] = { total: 0, failed: 0 };
        }
        userFailures[user].total++;
        if (row.Status === 'Failed') {
            userFailures[user].failed++;
        }
    });

    const churnUsers = Object.entries(userFailures).filter(([user, stats]) => stats.failed > 2).length;

    // Update dashboard with real data
    updateDashboard(successRate, failureRate, bankFailureRates, peakHour, churnUsers);

    // Show preview
    showDataPreview();

    // Generate insights
    generateInsights(successRate, failureRate, worstBank, peakHour, churnUsers);

    showNotification('✓ Data analysis complete!', 'success');
}

function updateDashboard(successRate, failureRate, bankFailureRates, peakHour, churnUsers) {
    // Update KPI cards
    const totalTransactionsEl = document.querySelector('.kpi-card.success .kpi-value');
    const failureRateEl = document.querySelector('.kpi-card.danger .kpi-value');
    const churnedUsersEl = document.querySelector('.kpi-card.warning .kpi-value');

    if (totalTransactionsEl) totalTransactionsEl.textContent = uploadedData.length.toLocaleString();
    if (failureRateEl) failureRateEl.textContent = failureRate + '%';
    if (churnedUsersEl) churnedUsersEl.textContent = churnUsers;

    // Update charts with real data
    updateCharts(successRate, failureRate, bankFailureRates);
}

function updateCharts(successRate, failureRate, bankFailureRates) {
    // Update pie chart
    const pieChart = Chart.getChart('successFailureChart');
    if (pieChart) {
        pieChart.data.datasets[0].data = [successRate, failureRate];
        pieChart.update();
    }

    // Update bank performance chart
    const bankChart = Chart.getChart('bankPerformanceChart');
    if (bankChart) {
        bankChart.data.labels = bankFailureRates.map(item => item.bank);
        bankChart.data.datasets[0].data = bankFailureRates.map(item => item.failureRate);
        bankChart.update();
    }

    // Update hourly failures chart with real data
    const hourlyFailures = {};
    uploadedData.filter(row => row.Status === 'Failed').forEach(row => {
        const hour = row.Time ? row.Time.split(':')[0] : '00';
        hourlyFailures[hour] = (hourlyFailures[hour] || 0) + 1;
    });

    const hourlyChart = Chart.getChart('hourlyFailuresChart');
    if (hourlyChart) {
        const hours = Array.from({length: 24}, (_, i) => i.toString().padStart(2, '0') + ':00');
        hourlyChart.data.datasets[0].data = hours.map(hour => hourlyFailures[hour.split(':')[0]] || 0);
        hourlyChart.update();
    }
}

function showDataPreview() {
    const previewSection = document.getElementById('previewSection');
    const tableHead = document.getElementById('tableHead');
    const tableBody = document.getElementById('tableBody');
    const bankFilter = document.getElementById('bankFilter');

    // Populate bank filter
    const banks = [...new Set(uploadedData.map(row => row.Bank))];
    bankFilter.innerHTML = '<option value="">All Banks</option>';
    banks.forEach(bank => {
        bankFilter.innerHTML += `<option value="${bank}">${bank}</option>`;
    });

    // Create table headers
    const headers = Object.keys(uploadedData[0]);
    tableHead.innerHTML = '<tr>' + headers.map(header => `<th>${header}</th>`).join('') + '</tr>';

    // Show data
    filteredData = [...uploadedData];
    renderTable();

    previewSection.style.display = 'block';
}

function filterData() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const bankFilter = document.getElementById('bankFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;

    filteredData = uploadedData.filter(row => {
        const matchesSearch = !searchTerm || 
            Object.values(row).some(value => 
                String(value).toLowerCase().includes(searchTerm)
            );
        const matchesBank = !bankFilter || row.Bank === bankFilter;
        const matchesStatus = !statusFilter || row.Status === statusFilter;

        return matchesSearch && matchesBank && matchesStatus;
    });

    currentPage = 1;
    renderTable();
}

function renderTable() {
    const tableBody = document.getElementById('tableBody');
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageData = filteredData.slice(startIndex, endIndex);

    tableBody.innerHTML = pageData.map(row => 
        '<tr>' + Object.values(row).map(value => `<td>${value}</td>`).join('') + '</tr>'
    ).join('');

    renderPagination();
}

function renderPagination() {
    const pagination = document.getElementById('pagination');
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);

    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }

    let paginationHTML = '<button class="page-btn" data-page="prev">«</button>';

    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            paginationHTML += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
        } else if (i === currentPage - 2 || i === currentPage + 2) {
            paginationHTML += '<span class="page-dots">...</span>';
        }
    }

    paginationHTML += '<button class="page-btn" data-page="next">»</button>';

    pagination.innerHTML = paginationHTML;

    // Add event listeners
    document.querySelectorAll('.page-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const page = e.target.dataset.page;
            if (page === 'prev' && currentPage > 1) {
                currentPage--;
            } else if (page === 'next' && currentPage < totalPages) {
                currentPage++;
            } else if (!isNaN(page)) {
                currentPage = parseInt(page);
            }
            renderTable();
        });
    });
}

function generateInsights(successRate, failureRate, worstBank, peakHour, churnUsers) {
    const insightsGrid = document.getElementById('insightsGrid');
    const insights = [
        {
            icon: 'fas fa-percentage',
            title: 'Success Rate',
            text: `${successRate}% of transactions are successful`,
            class: 'success'
        },
        {
            icon: 'fas fa-bank',
            title: 'Worst Performing Bank',
            text: `${worstBank.bank} has ${worstBank.failureRate}% failure rate`,
            class: 'critical'
        },
        {
            icon: 'fas fa-clock',
            title: 'Peak Failure Time',
            text: `Most failures occur at ${peakHour[0]}:00 (${peakHour[1]} failures)`,
            class: 'warning'
        },
        {
            icon: 'fas fa-user-slash',
            title: 'Churn Risk Users',
            text: `${churnUsers} users at risk of churning`,
            class: 'alert'
        }
    ];

    insightsGrid.innerHTML = insights.map(insight => `
        <div class="insight-card-upload ${insight.class}">
            <div class="insight-icon-upload ${insight.class}">
                <i class="${insight.icon}"></i>
            </div>
            <h4>${insight.title}</h4>
            <p>${insight.text}</p>
        </div>
    `).join('');

    document.getElementById('insightsSection').style.display = 'block';
}

function clearData() {
    uploadedData = [];
    filteredData = [];
    
    // Reset UI
    document.getElementById('uploadArea').innerHTML = `
        <div class="upload-icon">
            <i class="fas fa-cloud-upload-alt"></i>
        </div>
        <h3>Drag & Drop CSV File Here</h3>
        <p>or <span class="upload-link" id="browseBtn">browse files</span></p>
        <p class="upload-formats">Supported formats: CSV, Excel (.xlsx)</p>
        <input type="file" id="fileInput" accept=".csv,.xlsx" style="display: none;">
    `;

    document.getElementById('validationStatus').style.display = 'none';
    document.getElementById('previewSection').style.display = 'none';
    document.getElementById('insightsSection').style.display = 'none';

    document.getElementById('analyzeBtn').disabled = true;
    document.getElementById('clearBtn').disabled = true;

    // Re-setup upload handlers for the recreated elements
    setupUploadHandlers();

    showNotification('Data cleared successfully', 'info');
}

// ========== CHART INITIALIZATION ==========
function initCharts() {
    // Chart colors
    const chartColors = {
        success: 'rgb(76, 175, 80)',
        danger: 'rgb(220, 53, 69)',
        warning: 'rgb(255, 152, 0)',
        info: 'rgb(23, 162, 184)',
        primary: 'rgb(26, 58, 82)',
        light: 'rgba(245, 245, 245, 0.5)'
    };

    // 1. Hourly Failures Chart
    const hourlyCtx = document.getElementById('hourlyFailuresChart');
    if (hourlyCtx) {
        new Chart(hourlyCtx, {
            type: 'bar',
            data: {
                labels: ['00:00', '01:00', '02:00', '03:00', '04:00', '05:00', '06:00', '07:00', '08:00', 
                         '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
                         '18:00', '19:00', '20:00', '21:00', '22:00', '23:00'],
                datasets: [{
                    label: 'Failed Transactions',
                    data: [2, 1, 1, 2, 3, 2, 4, 5, 6, 8, 12, 15, 18, 16, 14, 12, 10, 9, 12, 18, 28, 35, 28, 12],
                    backgroundColor: (context) => {
                        const value = context.parsed.y;
                        if (value > 25) return chartColors.danger;
                        if (value > 15) return chartColors.warning;
                        if (value > 10) return chartColors.info;
                        return chartColors.success;
                    },
                    borderRadius: 6,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: true,
                        labels: {
                            font: { size: 12, weight: 600 },
                            usePointStyle: true
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            font: { size: 11 }
                        },
                        grid: {
                            drawBorder: false,
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    },
                    x: {
                        ticks: {
                            font: { size: 10 }
                        },
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }

    // 2. Bank Performance Chart
    const bankCtx = document.getElementById('bankPerformanceChart');
    if (bankCtx) {
        new Chart(bankCtx, {
            type: 'horizontalBar',
            data: {
                labels: ['SBI', 'ICICI', 'HDFC', 'Axis', 'PNB', 'BOB'],
                datasets: [{
                    label: 'Failure Rate (%)',
                    data: [47.3, 12.8, 3.2, 8.5, 15.6, 10.2],
                    backgroundColor: [
                        chartColors.danger,
                        chartColors.warning,
                        chartColors.success,
                        chartColors.info,
                        chartColors.warning,
                        chartColors.info
                    ],
                    borderRadius: 6
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: true,
                        labels: {
                            font: { size: 12, weight: 600 }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        max: 50,
                        ticks: {
                            font: { size: 11 },
                            callback: function(value) {
                                return value + '%';
                            }
                        },
                        grid: {
                            drawBorder: false,
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    },
                    y: {
                        ticks: {
                            font: { size: 12, weight: 600 }
                        },
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }

    // 3. Success vs Failure Pie Chart
    const pieCtx = document.getElementById('successFailureChart');
    if (pieCtx) {
        new Chart(pieCtx, {
            type: 'doughnut',
            data: {
                labels: ['Successful', 'Failed'],
                datasets: [{
                    data: [91.58, 8.42],
                    backgroundColor: [chartColors.success, chartColors.danger],
                    borderColor: ['white', 'white'],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            font: { size: 12, weight: 600 },
                            padding: 20,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.label + ': ' + context.parsed + '%';
                            }
                        }
                    }
                }
            }
        });
    }

    // 4. Risk Distribution Chart
    const riskCtx = document.getElementById('riskDistributionChart');
    if (riskCtx) {
        new Chart(riskCtx, {
            type: 'bar',
            data: {
                labels: ['Low Risk', 'Medium Risk', 'High Risk'],
                datasets: [{
                    label: 'Number of Users',
                    data: [1028, 342, 156],
                    backgroundColor: [chartColors.success, chartColors.warning, chartColors.danger],
                    borderRadius: 6,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                indexAxis: 'x',
                plugins: {
                    legend: {
                        display: true,
                        labels: {
                            font: { size: 12, weight: 600 }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            font: { size: 11 }
                        },
                        grid: {
                            drawBorder: false,
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    },
                    x: {
                        ticks: {
                            font: { size: 12, weight: 600 }
                        },
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }

    // 5. Timeline Chart (Success vs Failure over time)
    const timelineCtx = document.getElementById('timelineChart');
    if (timelineCtx) {
        new Chart(timelineCtx, {
            type: 'line',
            data: {
                labels: ['00:00', '02:00', '04:00', '06:00', '08:00', '10:00', '12:00', '14:00', 
                        '16:00', '18:00', '20:00', '22:00'],
                datasets: [
                    {
                        label: 'Successful',
                        data: [45, 32, 28, 65, 120, 180, 250, 220, 200, 180, 140, 85],
                        borderColor: chartColors.success,
                        backgroundColor: 'rgba(76, 175, 80, 0.1)',
                        borderWidth: 3,
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: chartColors.success,
                        pointBorderColor: 'white',
                        pointBorderWidth: 2,
                        pointRadius: 5,
                        pointHoverRadius: 7
                    },
                    {
                        label: 'Failed',
                        data: [5, 3, 2, 6, 12, 15, 18, 16, 14, 18, 28, 35],
                        borderColor: chartColors.danger,
                        backgroundColor: 'rgba(220, 53, 69, 0.1)',
                        borderWidth: 3,
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: chartColors.danger,
                        pointBorderColor: 'white',
                        pointBorderWidth: 2,
                        pointRadius: 5,
                        pointHoverRadius: 7
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            font: { size: 12, weight: 600 },
                            padding: 20,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: 12,
                        titleFont: { size: 13, weight: 600 },
                        bodyFont: { size: 12 }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            font: { size: 11 }
                        },
                        grid: {
                            drawBorder: false,
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    },
                    x: {
                        ticks: {
                            font: { size: 11 }
                        },
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }

    // 6. Churn Matrix Chart
    const churnCtx = document.getElementById('churnMatrixChart');
    if (churnCtx) {
        new Chart(churnCtx, {
            type: 'bar',
            data: {
                labels: ['Low Risk', 'Medium Risk', 'High Risk'],
                datasets: [
                    {
                        label: 'Active Users',
                        data: [948, 222, 50],
                        backgroundColor: chartColors.success,
                        borderRadius: [6, 6, 0, 0]
                    },
                    {
                        label: 'Churned Users',
                        data: [80, 120, 106],
                        backgroundColor: chartColors.danger,
                        borderRadius: [6, 6, 0, 0]
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    x: {
                        stacked: false,
                        ticks: {
                            font: { size: 12, weight: 600 }
                        },
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        stacked: false,
                        ticks: {
                            font: { size: 11 }
                        },
                        grid: {
                            drawBorder: false,
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            font: { size: 12, weight: 600 },
                            padding: 20
                        }
                    }
                }
            }
        });
    }
}

// ========== NAVIGATION SETUP ==========
function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Remove active class from all links
            navLinks.forEach(l => l.classList.remove('active'));
            
            // Add active class to clicked link
            link.classList.add('active');
            
            // Smooth scroll to section
            const target = link.getAttribute('href');
            if (target.startsWith('#')) {
                const section = document.querySelector(target);
                if (section) {
                    section.scrollIntoView({ behavior: 'smooth' });
                }
            }
        });
    });

    // CTA Button
    const ctaButton = document.querySelector('.cta-button');
    if (ctaButton) {
        ctaButton.addEventListener('click', () => {
            document.querySelector('#dashboard').scrollIntoView({ behavior: 'smooth' });
        });
    }
}

// ========== FORM HANDLERS ==========
function setupFormHandlers() {
    // Download buttons
    const downloadBtns = document.querySelectorAll('.download-btn');
    downloadBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const fileName = btn.closest('.report-card').querySelector('h3').textContent;
            showNotification(`Downloading: ${fileName}...`, 'info');
            setTimeout(() => {
                showNotification(`✓ ${fileName} downloaded successfully!`, 'success');
            }, 1500);
        });
    });

    // View Users buttons
    const viewBtns = document.querySelectorAll('.risk-action');
    viewBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const riskLevel = btn.closest('.risk-card').querySelector('h3').textContent;
            const count = btn.closest('.risk-card').querySelector('.risk-count').textContent;
            showNotification(`Opening ${riskLevel} users (${count})...`, 'info');
        });
    });

    // Schedule Reports Form
    const submitBtn = document.querySelector('.submit-btn');
    if (submitBtn) {
        submitBtn.addEventListener('click', (e) => {
            e.preventDefault();
            
            const frequency = document.querySelector('.scheduling-form select:nth-of-type(1)').value;
            const reportType = document.querySelector('.scheduling-form select:nth-of-type(2)').value;
            const email = document.querySelector('.scheduling-form input[type="email"]').value;
            
            if (!email) {
                showNotification('Please enter an email address', 'error');
                return;
            }
            
            showNotification(`✓ Report scheduled: ${frequency} ${reportType} to ${email}`, 'success');
            
            // Reset form
            document.querySelector('.scheduling-form').reset();
        });
    }
}

// ========== NOTIFICATION SYSTEM ==========
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            ${type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ'} ${message}
        </div>
    `;
    
    // Add styles if not already present
    if (!document.querySelector('style[data-notification]')) {
        const style = document.createElement('style');
        style.setAttribute('data-notification', 'true');
        style.textContent = `
            .notification {
                position: fixed;
                top: 80px;
                right: 20px;
                padding: 15px 20px;
                border-radius: 8px;
                color: white;
                font-weight: 600;
                z-index: 1001;
                animation: slideIn 0.3s ease;
                max-width: 400px;
            }
            
            .notification-success {
                background: rgb(76, 175, 80);
                box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
            }
            
            .notification-error {
                background: rgb(220, 53, 69);
                box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);
            }
            
            .notification-info {
                background: rgb(23, 162, 184);
                box-shadow: 0 4px 12px rgba(23, 162, 184, 0.3);
            }
            
            @keyframes slideIn {
                from {
                    transform: translateX(400px);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            @keyframes slideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(400px);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ========== SCROLL ANIMATIONS ==========
function animateOnScroll() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.animation = 'fadeInUp 0.6s ease-out forwards';
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);
    
    // Observe all cards and containers
    document.querySelectorAll('.kpi-card, .chart-container, .analytics-card, .risk-card, .insight-card, .report-card').forEach(el => {
        el.style.opacity = '0';
        observer.observe(el);
    });
}

// ========== COUNTER ANIMATION ==========
function animateCounter(element, target, duration = 2000) {
    const increment = target / (duration / 16);
    let current = 0;
    
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            element.textContent = target.toLocaleString();
            clearInterval(timer);
        } else {
            element.textContent = Math.floor(current).toLocaleString();
        }
    }, 16);
}

// Start counter animations when page loads
window.addEventListener('load', () => {
    document.querySelectorAll('.kpi-value').forEach(el => {
        const value = parseInt(el.textContent.replace(/,/g, ''));
        if (!isNaN(value)) {
            el.textContent = '0';
            animateCounter(el, value);
        }
    });
});

// ========== RESPONSIVE MOBILE MENU ==========
const navToggle = document.querySelector('.nav-toggle');
const navLinks = document.querySelector('.nav-links');

if (navToggle) {
    navToggle.addEventListener('click', () => {
        navLinks.style.display = navLinks.style.display === 'flex' ? 'none' : 'flex';
    });
}

console.log('✓ UPI Transaction Analytics Dashboard Loaded');
