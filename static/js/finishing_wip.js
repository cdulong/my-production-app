document.addEventListener('DOMContentLoaded', function () {
    const wipContainer = document.getElementById('finishing-wip-container');
    const modalEmployeeSelect = document.getElementById('modal-employee');

    const FINISH_STAGES = {
        'PAINT': ['Picked', 'Sanded', 'Prime1', 'Scuff1', 'Prime2', 'Scuff2', 'Top Coat'],
        'STAIN': ['Picked', 'Sanded', 'Stain', 'Sealer', 'Scuff1', 'Top Coat'],
        'NATURAL': ['Picked', 'Sanded', 'Sealer', 'Scuff1', 'Top Coat'],
        'GLAZE': ['Picked', 'Sanded', 'Prime1', 'Scuff1', 'Prime2', 'Scuff2', 'Top Coat1', 'Glaze', 'Top Coat2']
    };

    // Store data globally within this script's scope
    let allJobs = [];
    let allFinishingWork = [];
    let allEmployees = [];

    async function loadInitialData() {
        try {
            const [jobsRes, finishingWorkRes, employeesRes] = await Promise.all([
                fetch('/api/jobs'),
                fetch('/api/finishing_work'),
                fetch('/api/employees')
            ]);
            allJobs = await jobsRes.json();
            allFinishingWork = await finishingWorkRes.json();
            allEmployees = (await employeesRes.json()).filter(e => e.is_active);
            
            populateEmployeeDropdown();
            renderTables();

        } catch (error) {
            console.error("Failed to load initial data:", error);
            wipContainer.innerHTML = '<p class="text-danger">Failed to load Work-In-Progress data. Please try again later.</p>';
        }
    }

    function populateEmployeeDropdown() {
        modalEmployeeSelect.innerHTML = '<option value="">Select Employee</option>';
        allEmployees.forEach(emp => {
            const option = document.createElement('option');
            option.value = emp.employee_id;
            option.textContent = `${emp.first_name} ${emp.last_initial}`;
            modalEmployeeSelect.appendChild(option);
        });
    }

    function renderTables() {
        wipContainer.innerHTML = ''; // Clear existing content
        
        for (const finishType in FINISH_STAGES) {
            const jobsForType = allJobs.filter(job => job[`boxes_${finishType.toLowerCase()}`] > 0);
            
            if (jobsForType.length > 0) {
                const stages = FINISH_STAGES[finishType];
                const table = createTable(finishType, stages, jobsForType);
                wipContainer.appendChild(table);
            }
        }
    }

    function createTable(finishType, stages, jobs) {
        const card = document.createElement('div');
        card.className = 'card mb-4';

        let headerHtml = `<div class="card-header"><h4>${finishType} Jobs</h4></div>`;
        let tableHtml = `<div class="card-body table-responsive"><table class="table table-bordered table-hover text-center">`;
        
        // Create table header
        let thead = `<thead><tr><th style="width: 15%;">Job Tag</th>`;
        stages.forEach(stage => {
            thead += `<th>${stage}</th>`;
        });
        thead += `</tr></thead>`;

        // Create table body
        let tbody = `<tbody>`;
        jobs.forEach(job => {
            tbody += `<tr><td>${job.job_tag}</td>`;
            stages.forEach(stage => {
                const workItem = allFinishingWork.find(w => w.job_id === job.job_id && w.stage === stage && w.finish_type === finishType);
                const status = workItem ? workItem.status : '';
                const workId = workItem ? workItem.finishing_id : 'new';
                let cellClass = '';
                if (status === 'Complete') cellClass = 'bg-success';
                if (status === 'In Progress') cellClass = 'bg-warning';

                tbody += `<td class="${cellClass}" data-job-id="${job.job_id}" data-job-tag="${job.job_tag}" data-stage="${stage}" data-finish-type="${finishType}" data-work-id="${workId}" style="cursor:pointer;">${status}</td>`;
            });
            tbody += `</tr>`;
        });
        tbody += `</tbody>`;

        card.innerHTML = headerHtml + tableHtml + thead + tbody + '</table></div>';
        return card;
    }

    wipContainer.addEventListener('click', function(e) {
        if (e.target.tagName === 'TD' && e.target.dataset.jobId) {
            const cell = e.target;
            const { jobId, jobTag, stage, finishType, workId } = cell.dataset;
            
            // Populate and show the modal
            document.getElementById('modal-job-tag').textContent = jobTag;
            document.getElementById('modal-stage-name').textContent = stage;
            document.getElementById('modal-work-id').value = workId;
            document.getElementById('modal-job-id').value = jobId;
            document.getElementById('modal-finish-type').value = finishType;

            $('#statusUpdateModal').modal('show');
        }
    });

    document.getElementById('saveStatusBtn').addEventListener('click', async function() {
        const workId = document.getElementById('modal-work-id').value;
        const status = document.getElementById('modal-status').value;
        const employeeId = document.getElementById('modal-employee').value;

        let url, method, body;

        if (workId === 'new') {
            // Create a new finishing work item
            url = '/api/finishing_work';
            method = 'POST';
            body = {
                job_id: document.getElementById('modal-job-id').value,
                finish_type: document.getElementById('modal-finish-type').value,
                stage: document.getElementById('modal-stage-name').textContent,
                status: status,
                employee_id: employeeId || null,
                stage_completed_date: status === 'Complete' ? new Date().toISOString().split('T')[0] : null
            };
        } else {
            // Update an existing item
            url = `/api/finishing_work/${workId}`;
            method = 'PUT';
            body = {
                status: status,
                employee_id: employeeId || null,
                stage_completed_date: status === 'Complete' ? new Date().toISOString().split('T')[0] : null
            };
        }

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (!response.ok) throw new Error('Failed to save status');
            
            await response.json();
            $('#statusUpdateModal').modal('hide');
            
            // Reload all data to reflect changes
            await loadInitialData();
            
        } catch (error) {
            console.error("Error saving status:", error);
            alert("Failed to save status.");
        }
    });


    loadInitialData();
});