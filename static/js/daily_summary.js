document.addEventListener('DOMContentLoaded', function() {
    const summaryForm = document.getElementById('dailySummaryForm');
    const employeeSelect = document.getElementById('employeeId');
    const jobDropdowns = document.querySelectorAll('.job-dropdown');

    // Set default date to today
    document.getElementById('summaryDate').valueAsDate = new Date();

    // Fetch initial data for dropdowns
    function fetchInitialData() {
        // Fetch employees
        fetch('/api/employees')
            .then(response => response.json())
            .then(employees => {
                employeeSelect.innerHTML = '<option value="">Select Employee</option>';
                employees.filter(e => e.is_active).forEach(employee => {
                    const option = document.createElement('option');
                    option.value = employee.employee_id;
                    option.textContent = `${employee.first_name} ${employee.last_initial}`;
                    employeeSelect.appendChild(option);
                });
            });

        // Fetch jobs
        fetch('/api/jobs')
            .then(response => response.json())
            .then(jobs => {
                jobDropdowns.forEach(dropdown => {
                    dropdown.innerHTML = '<option value="">Select Job</option>';
                    jobs.forEach(job => {
                        const option = document.createElement('option');
                        option.value = job.job_id;
                        option.textContent = job.job_tag;
                        dropdown.appendChild(option);
                    });
                });
            });
    }

    summaryForm.addEventListener('submit', function(event) {
        event.preventDefault();

        const activeTab = document.querySelector('.tab-pane.active');
        const department = activeTab.id;

        const summaryData = {
            summary_date: document.getElementById('summaryDate').value,
            team_leader: document.getElementById('teamLeader').value,
            shift: document.getElementById('shift').value,
            employee_id: employeeSelect.value,
            notes: document.getElementById('notes').value,
            department: department
        };
        
        // Add department-specific data
        if (department === 'manufacturing') {
            // CNC Data
            summaryData.job_id = document.getElementById('cncJob').value || null; // Assume one job for now
            summaryData.sheets_cut_mtr = document.getElementById('sheetsCutMtr').value || null;
            summaryData.sheets_cut_cs43 = document.getElementById('sheetsCutCs43').value || null;
            summaryData.mdf_doors_cut_mtr = document.getElementById('mdfDoorsCutMtr').value || null;
            summaryData.mdf_doors_cut_cs43 = document.getElementById('mdfDoorsCutCs43').value || null;
            
            // Edgebander Data
            summaryData.edgebanding_ran = document.getElementById('edgebandingRan').value || null;
            summaryData.edgebanding_changeovers = document.getElementById('edgebandingChangeovers').value || null;
            summaryData.manual_edgebanding = document.getElementById('manualEdgebanding').value || null;
            
            // Assembly Data
            summaryData.drawer_boxes_built = document.getElementById('drawerBoxesBuilt').value || null;
            summaryData.boxes_prepped = document.getElementById('boxesPrepped').value || null;
            summaryData.boxes_built = document.getElementById('boxesBuilt').value || null;
            summaryData.boxes_hung = document.getElementById('boxesHung').value || null;
        }
        
        // The API endpoint handles one summary at a time.
        // For multiple entries per day, the user would submit the form multiple times.
        fetch('/api/daily_shift_summary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(summaryData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            alert('Shift summary submitted successfully!');
            summaryForm.reset();
            document.getElementById('summaryDate').valueAsDate = new Date(); // Reset date
        })
        .catch(error => {
            console.error('Error submitting summary:', error);
            alert('Failed to submit summary. See console for details.');
        });
    });

    fetchInitialData();
});