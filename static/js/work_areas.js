// static/js/work_areas.js
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('workAreaForm');
    const tableBody = document.querySelector('#workAreasTable tbody');
    const workAreaIdField = document.getElementById('workAreaId');
    const workAreaNameField = document.getElementById('workAreaName');
    const offsetDaysField = document.getElementById('offsetDays');
    const saveButton = form.querySelector('button[type="submit"]');
    const cancelButton = document.getElementById('cancelEdit');

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

    let editingWorkAreaId = null;
    let sortable = null;

    async function fetchWorkAreas() {
        try {
            const response = await fetch('/api/work-areas');
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`HTTP error! status: ${response.status}, Message: ${errorData.message || 'Unknown error'}`);
            }
            const workAreas = await response.json();
            tableBody.innerHTML = '';

            if (workAreas.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="5">No work areas created yet.</td></tr>';
                return;
            }

            workAreas.forEach(area => {
                const row = tableBody.insertRow();
                row.setAttribute('data-id', area.work_area_id);

                row.insertCell(0).textContent = area.display_order;
                row.insertCell(1).textContent = area.work_area_id;
                row.insertCell(2).textContent = area.work_area_name;
                row.insertCell(3).textContent = area.reporting_week_start_offset_days;

                const actionsCell = row.insertCell(4);

                // --- START: CORRECTED BUTTON WRAPPER LOGIC ---
                // 1. Create a wrapper div and apply the .action-buttons class.
                const buttonWrapper = document.createElement('div');
                buttonWrapper.className = 'action-buttons';
                
                // 2. Align this specific wrapper to the right.
                buttonWrapper.style.justifyContent = 'flex-end';

                const editButton = document.createElement('button');
                editButton.innerHTML = '<i class="fas fa-pencil"></i>';
                editButton.ariaLabel = 'Edit Work Area';
                editButton.onclick = () => editWorkArea(area);
                editButton.classList.add('edit-btn');
                editButton.style.cssText = commonButtonStyleInline;
                buttonWrapper.appendChild(editButton);

                const deleteButton = document.createElement('button');
                deleteButton.innerHTML = '<i class="fas fa-trash-can"></i>';
                deleteButton.ariaLabel = 'Delete Work Area';
                deleteButton.onclick = () => deleteWorkArea(area.work_area_id);
                deleteButton.classList.add('delete-btn');
                deleteButton.style.cssText = commonButtonStyleInline;
                buttonWrapper.appendChild(deleteButton);

                // 3. Append the single wrapper div to the table cell.
                actionsCell.appendChild(buttonWrapper);
                // --- END: CORRECTED BUTTON WRAPPER LOGIC ---
            });

            initializeSortable();

        } catch (error) {
            console.error("Error fetching work areas:", error);
            showToast(`Failed to load work areas: ${error.message}`, 'error');
        }
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const workAreaName = workAreaNameField.value.trim();
        const offsetDays = offsetDaysField.value;

        if (!workAreaName || offsetDays === "") {
            showToast('Please fill in all required fields.', 'error');
            return;
        }

        const method = editingWorkAreaId ? 'PUT' : 'POST';
        const url = editingWorkAreaId ? `/api/work-areas/${editingWorkAreaId}` : '/api/work-areas';

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    work_area_name: workAreaName,
                    reporting_week_start_offset_days: parseInt(offsetDays)
                })
            });

            if (response.ok) {
                showToast('Work Area saved successfully!', 'success');
                form.reset();
                editingWorkAreaId = null;
                saveButton.textContent = 'Save Work Area';
                cancelButton.style.display = 'none';
                fetchWorkAreas();
            } else {
                const error = await response.json();
                showToast(`Error saving work area: ${error.message}`, 'error');
            }
        } catch (error) {
            console.error("Error submitting work area form:", error);
            showToast(`Failed to save work area: ${error.message}`, 'error');
        }
    });

    function editWorkArea(area) {
        editingWorkAreaId = area.work_area_id;
        workAreaIdField.value = area.work_area_id;
        workAreaNameField.value = area.work_area_name;
        offsetDaysField.value = area.reporting_week_start_offset_days;
        saveButton.textContent = 'Update Work Area';
        cancelButton.style.display = 'inline-block';
    }

    cancelButton.addEventListener('click', () => {
        form.reset();
        editingWorkAreaId = null;
        saveButton.textContent = 'Save Work Area';
        // cancelButton.style.display = 'none';
        workAreaIdField.value = '';
    });

    async function deleteWorkArea(id) {
        if (!confirm('Are you sure you want to delete this work area? This action cannot be undone.')) return;

        try {
            const response = await fetch(`/api/work-areas/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                showToast('Work Area deleted successfully!', 'success');
                fetchWorkAreas();
            } else {
                const error = await response.json();
                showToast(`Error deleting work area: ${error.message}`, 'error');
            }
        } catch (error) {
            console.error("Error deleting work area:", error);
            showToast(`Failed to delete work area: ${error.message}`, 'error');
        }
    }

    const workAreasTableBody = document.getElementById('workAreasTableBody');
    
    function initializeSortable() {
        if (sortable) {
            sortable.destroy();
        }
        sortable = Sortable.create(workAreasTableBody, {
            animation: 150,
            draggable: 'tr',
            ghostClass: 'sortable-ghost',
            onEnd: async function (evt) {
                const newOrder = [];
                workAreasTableBody.querySelectorAll('tr').forEach((row, index) => {
                    newOrder.push({
                        work_area_id: parseInt(row.getAttribute('data-id')),
                        order: index
                    });
                });

                try {
                    const response = await fetch('/api/work-areas/reorder', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(newOrder)
                    });

                    if (response.ok) {
                        showToast('Work Area order updated successfully!', 'success');
                        fetchWorkAreas();
                    } else {
                        const error = await response.json();
                        showToast(`Error updating order: ${error.message}`, 'error');
                        fetchWorkAreas();
                    }
                } catch (error) {
                    console.error("Error saving new order:", error);
                    showToast(`Failed to save new order: ${error.message}`, 'error');
                    fetchWorkAreas();
                }
            }
        });
    }

    fetchWorkAreas();
});