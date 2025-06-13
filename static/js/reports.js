// static/js/reports.js
document.addEventListener('DOMContentLoaded', () => {
    const reportsTableBody = document.querySelector('#reportsTable tbody');

    // Function to apply styling based on variance
    function getVarianceClass(value) {
        const floatValue = parseFloat(value);
        if (isNaN(floatValue)) return '';
        if (floatValue > 0) return 'variance-positive';
        if (floatValue < 0) return 'variance-negative';
        return 'variance-neutral';
    }

    // Function to fetch and display reports
    async function fetchReports() {
        reportsTableBody.innerHTML = '<tr><td colspan="13">Loading reports...</td></tr>'; // 13 columns total
        try {
            const response = await fetch('/api/reports/weekly-overview');
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`HTTP error! status: ${response.status}, Message: ${errorData.message || 'Unknown error'}`);
            }
            const reports = await response.json();
            reportsTableBody.innerHTML = ''; // Clear loading message

            if (reports.length === 0) {
                reportsTableBody.innerHTML = '<tr><td colspan="13">No reports available. Create some production schedules and enter hours!</td></tr>';
                return;
            }

            reports.forEach(report => {
                const row = reportsTableBody.insertRow();
                row.insertCell(0).textContent = `${report.reporting_week_start_date} - ${report.reporting_week_end_date}`;

                // Dollars Per Hour
                row.insertCell(1).textContent = report.forecasted_dollars_per_hour || '-';
                row.insertCell(2).textContent = report.actual_dollars_per_hour || '-';
                const dphVarCell = row.insertCell(3);
                dphVarCell.textContent = report.dph_variance || '-';
                dphVarCell.classList.add(getVarianceClass(report.dph_variance));
                const dphVarPctCell = row.insertCell(4);
                dphVarPctCell.textContent = report.dph_variance_pct || '-';
                dphVarPctCell.classList.add(getVarianceClass(report.dph_variance_pct));


                // Boxes Built
                row.insertCell(5).textContent = report.forecasted_boxes_built || '-';
                row.insertCell(6).textContent = report.actual_boxes_built || '-';
                const boxesVarCell = row.insertCell(7);
                boxesVarCell.textContent = report.boxes_variance || '-';
                boxesVarCell.classList.add(getVarianceClass(report.boxes_variance));
                const boxesVarPctCell = row.insertCell(8);
                boxesVarPctCell.textContent = report.boxes_variance_pct || '-';
                boxesVarPctCell.classList.add(getVarianceClass(report.boxes_variance_pct));

                // Total Production Hours
                row.insertCell(9).textContent = report.forecasted_total_production_hours || '-';
                row.insertCell(10).textContent = report.actual_total_production_hours || '-';
                const hoursVarCell = row.insertCell(11);
                hoursVarCell.textContent = report.total_hrs_variance || '-';
                hoursVarCell.classList.add(getVarianceClass(report.total_hrs_variance));
                const hoursVarPctCell = row.insertCell(12);
                hoursVarPctCell.textContent = report.total_hrs_variance_pct || '-';
                hoursVarPctCell.classList.add(getVarianceClass(report.total_hrs_variance_pct));
            });

        } catch (error) {
            console.error("Error fetching reports:", error);
            alert(`Failed to load reports: ${error.message}`);
            reportsTableBody.innerHTML = `<tr><td colspan="13" style="color:red;">Error loading reports: ${error.message}</td></tr>`;
        }
    }

    // Initial load
    fetchReports();
});