document.addEventListener('DOMContentLoaded', function() {
    const jobForm = document.getElementById('jobForm');
    const jobsTableBody = document.querySelector('#jobsTable tbody');
    const saveButton = jobForm.querySelector('button[type="submit"]');
    const clearFormBtn = document.getElementById('clearFormBtn');

    const commonButtonStyleInline = `
        padding: 0; /* Remove padding */
        font-size: 1.2em; /* Larger font for icon */
        vertical-align: middle;
        box-sizing: border-box;
        margin-right: 0; /* Managed by flexbox gap on parent td */
        display: flex; /* Make button a flex container for centering icon */
        justify-content: center; /* Center icon horizontally */
        align-items: center; /* Center icon vertically */
        overflow: hidden; /* Hide any overflow */
        width: 35px; /* Fixed width for icon button */
        height: 35px; /* Fixed height for icon button (square) */
        flex-grow: 0;
        flex-shrink: 0;
        flex-basis: auto;
        /* Default colors (will be overridden by specific classes for Edit/Delete) */
        background-color: #007bff; /* Blue */
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.2s ease;
    `;




    // Handle clearing the form
    clearFormBtn.addEventListener('click', function() {
        clearForm();
    });

    async function fetchJobs() {
        try{
            const response = await fetch('/api/jobs');
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`HTTP error! status: ${response.status}, Message: ${errorData.message || 'Unknown error'}`);
            }
            const jobs = await response.json();
            jobsTableBody.innerHTML = ''; // Clear existing rows

            jobs.forEach(job => {
                const row = jobsTableBody.insertRow();
                row.setAttribute('data-id', job.job_id);

                row.insertCell(0).textContent = job.job_tag;
                row.insertCell(1).textContent = job.num_sheets || '';
                row.insertCell(2).textContent = job.num_mdf_doors || '';
                row.insertCell(3).textContent = job.linear_meters_edgebanding || '';
                row.insertCell(4).textContent = job.num_drawer_boxes || '';
                const actionsCell = row.insertCell(5);

                const buttonContainer = document.createElement('div');
                buttonContainer.style.display = 'flex';
                buttonContainer.style.gap = '5px';
                buttonContainer.style.justifyContent = 'flex-end';
                buttonContainer.style.alignItems = 'center';
                buttonContainer.style.flexWrap = 'nowrap';

                const editButton = document.createElement('button');
                editButton.innerHTML = '<i class="fas fa-pencil"></i>';
                editButton.ariaLable = 'Edit Job';
                editButton.onclick = () => editJob(job.job_id);
                editButton.classList.add('edit-btn');
                editButton.style.cssText = commonButtonStyleInline;
                buttonContainer.appendChild(editButton);

                const deleteButton = document.createElement('button');
                deleteButton.innerHTML = '<i class="fas fa-trash-can"></i>';
                deleteButton.ariaLabel = 'Delete Job';
                deleteButton.onclick = () => deleteJob(job.job_id);
                deleteButton.classList.add('delete-btn');
                deleteButton.style.cssText = commonButtonStyleInline;
                buttonContainer.appendChild(deleteButton);

                actionsCell.appendChild(buttonContainer);
            });
        } catch (error) {
            console.error("Error fetching jobs:", error);
            showToast(`Failed to load jobs: ${error.message}`, 'error');
        }
    }

        // Handle form submission for creating/updating jobs
    jobForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const jobId = document.getElementById('jobId').value;
        const jobData = {
            job_tag: document.getElementById('jobTag').value,
            num_sheets: document.getElementById('numSheets').value || null,
            num_mdf_doors: document.getElementById('numMdfDoors').value || null,
            linear_meters_edgebanding: document.getElementById('linearMetersEdgebanding').value || null,
            num_drawer_boxes: document.getElementById('numDrawerBoxes').value || null,
            boxes_mcp: document.getElementById('boxesMcp').value || null,
            boxes_pvc: document.getElementById('boxesPvc').value || null,
            boxes_paint: document.getElementById('boxesPaint').value || null,
            boxes_stain: document.getElementById('boxesStain').value || null,
            boxes_natural: document.getElementById('boxesNatural').value || null,
            boxes_glaze: document.getElementById('boxesGlaze').value || null,
        };

        const method = jobId ? 'PUT' : 'POST';
        const url = jobId ? `/api/jobs/${jobId}` : '/api/jobs';

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(jobData)
            });

            if (response.ok) {
                showToast('Job info saved successfully', 'success');
                clearForm();
                saveButton.textContent = 'Save Job';
                fetchJobs();
            } else {
                const error = await response.json();
                showToast(`Error saving job info: ${error.message}`, 'error');
            }
        } catch (error) {
            console.error("Error submitting job info form:", error);
            showToast(`Failed to save job info: ${error.message}`, 'error');
        }
    });

    window.editJob = function(jobId) {
        fetch(`/api/jobs/${jobId}`)
            .then(response => response.json())
            .then(job => {
                document.getElementById('jobId').value = job.job_id;
                document.getElementById('jobTag').value = job.job_tag;
                document.getElementById('numSheets').value = job.num_sheets;
                document.getElementById('numMdfDoors').value = job.num_mdf_doors;
                document.getElementById('linearMetersEdgebanding').value = job.linear_meters_edgebanding;
                document.getElementById('numDrawerBoxes').value = job.num_drawer_boxes;
                document.getElementById('boxesMcp').value = job.boxes_mcp;
                document.getElementById('boxesPvc').value = job.boxes_pvc;
                document.getElementById('boxesPaint').value = job.boxes_paint;
                document.getElementById('boxesStain').value = job.boxes_stain;
                document.getElementById('boxesNatural').value = job.boxes_natural;
                document.getElementById('boxesGlaze').value = job.boxes_glaze;
                saveButton.textContent = 'Update Job';
            });
    }

    async function deleteJob(jobId) {
        if (!confirm('Are you sure you want to delete this job? This action cannot be undone.')) return;

        try {
            const response = await fetch(`/api/jobs/${jobId}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                showToast('Job deleted successfully!', 'success');
                fetchJobs();
            } else {
                const error = await response.json();
                showToast(`Error deleting job: ${error.message}`, 'error');
            }
        } catch (error) {
            console.error("Error deleting job:", error);
            showToast(`Failed to delete job: ${error.message}`, 'error');
        }
    }

    function clearForm() {
        document.getElementById('jobId').value = '';
        jobForm.reset();
    }

    // Fetch and display all jobs on page load
    fetchJobs();
});