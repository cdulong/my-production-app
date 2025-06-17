// static/js/monthly_work_area_hours_report.js (Full code for Monthly Reports with Nested Collapsing)
document.addEventListener('DOMContentLoaded', () => {
    const workAreaTableBody = document.querySelector('#monthlyHoursReportTable tbody');
    const employeeTableBody = document.querySelector('#monthlyEmployeeHoursReportTable tbody');
    const reportYearFilter = document.getElementById('reportYearFilter');
    const last12MonthsFilter = document.getElementById('last12MonthsFilter');
    const applyFilterBtn = document.getElementById('applyFilterBtn');
    const chartMessageDiv = document.getElementById('chartMessage');
    const emailChartReportBtn = document.getElementById('emailChartReportBtn');

    let employeeSortBy = 'display_order'; // Default sort column
    let employeeSortDirection = 'asc'; // Default sort direction

    function getMonthName(monthNumber) {
        const date = new Date();
        date.setMonth(monthNumber - 1);
        return date.toLocaleString('en-US', { month: 'long' });
    }

    function getVarianceClass(value) {
        const floatValue = parseFloat(value);
        if (isNaN(floatValue)) return '';
        if (floatValue > 0) return 'variance-positive';
        if (floatValue < 0) return 'variance-negative';
        return 'variance-neutral';
    }

    function getVarianceValueColor(value) {
        if (value < 0) return 'green'; // Negative variance is good
        if (value > 0) return 'red';   // Positive variance is bad
        return '#333'; // Neutral
    }

     function populateYearFilter() {
        const currentYear = new Date().getFullYear();
        // Add options for current year, past 5 years, and future 1 year
        for (let year = currentYear - 5; year <= currentYear + 1; year++) {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            if (year === currentYear) { // Default to current year
                option.selected = true;
            }
            reportYearFilter.appendChild(option);
        }
    }

     function getFilterParams() {
        let params = '';
        if (last12MonthsFilter.checked) {
            params += `last_12_months=true`;
        } else {
            const selectedYear = reportYearFilter.value;
            if (selectedYear) {
                params += `year=${selectedYear}`;
            }
        }
        return params;
    }

    window.toggleWorkAreaYearDetails = function(workAreaName, summaryRow) {
        const sanitizedWorkAreaName = workAreaName.replace(/\s+/g, '-').replace(/\//g, '-');
        const detailRows = document.querySelectorAll(`.year-details-of-${sanitizedWorkAreaName}`); // Selects year summary rows under this work area
        const toggleIcon = summaryRow.querySelector('.toggle-icon');
        let isExpanded = false;

        detailRows.forEach(row => {
            if (row.style.display === 'none' || row.style.display === '') {
                row.style.display = 'table-row'; // Show year summary row
                isExpanded = true;
            } else {
                row.style.display = 'none'; // Hide year summary row
                // If year is collapsed, also collapse any expanded monthly details within it
                const year = row.getAttribute('data-year'); // Get the year from the year summary row
                if (year) {
                    const yearToggleIcon = row.querySelector('.toggle-icon'); // Icon on the year summary row
                    if (yearToggleIcon && yearToggleIcon.classList.contains('fa-minus-circle')) {
                        window.toggleYearMonthlyDetails(year, row); // Call global function to collapse its monthly details
                    }
                }
            }
        });

        if (isExpanded) {
            toggleIcon.classList.remove('fa-plus-circle');
            toggleIcon.classList.add('fa-minus-circle');
            summaryRow.setAttribute('data-expanded', 'true');
        } else {
            toggleIcon.classList.remove('fa-minus-circle');
            toggleIcon.classList.add('fa-plus-circle');
            summaryRow.setAttribute('data-expanded', 'false');
        }
    };


    window.toggleYearMonthlyDetails = function(year, summaryRow) { // This is for Work Area monthly details (Level 3)
        const closestWorkAreaSummaryRow = summaryRow.previousElementSibling.closest('.work-area-summary-row') || summaryRow.closest('.work-area-summary-row');
        const workAreaName = closestWorkAreaSummaryRow.getAttribute('data-work-area-name');
        const sanitizedWorkAreaName = workAreaName.replace(/\s+/g, '-').replace(/\//g, '-');
        const detailRows = document.querySelectorAll(
            `.year-details-of-${year}` + // All monthly details of this year
            `.work-area-monthly-details-of-${sanitizedWorkAreaName}` // AND for this specific work area
        );
        
        const toggleIcon = summaryRow.querySelector('.toggle-icon');
        let isExpanded = false;

        detailRows.forEach(row => {
            if (row.style.display === 'none' || row.style.display === '') {
                row.style.display = 'table-row'; // Show monthly detail row
                isExpanded = true;
            } else {
                row.style.display = 'none'; // Hide monthly detail row
            }
        });

        if (isExpanded) {
            toggleIcon.classList.remove('fa-plus-circle');
            toggleIcon.classList.add('fa-minus-circle');
            summaryRow.setAttribute('data-expanded', 'true');
        } else {
            toggleIcon.classList.remove('fa-minus-circle');
            toggleIcon.classList.add('fa-plus-circle');
            summaryRow.setAttribute('data-expanded', 'false');
        }
    };

    window.toggleEmployeeDetails = function(employeeName, summaryRow) {
        const sanitizedEmployeeName = employeeName.replace(/\s+/g, '-').replace(/\//g, '-');
        const detailRows = document.querySelectorAll(`.employee-details-of-${sanitizedEmployeeName}`);
        const toggleIcon = summaryRow.querySelector('.toggle-icon');
        let isExpanded = false;

        detailRows.forEach(row => {
            if (row.style.display === 'none' || row.style.display === '') {
                row.style.display = 'table-row';
                isExpanded = true;
            } else {
                row.style.display = 'none';
            }
        });

        if (isExpanded) {
            toggleIcon.classList.remove('fa-plus-circle');
            toggleIcon.classList.add('fa-minus-circle');
            summaryRow.setAttribute('data-expanded', 'true');
        } else {
            toggleIcon.classList.remove('fa-minus-circle');
            toggleIcon.classList.add('fa-plus-circle');
            summaryRow.setAttribute('data-expanded', 'false');
        }
    };

    // Helper for generating consistent colors (add more if needed for more work areas)
    const colors = [
        'rgba(255, 99, 132, 0.7)',  // Red
        'rgba(54, 162, 235, 0.7)',  // Blue
        'rgba(255, 206, 86, 0.7)',  // Yellow
        'rgba(75, 192, 192, 0.7)',  // Green
        'rgba(153, 102, 255, 0.7)', // Purple
        'rgba(255, 159, 64, 0.7)',  // Orange
        'rgba(199, 199, 199, 0.7)', // Gray
        'rgba(83, 102, 126, 0.7)',  // Dark Blue Gray
        'rgba(141, 107, 153, 0.7)', // Plum
        'rgba(204, 126, 126, 0.7)', // Salmon
    ];
    let colorIndex = 0;
    function getNextColor() {
        return colors[colorIndex++ % colors.length];
    }

    async function printChartToPDF() {
        showToast('Generating PDF...', 'info');

        setTimeout(async () => {
            const chartCanvas = document.getElementById('monthlyWorkAreaChart');
            const chartContainerDiv = chartCanvas.parentElement; // The div with width/height styles

            if (!chartCanvas || !window.html2canvas || !window.jspdf.jsPDF) {
                showToast('PDF generation libraries not loaded or chart not ready.', 'error');
                console.error('PDF generation libraries or chart not ready.');
                return;
            }

            // Disable button during process to prevent multiple clicks
            const originalButtonText = printChartToPDFBtn.textContent;
            printChartToPDFBtn.textContent = 'Generating PDF...';
            printChartToPDFBtn.disabled = true;

            try {
                // Use html2canvas to capture the content of the chart's container div
                // This ensures the chart title and any legends rendered by Chart.js are captured well.
                const canvas = await html2canvas(chartContainerDiv, {
                    scale: 5, // Increase scale for higher resolution in PDF
                    useCORS: true, // Important if Chart.js loads external images (unlikely here, but good practice)
                    logging: false // Disable html2canvas logs if desired
                });

                const imgData = canvas.toDataURL('image/png'); // Get image data from canvas
                const { jsPDF } = window.jspdf;
                const pdf = new jsPDF('landscape', 'in', 'letter'); // 'landscape' orientation, 'in' units, 'letter' size (8.5x11 inches)
                const pdfWidth = pdf.internal.pageSize.getWidth();  // Will be 11 inches for landscape letter
                const pdfHeight = pdf.internal.pageSize.getHeight(); // Will be 8.5 inches for landscape letter
                const imgAspectRatio = canvas.width / canvas.height;
                let imgWidth = pdfWidth; // Start by assuming image fills width
                let imgHeight = pdfWidth / imgAspectRatio; // Calculate height based on this width

                if (imgHeight > pdfHeight) {
                    imgHeight = pdfHeight; // Image fills height
                    imgWidth = pdfHeight * imgAspectRatio; // Calculate width based on this height
                }

                const x = (pdfWidth - imgWidth) / 2;
                const y = (pdfHeight - imgHeight) / 2;

                pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
                pdf.save('Monthly_Work_Area_Report.pdf');

            } catch (error) {
                showToast(`Failed to generate PDF: ${error.message}`,'error');
            } finally {
                printChartToPDFBtn.textContent = originalButtonText;
                printChartToPDFBtn.disabled = false;
            }
        }, 50);
    }

    // --- NEW: Email Chart Report Function ---
    async function emailChartReport() {
        showToast('Generating report image...','info');

        setTimeout(async () => {
            const chartCanvas = document.getElementById('monthlyWorkAreaChart');
            const chartContainerDiv = chartCanvas.parentElement;
            const workAreaTable = document.getElementById('monthlyHoursReportTable'); // Get the Work Area table (full HTML)
            const employeeTable = document.getElementById('monthlyEmployeeHoursReportTable'); // Get the Employee table (for summary extraction)

            if (!chartCanvas || !window.html2canvas || !workAreaTable || !employeeTable) {
                showToast('Chart or report tables not ready for email. Please ensure data is loaded.','error');
                console.error('Chart or report tables not found for email generation.');
                return;
            }

            const originalButtonText = emailChartReportBtn.textContent;
            emailChartReportBtn.textContent = 'Sending...';
            emailChartReportBtn.disabled = true;

            try {
                // 1. Capture chart as image
                const canvas = await html2canvas(chartContainerDiv, {
                    scale: 2, // Scale 2 for email image
                    useCORS: true,
                    willReadFrequently: true,
                    logging: false
                });
                const chartImageData = canvas.toDataURL('image/png');

                // 2. Capture HTML content of the tables
                // --- CRITICAL FIX: Capture Work Area table content and apply conditional styling ---
                let workAreaTableHtml = '';
                const workAreaSummaryRowsEmail = workAreaTable.querySelectorAll('.work-area-summary-row'); // Get summary rows
                const workAreaDetailRowsEmail = workAreaTable.querySelectorAll('.work-area-detail-row'); // Get detail rows

                if (workAreaSummaryRowsEmail.length > 0) {
                    workAreaTableHtml += `
                        <table border="1" style="border: 1px solid #ddd; width:100%; border-collapse: collapse; font-size: 13px;">
                            <thead>
                                <tr>
                                    <th style="text-align: left; padding: 8px; background-color: #f2f2f2;">Work Area</th>
                                    <th style="text-align: center; padding: 8px; background-color: #f2f2f2;">Forecasted Hours</th>
                                    <th style="text-align: center; padding: 8px; background-color: #f2f2f2;">Actual Hours</th>
                                    <th style="text-align: center; padding: 8px; background-color: #f2f2f2;">Variance (Hrs)</th>
                                    <th style="text-align: center; padding: 8px; background-color: #f2f2f2;">Variance (%)</th>
                                </tr>
                            </thead>
                            <tbody>
                    `;
                    
                    // Add Work Area Summary Rows
                    workAreaSummaryRowsEmail.forEach(row => {
                        const cells = row.querySelectorAll('td');
                        if (cells.length >= 5) {
                            const waNameText = cells[0].textContent.trim().replace(/\s*<i[^>]*><\/i>\s*/, '');
                            const forecastText = cells[1].textContent.trim();
                            const actualText = cells[2].textContent.trim();
                            const varianceText = cells[3].textContent.trim();
                            const variancePctText = cells[4].textContent.trim();

                            const varianceValue = parseFloat(cells[3].getAttribute('data-variance-signed'));
                            const variancePctValue = parseFloat(cells[4].getAttribute('data-variance-signed'));

                            workAreaTableHtml += `
                                <tr>
                                    <td style="font-weight:bold; text-align: left; padding: 8px; border: 1px solid #ddd;">${waNameText}</td>
                                    <td style="text-align: center; padding: 8px; border: 1px solid #ddd;">${forecastText}</td>
                                    <td style="text-align: center; padding: 8px; border: 1px solid #ddd;">${actualText}</td>
                                    <td style="text-align: center; padding: 8px; border: 1px solid #ddd; color: ${getVarianceValueColor(varianceValue)};">${varianceText}</td>
                                    <td style="text-align: center; padding: 8px; border: 1px solid #ddd; color: ${getVarianceValueColor(variancePctValue)};">${variancePctText}</td>
                                </tr>
                            `;
                        }
                    });

                    workAreaTableHtml += `</tbody></table>`;
                } else {
                    workAreaTableHtml = '<p>No work area data available.</p>';
                }
                
                let employeeSummaryHtml = '';
                const employeeSummaryRows = employeeTable.querySelectorAll('.employee-summary-row'); 
                if (employeeSummaryRows.length > 0) {
                    employeeSummaryHtml += `
                        <table border="1" style="border: 1px solid #ddd; width:100%; border-collapse: collapse; margin-top: 10px; font-size: 13px;">
                            <thead>
                                <tr>
                                    <th style="text-align: left; padding: 8px; background-color: #f2f2f2;">Employee Name</th>
                                    <th style="text-align: center; padding: 8px; background-color: #f2f2f2;">Forecasted Hours</th>
                                    <th style="text-align: center; padding: 8px; background-color: #f2f2f2;">Actual Hours</th>
                                    <th style="text-align: center; padding: 8px; background-color: #f2f2f2;">Variance (Hrs)</th>
                                    <th style="text-align: center; padding: 8px; background-color: #f2f2f2;">Variance (%)</th>
                                </tr>
                            </thead>
                            <tbody>
                    `;
                    
                    employeeSummaryRows.forEach(row => {
                        const cells = row.querySelectorAll('td');
                        if (cells.length >= 5) {
                            const nameCellText = cells[0].textContent.trim().replace(/\s*<i[^>]*><\/i>\s*/, '');
                            const forecastText = cells[1].textContent.trim();
                            const actualText = cells[2].textContent.trim();
                            const varianceText = cells[3].textContent.trim();
                            const variancePctText = cells[4].textContent.trim();

                            const varianceValue = parseFloat(cells[3].getAttribute('data-variance-signed'));
                            const variancePctValue = parseFloat(cells[4].getAttribute('data-variance-signed'));

                            employeeSummaryHtml += `
                                <tr>
                                    <td style="font-weight:bold; text-align: left; padding: 8px; border: 1px solid #ddd;">${nameCellText}</td>
                                    <td style="text-align: center; padding: 8px; border: 1px solid #ddd;">${forecastText}</td>
                                    <td style="text-align: center; padding: 8px; border: 1px solid #ddd;">${actualText}</td>
                                    <td style="text-align: center; padding: 8px; border: 1px solid #ddd; color: ${getVarianceValueColor(varianceValue)};">${varianceText}</td>
                                    <td style="text-align: center; padding: 8px; border: 1px solid #ddd; color: ${getVarianceValueColor(variancePctValue)};">${variancePctText}</td>
                                </tr>
                            `;
                        }
                    });
                    employeeSummaryHtml += `</tbody></table>`;
                } else {
                    employeeSummaryHtml = '<p>No employee data available.</p>';
                }

                // Send image data AND table HTML content to backend
                const response = await fetch('/api/reports/email-monthly-report', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        //recipient: recipientEmail,
                        image_data: chartImageData,
                        subject: 'Monthly Performance Report',
                        work_area_summary_html: workAreaTableHtml, // Full HTML for Work Area table
                        employee_summary_html: employeeSummaryHtml // Reconstructed HTML for Employee summary table
                    })
                });

                if (response.ok) {
                    showToast('Report email sent successfully!','success');
                } else {
                    const error = await response.json();
                    showToast(`Failed to send email: ${error.message}`,'error');
                    console.error('Email send error:', error);
                }
            } catch (error) {
                console.error("Error capturing chart or sending email:", error);
                showToast(`An unexpected error occurred while sending email: ${error.message}`,'error');
            } finally {
                emailChartReportBtn.textContent = originalButtonText;
                emailChartReportBtn.disabled = false;
            }
        }, 50);
    }


    async function renderWorkAreaHoursChart() {
        try {
            const chartCanvas = document.getElementById('monthlyWorkAreaChart');
            // No longer need chartContainerDiv. We will interact with chartCanvas directly.
            // const chartContainerDiv = chartCanvas.parentElement; 

            if (!chartCanvas || !window.html2canvas || !window.jspdf.jsPDF) {
                // If canvas itself isn't found (e.g., initial load problem), show generic error in parent
                const parentOfCanvas = document.getElementById('monthlyWorkAreaChart').parentElement;
                parentOfCanvas.innerHTML = '<p style="text-align:center; color:red;">Chart element not found or libraries not loaded.</p>';
                return;
            }

            // Initially hide canvas and show message, then reverse if data found
            chartCanvas.style.display = 'none';
            chartMessageDiv.style.display = 'flex'; // Show message by default, until data is processed
            chartMessageDiv.querySelector('p').textContent = 'Loading chart data...';
            const filterParams = getFilterParams(); // Get filters
            
            // Fetch Work Area data for bars
            const workAreaResponse = await fetch(`/api/reports/monthly-work-area-hours?${filterParams}`); // Add params
            
            if (!workAreaResponse.ok) {
                const errorData = await workAreaResponse.json();
                throw new Error(`HTTP error! Status: ${workAreaResponse.status}, Message: ${errorData.message || 'Unknown error'}`);
            }
            const workAreaReportData = await workAreaResponse.json();

            // Fetch Company Actuals data for lines
            const companyActualsResponse = await fetch(`/api/reports/monthly-company-actuals?${filterParams}`); // Add params
            if (!companyActualsResponse.ok) {
                const errorData = await companyActualsResponse.json();
                throw new Error(`HTTP error! Status: ${companyActualsResponse.status}, Message: ${errorData.message || 'Unknown error'}`);
            }
            const companyActualsReportData = await companyActualsResponse.json();

            if (workAreaReportData.length === 0 && companyActualsReportData.length === 0) {
                // No data: keep canvas hidden, show message
                chartMessageDiv.querySelector('p').textContent = 'No data available to generate chart.';
                chartMessageDiv.style.display = 'flex'; // Ensure message is visible
                // Destroy existing chart instance if any (important for not leaving old chart active)
                if (window.monthlyWorkAreaChartInstance) {
                    window.monthlyWorkAreaChartInstance.destroy();
                    window.monthlyWorkAreaChartInstance = null; // Clear instance
                }
                printChartToPDFBtn.disabled = true; // Disable print button if no chart
                return;
            }

            // --- Data Preparation and Chart Rendering (Only if data exists) ---
            // Ensure chartMessageDiv is hidden and canvas is shown before rendering
            chartMessageDiv.style.display = 'none';
            chartCanvas.style.display = 'block'; // Show canvas
            printChartToPDFBtn.disabled = false; // Enable print button

            // Define custom grouping for work areas
            const workAreaGroupMap = {
                'Build/Prep/Hang': 'Manufacturing',
                'CNC/EB': 'Manufacturing',
                // Add other mappings here if needed, e.g.: 'Welding': 'Assembly_Group'
            };

            // --- Data Preparation for Chart.js ---
            const allMonths = new Set();
            workAreaReportData.forEach(row => allMonths.add(`${row.year}-${String(row.month).padStart(2, '0')}`));
            companyActualsReportData.forEach(row => allMonths.add(`${row.year}-${String(row.month).padStart(2, '0')}`));

            const chartLabels = Array.from(allMonths).sort().map(monthYear => {
                const [year, month] = monthYear.split('-');
                return `${getMonthName(parseInt(month))} ${year}`;
            });

            // Datasets for Work Area Bars (Actual Hours) - MODIFIED FOR GROUPING
            const aggregatedWorkAreaData = new Map(); // Map<GroupName, Map<MonthYearKey, TotalHours>>

            workAreaReportData.forEach(row => {
                const originalWorkAreaName = row.work_area_name;
                const groupName = workAreaGroupMap[originalWorkAreaName] || originalWorkAreaName; // Get group name or original name
                const monthYearKey = `${row.year}-${String(row.month).padStart(2, '0')}`;
                
                if (!aggregatedWorkAreaData.has(groupName)) {
                    aggregatedWorkAreaData.set(groupName, new Map());
                }
                const monthDataMap = aggregatedWorkAreaData.get(groupName);
                monthDataMap.set(monthYearKey, (monthDataMap.get(monthYearKey) || 0) + parseFloat(row.total_actual_hours));
            });

            // Convert aggregated data into Chart.js datasets format
            const workAreaDatasets = [];
            colorIndex = 0; // Reset color index for work areas
            aggregatedWorkAreaData.forEach((monthDataMap, groupName) => {
                const dataPoints = Array(chartLabels.length).fill(0);
                chartLabels.forEach((label, index) => {
                    const [monthName, year] = label.split(' ');
                    const monthNumber = String(new Date(Date.parse(monthName + " 1, " + year)).getMonth() + 1).padStart(2, '0');
                    const monthYearKey = `${year}-${monthNumber}`;
                    dataPoints[index] = monthDataMap.get(monthYearKey) || 0;
                });

                workAreaDatasets.push({
                    label: groupName + ' (Hours)',
                    data: dataPoints,
                    backgroundColor: getNextColor(),
                    borderColor: 'rgba(0, 0, 0, 0.1)',
                    borderWidth: 1,
                    type: 'bar', // Explicitly bar type
                    yAxisID: 'yHours', // Assign to Hours Y-axis
                    pointStyle: 'rect' // --- CRITICAL FIX: Add this line for bar datasets ---
                });
            });

            // Datasets for Company Actuals Lines
            const companyDPHData = Array(chartLabels.length).fill(0);
            const companyBoxesData = Array(chartLabels.length).fill(0);
            const companyTotalHoursData = Array(chartLabels.length).fill(0); // For total company hours line
            
            // Re-aggregate total actual hours for company-wide line accurately from original data
            const totalHoursMap = new Map(); // Map<month-year-key, total_actual_hours>
            workAreaReportData.forEach(row => { // Use original data for company totals
                const monthYearKey = `${row.year}-${String(row.month).padStart(2, '0')}`;
                totalHoursMap.set(monthYearKey, (totalHoursMap.get(monthYearKey) || 0) + parseFloat(row.total_actual_hours));
            });

            companyActualsReportData.forEach(row => {
                const monthYearKey = `${row.year}-${String(row.month).padStart(2, '0')}`;
                const labelIndex = chartLabels.indexOf(`${getMonthName(row.month)} ${row.year}`);
                if (labelIndex !== -1) {
                    companyDPHData[labelIndex] = parseFloat(row.total_actual_dph);
                    companyBoxesData[labelIndex] = row.total_actual_boxes;
                    companyTotalHoursData[labelIndex] = totalHoursMap.get(monthYearKey) || 0; // Get company-wide total hours
                }
            });

            // Prepare all datasets for Chart.js
            const allDatasets = workAreaDatasets; // Start with work area bars

            allDatasets.push({
                label: 'Company Actual $/Hour',
                data: companyDPHData,
                borderColor: 'rgba(255, 165, 0, 1)', // Orange
                backgroundColor: 'rgba(255, 165, 0, 0.2)',
                type: 'line', // Explicitly line type
                yAxisID: 'yDPH', // Assign to DPH Y-axis
                tension: 0.3, // Smooth line
                fill: false,
                pointRadius: 5,
                pointStyle: 'line' // --- CRITICAL FIX: Add this line ---
            });

            allDatasets.push({
                label: 'Company Actual Boxes',
                data: companyBoxesData,
                borderColor: 'rgba(0, 128, 0, 1)', // Green
                backgroundColor: 'rgba(0, 128, 0, 0.2)',
                type: 'line', // Explicitly line type
                yAxisID: 'yBoxes', // Assign to Boxes Y-axis
                tension: 0.3,
                fill: false,
                pointRadius: 5,
                pointStyle: 'line' // --- CRITICAL FIX: Add this line ---
            });

            // Optional: Line for Total Company Actual Hours
            allDatasets.push({
                label: 'Company Total Actual Hours',
                data: companyTotalHoursData,
                borderColor: 'rgba(128, 0, 128, 1)', // Purple
                backgroundColor: 'rgba(128, 0, 128, 0.2)',
                type: 'line',
                yAxisID: 'yHours', // Assign to Hours Y-axis
                borderDash: [5, 5], // Dashed line
                tension: 0.3,
                fill: false,
                pointRadius: 3,
                pointStyle: 'line' // --- CRITICAL FIX: Add this line ---
            });


            const chartData = {
                labels: chartLabels,
                datasets: allDatasets
            };

            const ctx = document.getElementById('monthlyWorkAreaChart').getContext('2d');
            
            // Destroy existing chart instance if any (important for re-rendering)
            if (window.monthlyWorkAreaChartInstance) {
                window.monthlyWorkAreaChartInstance.destroy();
            }

            window.monthlyWorkAreaChartInstance = new Chart(ctx, {
                type: 'bar', // Default type for the chart
                data: chartData,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Monthly Performance: Actual Hours by Work Area vs. Company Totals'
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false // Show all data for the hovered index
                        },
                        // --- CRITICAL FIX: Customize Legend Labels ---
                        legend: {
                            labels: {
                                usePointStyle: true, // This is key: tells Chart.js to use pointStyle from dataset
                                // generateLabels: function(chart) { // If more complex customization needed, like drawing custom line
                                //     const datasets = chart.data.datasets;
                                //     return datasets.map((dataset, i) => ({
                                //         text: dataset.label,
                                //         fillStyle: dataset.backgroundColor || dataset.borderColor,
                                //         strokeStyle: dataset.borderColor || dataset.backgroundColor,
                                //         lineWidth: dataset.borderWidth,
                                //         hidden: !chart.isDatasetVisible(i),
                                //         // Use pointStyle for line datasets
                                //         pointStyle: dataset.type === 'line' ? 'line' : 'rect',
                                //         datasetIndex: i,
                                //     }));
                                // }
                            }
                        }
                        // --- END CRITICAL FIX ---
                    },
                    scales: {
                        x: {
                            stacked: false, // Not stacked if showing separate bars per work area
                            title: {
                                display: true,
                                text: 'Month/Year'
                            }
                        },
                        yHours: { // Y-axis for Hours (Bars & Company Total Hours Line)
                            type: 'linear',
                            position: 'left',
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Actual Hours'
                            },
                            grid: {
                                drawOnChartArea: true, // Only draw grid lines for this axis
                            },
                        },
                        yDPH: { // Y-axis for Dollars Per Hour (Line)
                            type: 'linear',
                            position: 'right',
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Actual $/Hour'
                            },
                            grid: {
                                drawOnChartArea: false, // Do not draw grid lines for this axis
                            },
                            ticks: {
                                callback: function(value) {
                                    return '$' + value.toFixed(2);
                                }
                            }
                        },
                        yBoxes: { // Y-axis for Boxes (Line)
                            type: 'linear',
                            position: 'right',
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Actual Boxes'
                            },
                            grid: {
                                drawOnChartArea: false, // Do not draw grid lines for this axis
                            },
                            // Custom position to avoid overlap with yDPH if they are on same side
                            // Can adjust offset if needed.
                        }
                    }
                }
            });

        } catch (error) {
            console.error("Error rendering monthly work area chart:", error);
            // On error, hide canvas, show message
            chartCanvas.style.display = 'none';
            chartMessageDiv.style.display = 'flex';
            chartMessageDiv.querySelector('p').textContent = `Error loading chart: ${error.message}`;
            printChartToPDFBtn.disabled = true; // Disable print button on error
        }
    }

    // --- Function to fetch and display Work Area Report with Nested Collapsing (Work Area -> Year -> Month) ---
    async function fetchMonthlyWorkAreaHoursReport() {
        const filterParams = getFilterParams(); // Get filters
        workAreaTableBody.innerHTML = '<tr><td colspan="5">Loading monthly work area report...</td></tr>';
        try {
            const response = await fetch(`/api/reports/monthly-work-area-hours?${filterParams}`); // Add params
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`HTTP error! status: ${response.status}, Message: ${errorData.message || 'Unknown error'}`);
            }
            const reportData = await response.json(); // Data is sorted by Work Area, then Year, then Month
            workAreaTableBody.innerHTML = '';

            if (reportData.length === 0) {
                workAreaTableBody.innerHTML = '<tr><td colspan="5">No monthly work area data available.</td></tr>';
                return;
            }

            // Group data first by Work Area, then by Year
            const groupedByWorkArea = reportData.reduce((acc, row) => {
                if (!acc[row.work_area_name]) {
                    acc[row.work_area_name] = {}; // Nested object for years
                }
                if (!acc[row.work_area_name][row.year]) {
                    acc[row.work_area_name][row.year] = []; // Array for months within year
                }
                acc[row.work_area_name][row.year].push(row);
                return acc;
            }, {});

            // Iterate over each Work Area group (Level 1)
            for (const workAreaName in groupedByWorkArea) {
                const yearsInWorkArea = groupedByWorkArea[workAreaName];
                
                // Calculate totals for the Work Area Summary Row
                let totalForecastedWorkArea = 0;
                let totalActualWorkArea = 0;
                for (const year in yearsInWorkArea) {
                    yearsInWorkArea[year].forEach(monthData => {
                        totalForecastedWorkArea += parseFloat(monthData.total_forecasted_hours);
                        totalActualWorkArea += parseFloat(monthData.total_actual_hours);
                    });
                }
                const varianceWorkArea = totalActualWorkArea - totalForecastedWorkArea;
                const variancePctWorkArea = (totalForecastedWorkArea !== 0) ? (varianceWorkArea / totalForecastedWorkArea * 100) : 0;

                // Create Work Area Summary Row (Level 1 Row)
                const workAreaSummaryRow = workAreaTableBody.insertRow();
                workAreaSummaryRow.classList.add('work-area-summary-row');
                // Sanitize workAreaName for CSS class lookup (must match how it's created)
                const sanitizedWorkAreaNameForClass = workAreaName.replace(/\s+/g, '-').replace(/\//g, '-');
                workAreaSummaryRow.setAttribute('data-work-area-name', workAreaName); // Link details to work area

                const waToggleCell = workAreaSummaryRow.insertCell();
                waToggleCell.innerHTML = `<i class="fas fa-plus-circle toggle-icon"></i> ${workAreaName}`; // Plus icon
                waToggleCell.colSpan = 1; // Spans just the Work Area/Year/Month column
                
                workAreaSummaryRow.insertCell().textContent = totalForecastedWorkArea.toFixed(2);
                workAreaSummaryRow.insertCell().textContent = totalActualWorkArea.toFixed(2);
                
                const varWaCell = workAreaSummaryRow.insertCell();
                varWaCell.textContent = `${Math.abs(varianceWorkArea).toFixed(2)}`;
                varWaCell.classList.add(getVarianceClass(varianceWorkArea));
                varWaCell.setAttribute('data-variance-signed', varianceWorkArea);

                const varPctWaCell = workAreaSummaryRow.insertCell();
                varPctWaCell.textContent = `${Math.abs(variancePctWorkArea).toFixed(2)}%`;
                varPctWaCell.classList.add(getVarianceClass(variancePctWorkArea));
                varPctWaCell.setAttribute('data-variance-signed', variancePctWorkArea);

                // Add click listener to Work Area summary row to toggle Year details
                workAreaSummaryRow.onclick = (event) => {
                    // Stop propagation if clicking on nested elements (like the icon itself)
                    if (event.target.tagName === 'I' || event.target.tagName === 'SPAN') {
                        event.stopPropagation();
                    }
                    window.toggleWorkAreaYearDetails(workAreaName, workAreaSummaryRow); // Call global function
                };

                // Create Year Summary Rows (Level 2 Rows, initially hidden under Work Area)
                for (const year in yearsInWorkArea) {
                    const monthsInYear = yearsInWorkArea[year]; // Data for months within this year
                    
                    let totalForecastedYear = 0;
                    let totalActualYear = 0;
                    monthsInYear.forEach(monthData => {
                        totalForecastedYear += parseFloat(monthData.total_forecasted_hours);
                        totalActualYear += parseFloat(monthData.total_actual_hours);
                    });
                    const varianceYear = totalActualYear - totalForecastedYear;
                    const variancePctYear = (totalForecastedYear !== 0) ? (varianceYear / totalForecastedYear * 100) : 0;

                    const yearSummaryRow = workAreaTableBody.insertRow();
                    yearSummaryRow.classList.add('year-summary-row');
                    yearSummaryRow.classList.add(`work-area-year-details-of-${sanitizedWorkAreaNameForClass}`); // CRITICAL FIX: Link to Work Area's Year details
                    yearSummaryRow.setAttribute('data-year', year); // Link to year details

                    yearSummaryRow.style.display = 'none'; // Hidden by default under work area

                    const yearToggleCell = yearSummaryRow.insertCell();
                    yearToggleCell.innerHTML = `<i class="fas fa-plus-circle toggle-icon" style="margin-left: 20px;"></i>${year}`; // Indent icon
                    yearToggleCell.colSpan = 1; // Spans 1 column
                    
                    yearSummaryRow.insertCell().textContent = totalForecastedYear.toFixed(2);
                    yearSummaryRow.insertCell().textContent = totalActualYear.toFixed(2);
                    
                    const varYearCell = yearSummaryRow.insertCell();
                    varYearCell.textContent = `${Math.abs(varianceYear).toFixed(2)}`;
                    varYearCell.classList.add(getVarianceClass(varianceYear));
                    varYearCell.setAttribute('data-variance-signed', varianceYear);

                    const varPctYearCell = yearSummaryRow.insertCell();
                    varPctYearCell.textContent = `${Math.abs(variancePctYear).toFixed(2)}%`;
                    varPctYearCell.classList.add(getVarianceClass(variancePctYear));
                    varPctYearCell.setAttribute('data-variance-signed', variancePctYear);

                    // Add click listener to Year summary row to toggle monthly details
                    yearSummaryRow.onclick = (event) => {
                        if (event.target.tagName === 'I' || event.target.tagName === 'SPAN') {
                            event.stopPropagation();
                        }
                        window.toggleYearMonthlyDetails(year, yearSummaryRow); // Call global function
                    };

                    // Create Work Area Monthly Detail Rows (Level 3 Rows, initially hidden under Year)
                    monthsInYear.forEach(monthData => {
                        const detailRow = workAreaTableBody.insertRow();
                        detailRow.classList.add('work-area-detail-row');
                        detailRow.classList.add(`year-details-of-${year}`); // Link to year summary
                        detailRow.classList.add(`work-area-monthly-details-of-${sanitizedWorkAreaNameForClass}`); // Link to work area monthly details

                        detailRow.style.display = 'none'; // Hidden by default under year

                        detailRow.insertCell().textContent = `${getMonthName(monthData.month)}`; // ${monthData.year}`;
                        detailRow.insertCell().textContent = monthData.total_forecasted_hours;
                        detailRow.insertCell().textContent = monthData.total_actual_hours;

                        const forecasted = parseFloat(monthData.total_forecasted_hours);
                        const actual = parseFloat(monthData.total_actual_hours);

                        const variance = actual - forecasted;
                        const variancePct = (forecasted !== 0) ? (variance / forecasted * 100) : 0;

                        const varCell = detailRow.insertCell();
                        varCell.textContent = `${Math.abs(variance).toFixed(2)}`;
                        varCell.classList.add(getVarianceClass(variance));
                        varCell.setAttribute('data-variance-signed', variance);

                        const varPctCell = detailRow.insertCell();
                        varPctCell.textContent = `${Math.abs(variancePct).toFixed(2)}%`;
                        varPctCell.classList.add(getVarianceClass(variancePct));
                        varPctCell.setAttribute('data-variance-signed', variancePct);
                    });
                }
            }

        } catch (error) {
            console.error("Error fetching monthly work area report:", error);
            showToast(`Failed to load monthly work area report: ${error.message}`,'error');
            workAreaTableBody.innerHTML = `<tr><td colspan="5" style="color:red;">Error loading report: ${error.message}</td></tr>`;
        }
    }

    // --- Toggle Function for Work Area Year Details (Work Area -> Year) ---
    // Defined here to be easily callable globally via window.
    window.toggleWorkAreaYearDetails = function(workAreaName, summaryRow) {
        const sanitizedWorkAreaName = workAreaName.replace(/\s+/g, '-').replace(/\//g, '-');
        const detailRows = document.querySelectorAll(`.work-area-year-details-of-${sanitizedWorkAreaName}`); // Selects year summary rows under this work area
        const toggleIcon = summaryRow.querySelector('.toggle-icon');
        let isExpanded = false;

        detailRows.forEach(row => {
            if (row.style.display === 'none' || row.style.display === '') {
                row.style.display = 'table-row'; // Show year summary row
                isExpanded = true;
            } else {
                row.style.display = 'none'; // Hide year summary row
                // If year is collapsed, also collapse any expanded monthly details within it
                const year = row.getAttribute('data-year'); // Get the year from the year summary row
                if (year) {
                    const yearToggleIcon = row.querySelector('.toggle-icon'); // Icon on the year summary row
                    if (yearToggleIcon && yearToggleIcon.classList.contains('fa-minus-circle')) {
                        window.toggleYearMonthlyDetails(year, row); // Call global function to collapse its monthly details
                    }
                }
            }
        });

        if (isExpanded) {
            toggleIcon.classList.remove('fa-plus-circle');
            toggleIcon.classList.add('fa-minus-circle');
            summaryRow.setAttribute('data-expanded', 'true');
        } else {
            toggleIcon.classList.remove('fa-minus-circle');
            toggleIcon.classList.add('fa-plus-circle');
            summaryRow.setAttribute('data-expanded', 'false');
        }
    };


    // --- Toggle Function for Year Monthly Details (Year -> Month) ---
    // Defined here to be easily callable globally via window.
    window.toggleYearMonthlyDetails = function(year, summaryRow) { // This is for Work Area monthly details (Level 3)
        // Get the work area name from the work area summary row (parent of year summary row)
        // Use a more robust way to find the closest work area summary row for context
        const closestWorkAreaSummaryRow = summaryRow.previousElementSibling.closest('.work-area-summary-row') || summaryRow.closest('.work-area-summary-row');
        const workAreaName = closestWorkAreaSummaryRow.getAttribute('data-work-area-name');
        const sanitizedWorkAreaName = workAreaName.replace(/\s+/g, '-').replace(/\//g, '-');
        
        // Select only monthly details under that year, and for this specific work area
        const detailRows = document.querySelectorAll(
            `.year-details-of-${year}.work-area-detail-row` + // All monthly details of this year
            `.work-area-monthly-details-of-${sanitizedWorkAreaName}` // AND for this specific work area
        );
        
        const toggleIcon = summaryRow.querySelector('.toggle-icon');
        let isExpanded = false;

        detailRows.forEach(row => {
            if (row.style.display === 'none' || row.style.display === '') {
                row.style.display = 'table-row'; // Show monthly detail row
                isExpanded = true;
            } else {
                row.style.display = 'none'; // Hide monthly detail row
            }
        });

        if (isExpanded) {
            toggleIcon.classList.remove('fa-plus-circle');
            toggleIcon.classList.add('fa-minus-circle');
            summaryRow.setAttribute('data-expanded', 'true');
        } else {
            toggleIcon.classList.remove('fa-minus-circle');
            toggleIcon.classList.add('fa-plus-circle');
            summaryRow.setAttribute('data-expanded', 'false');
        }
    }


    // --- Function to fetch and display Employee Report (Refactored to use existing toggle) ---
    async function fetchMonthlyEmployeeHoursReport() {
        employeeTableBody.innerHTML = '<tr><td colspan="5">Loading monthly employee report...</td></tr>';
        try {
            const filterParams = getFilterParams();
            // Backend now provides base-sorted data, frontend will do the primary sort
            const response = await fetch(`/api/reports/monthly-employee-hours?${filterParams}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`HTTP error! status: ${response.status}, Message: ${errorData.message || 'Unknown error'}`);
            }
            const reportData = await response.json();
            employeeTableBody.innerHTML = '';

            if (reportData.length === 0) {
                employeeTableBody.innerHTML = '<tr><td colspan="5">No monthly employee data available.</td></tr>';
                return;
            }

            // Group data by employee name (backend sends it sorted by display_order, then year/month)
            const groupedByEmployee = reportData.reduce((acc, row) => {
                if (!acc[row.employee_name]) {
                    acc[row.employee_name] = [];
                }
                acc[row.employee_name].push(row);
                return acc;
            }, {});
            
            // --- NEW: Perform primary sorting (by total aggregate) on the frontend ---
            const employeeGroupsArray = Object.values(groupedByEmployee).map(employeeMonths => {
                // Calculate employee-level totals for sorting
                let totalForecasted = 0;
                let totalActual = 0;
                let employeeId = employeeMonths[0].employee_id; // Get employee ID from first month
                let employeeName = employeeMonths[0].employee_name;
                let displayOrder = employeeMonths[0].display_order;

                employeeMonths.forEach(monthData => {
                    totalForecasted += parseFloat(monthData.total_forecasted_hours);
                    totalActual += parseFloat(monthData.total_actual_hours);
                });
                
                const variance = totalActual - totalForecasted;
                const variancePct = (totalForecasted !== 0) ? (variance / totalForecasted * 100) : 0;

                return {
                    employee_id: employeeId,
                    employee_name: employeeName,
                    display_order: displayOrder,
                    total_forecasted_hours: totalForecasted,
                    total_actual_hours: totalActual,
                    total_variance_hours: variance,
                    total_variance_pct: variancePct,
                    months_data: employeeMonths // Keep original monthly data
                };
            });

            // Apply sorting based on current frontend sort_by and sort_direction state
            employeeGroupsArray.sort((a, b) => {
                let valA, valB;
                let comparison = 0;

                // Determine values for comparison based on employeeSortBy
                if (employeeSortBy === 'employee_name') {
                    valA = a.employee_name;
                    valB = b.employee_name;
                    comparison = valA.localeCompare(valB);
                } else if (employeeSortBy === 'forecasted_hours') {
                    valA = a.total_forecasted_hours;
                    valB = b.total_forecasted_hours;
                    comparison = valA - valB;
                } else if (employeeSortBy === 'actual_hours') {
                    valA = a.total_actual_hours;
                    valB = b.total_actual_hours;
                    comparison = valA - valB;
                } else if (employeeSortBy === 'variance') {
                    valA = a.total_variance_hours;
                    valB = b.total_variance_hours;
                    comparison = valA - valB;
                } else if (employeeSortBy === 'variance_pct') {
                    valA = a.total_variance_pct;
                    valB = b.total_variance_pct;
                    comparison = valA - valB;
                } else if (employeeSortBy === 'display_order') {
                    valA = a.display_order;
                    valB = b.display_order;
                    comparison = valA - valB;
                }
                // Handle sort direction
                return employeeSortDirection === 'asc' ? comparison : -comparison;
            });
            // --- END NEW: Frontend Sorting ---

            // --- Rendering the Employee Table (now using sorted employeeGroupsArray) ---
            for (const employeeGroup of employeeGroupsArray) {
                // Create Employee Summary Row
                const summaryRow = employeeTableBody.insertRow();
                summaryRow.classList.add('employee-summary-row');
                summaryRow.setAttribute('data-employee-name', employeeGroup.employee_name);

                const toggleCell = summaryRow.insertCell();
                toggleCell.innerHTML = `<i class="fas fa-plus-circle toggle-icon"></i> ${employeeGroup.employee_name}`;
                toggleCell.colSpan = 1; // Colspan is 1 as per your preference (employee name / month)
                
                summaryRow.insertCell().textContent = employeeGroup.total_forecasted_hours.toFixed(2);
                summaryRow.insertCell().textContent = employeeGroup.total_actual_hours.toFixed(2);
                
                const varEmpCell = summaryRow.insertCell();
                varEmpCell.textContent = `${Math.abs(employeeGroup.total_variance_hours).toFixed(2)}`; // Use Math.abs()
                varEmpCell.classList.add(getVarianceClass(employeeGroup.total_variance_hours)); // Use signed value for color
                varEmpCell.setAttribute('data-variance-signed', employeeGroup.total_variance_hours);

                const varPctEmpCell = summaryRow.insertCell();
                varPctEmpCell.textContent = `${Math.abs(employeeGroup.total_variance_pct).toFixed(2)}%`; // Use Math.abs()
                varPctEmpCell.classList.add(getVarianceClass(employeeGroup.total_variance_pct)); // Use signed value for color
                varPctEmpCell.setAttribute('data-variance-signed', employeeGroup.total_variance_pct);

                // Add click listener to summary row to toggle details
                summaryRow.onclick = (event) => {
                    if (event.target.tagName === 'I' || event.target.tagName === 'SPAN') {
                        event.stopPropagation();
                    }
                    window.toggleEmployeeDetails(employeeGroup.employee_name, summaryRow);
                };

                // Create Employee Detail Rows (initially hidden)
                // Use the original monthly data stored in employeeGroup.months_data
                employeeGroup.months_data.forEach(monthData => {
                    const detailRow = employeeTableBody.insertRow();
                    detailRow.classList.add('employee-detail-row');
                    const sanitizedEmployeeName = employeeGroup.employee_name.replace(/\s+/g, '-').replace(/\//g, '-');
                    detailRow.classList.add(`employee-details-of-${sanitizedEmployeeName}`);

                    detailRow.insertCell().textContent = `${getMonthName(monthData.month)} ${monthData.year}`;
                    detailRow.insertCell().textContent = monthData.total_forecasted_hours;
                    detailRow.insertCell().textContent = monthData.total_actual_hours;

                    const forecasted = parseFloat(monthData.total_forecasted_hours);
                    const actual = parseFloat(monthData.total_actual_hours);

                    const variance = actual - forecasted;
                    const variancePct = (forecasted !== 0) ? (variance / forecasted * 100) : 0;

                    const varCell = detailRow.insertCell();
                    varCell.textContent = `${Math.abs(variance).toFixed(2)}`;
                    varCell.classList.add(getVarianceClass(variance));

                    const varPctCell = detailRow.insertCell();
                    varPctCell.textContent = `${Math.abs(variancePct).toFixed(2)}%`;
                    varPctCell.classList.add(getVarianceClass(variancePct));
                });
            }

        } catch (error) {
            console.error("Error fetching monthly employee report:", error);
            showToast(`Failed to load monthly employee report: ${error.message}`,'error');
            employeeTableBody.innerHTML = `<tr><td colspan="5" style="color:red;">Error loading report: ${error.message}</td></tr>`;
        }
    }

    // --- NEW: Filter Event Listeners and Initial Load ---
    populateYearFilter(); // Populate year dropdown on load

    // --- CRITICAL FIX: Set initial disabled state for year filter ---
    reportYearFilter.disabled = last12MonthsFilter.checked; // Disable based on default checked state
    // --- END CRITICAL FIX ---

    applyFilterBtn.addEventListener('click', () => {
        fetchMonthlyWorkAreaHoursReport();
        fetchMonthlyEmployeeHoursReport();
        renderWorkAreaHoursChart();
    });

    // Disable year filter if 'Last 12 Months' is checked
    last12MonthsFilter.addEventListener('change', () => {
        reportYearFilter.disabled = last12MonthsFilter.checked;
    });

    // Initial load for all reports (call through filter logic)
    // Removed direct fetch calls at the end
    // fetchMonthlyWorkAreaHoursReport();
    // fetchMonthlyEmployeeHoursReport();
    // renderWorkAreaHoursChart();

    // Instead, trigger the apply filter button on load to ensure initial state matches filter logic
    applyFilterBtn.click(); // Simulate a click on load
    // --- END NEW ---

    printChartToPDFBtn.addEventListener('click', printChartToPDF); // NEW: Attach click handler
    
    // --- NEW: Attach Email Report Button Listener ---
    emailChartReportBtn.addEventListener('click', emailChartReport);
    // --- END NEW ---

    // --- Print Button Functionality with Chart Resizing ---
    const printMonthlyReportBtn = document.getElementById('printMonthlyReportBtn');
    if (printMonthlyReportBtn) {
        const chartContainer = document.getElementById('chartContainer');

        if (chartContainer && window.monthlyWorkAreaChart) {
            let originalHeight, originalWidth, originalMargin;

            window.onbeforeprint = () => {
                originalHeight = chartContainer.style.height;
                originalWidth = chartContainer.style.width;
                originalMargin = chartContainer.style.margin;

                chartContainer.style.width = '800px';
                chartContainer.style.height = 'auto';
                chartContainer.style.margin = '20px auto';
                
                window.monthlyWorkAreaChart.resize();
            };

            window.onafterprint = () => {
                chartContainer.style.height = originalHeight;
                chartContainer.style.width = originalWidth;
                chartContainer.style.margin = originalMargin;
                
                window.monthlyWorkAreaChart.resize();
            };
        }
        
        printMonthlyReportBtn.addEventListener('click', () => {
            window.print();
        });
    }
    
    // --- NEW: Employee Table Header Sorting ---
    const employeeTableHeaders = document.querySelectorAll('#monthlyEmployeeHoursReportTable thead th[data-sort-by]');
    employeeTableHeaders.forEach(header => {
        header.style.cursor = 'pointer'; // Indicate it's clickable
        header.addEventListener('click', () => {
            const sortBy = header.getAttribute('data-sort-by');
            
            if (employeeSortBy === sortBy) {
                // If clicking same column, toggle direction
                employeeSortDirection = (employeeSortDirection === 'asc') ? 'desc' : 'asc';
            } else {
                // If clicking new column, set it as primary sort, default to asc
                employeeSortBy = sortBy;
                employeeSortDirection = 'asc';
            }
            // Re-fetch data with new sorting
            fetchMonthlyEmployeeHoursReport();
        });
    });
    // --- END NEW ---

});