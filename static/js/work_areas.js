// static/js/work_areas.js
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('workAreaForm');
    const tableBody = document.querySelector('#workAreasTable tbody');
    const workAreaIdField = document.getElementById('workAreaId');
    const workAreaNameField = document.getElementById('workAreaName');
    const offsetDaysField = document.getElementById('offsetDays');
    const saveButton = form.querySelector('button[type="submit"]');
    const cancelButton = document.getElementById('cancelEdit');

    let editingWorkAreaId = null;

    async function fetchWorkAreas() {
        try {
            // This API call now fetches work areas sorted by display_order
            const response = await fetch('/api/work-areas');
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`HTTP error! status: ${response.status}, Message: ${errorData.message || 'Unknown error'}`);
            }
            const workAreas = await response.json();
            tableBody.innerHTML = ''; // Clear existing rows

            workAreas.forEach(area => {
                const row = tableBody.insertRow();
                row.setAttribute('data-id', area.work_area_id); // CRITICAL: Store work area ID on the row

                // --- NEW DEBUG LOG ---
                console.log("DEBUG: Work Area Name:", area.work_area_name, "Computed Display Order:", area.display_order);
                // --- END NEW DEBUG LOG ---

                // NEW: Order column
                row.insertCell(0).textContent = area.display_order; // Display the order
                row.insertCell(1).textContent = area.work_area_id; // ID
                row.insertCell(2).textContent = area.work_area_name; // Work Area Name
                row.insertCell(3).textContent = area.reporting_week_start_offset_days; // Offset
                //row.insertCell(4).textContent = area.contributing_duration_days; // Contributing Duration

                const actionsCell = row.insertCell(4); // Actions column (adjusted index)

                // ... (existing button creation for edit/delete) ...
                const editButton = document.createElement('button');
                editButton.textContent = 'Edit';
                editButton.onclick = () => editWorkArea(area);
                actionsCell.appendChild(editButton);

                const deleteButton = document.createElement('button');
                deleteButton.textContent = 'Delete';
                deleteButton.onclick = () => deleteWorkArea(area.work_area_id);
                actionsCell.appendChild(deleteButton);
            });

            // After rendering the table, re-initialize Sortable.js
            initializeSortable();

        } catch (error) {
            console.error("Error fetching work areas:", error);
            alert(`Failed to load work areas: ${error.message}`);
        }
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const workAreaName = workAreaNameField.value.trim();
        const offsetDays = offsetDaysField.value; // It's already number type due to input type="number"

        if (!workAreaName || offsetDays === "") {
            alert("Please fill in all required fields.");
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
                alert('Work Area saved successfully!');
                form.reset();
                editingWorkAreaId = null;
                saveButton.textContent = 'Save Work Area';
                cancelButton.style.display = 'none';
                fetchWorkAreas();
            } else {
                const error = await response.json();
                alert(`Error saving work area: ${error.message}`);
            }
        } catch (error) {
            console.error("Error submitting work area form:", error);
            alert(`Failed to save work area: ${error.message}`);
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
        cancelButton.style.display = 'none';
        workAreaIdField.value = ''; // Clear hidden ID field
    });

    async function deleteWorkArea(id) {
        if (!confirm('Are you sure you want to delete this work area? This action cannot be undone.')) return;

        try {
            const response = await fetch(`/api/work-areas/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                alert('Work Area deleted successfully!');
                fetchWorkAreas();
            } else {
                const error = await response.json();
                alert(`Error deleting work area: ${error.message}`);
            }
        } catch (error) {
            console.error("Error deleting work area:", error);
            alert(`Failed to delete work area: ${error.message}`);
        }
    }

    // Initialize Sortable.js
    const workAreasTableBody = document.getElementById('workAreasTableBody');
    let sortable = null; // Declare sortable variable in a scope accessible to onEnd

    // Function to initialize/reinitialize Sortable.js after table is rendered
    function initializeSortable() {
        if (sortable) { // Destroy old instance if it exists
            sortable.destroy();
        }
        sortable = Sortable.create(workAreasTableBody, {
            animation: 150, // ms, animation speed
            draggable: 'tr', // Makes the entire <tr> element draggable
            ghostClass: 'sortable-ghost', // Class name for the drop placeholder
            onEnd: async function (evt) {
                // This event fires when drag-and-drop is finished
                const newOrder = [];
                // Iterate through the reordered rows to get their new sequence
                workAreasTableBody.querySelectorAll('tr').forEach((row, index) => {
                    newOrder.push({
                        work_area_id: parseInt(row.getAttribute('data-id')), // Get work area ID from data-id attribute
                        order: index // New order is simply its index in the list
                    });
                });

                console.log('New work area order:', newOrder);

                try {
                    const response = await fetch('/api/work-areas/reorder', { // Call the new backend reorder API
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(newOrder)
                    });

                    if (response.ok) {
                        alert('Work Area order updated successfully!');
                        // Refresh the table to show updated display_order numbers
                        fetchWorkAreas();
                    } else {
                        const error = await response.json();
                        alert(`Error updating order: ${error.message}`);
                        // If save fails, re-fetch to revert to original order
                        fetchWorkAreas();
                    }
                } catch (error) {
                    console.error("Error saving new order:", error);
                    alert(`Failed to save new order: ${error.message}`);
                    fetchWorkAreas(); // Revert to original order on error
                }
            }
        });
        console.log("Sortable.js initialized:", sortable); // Confirm initialization
    }

    // Initial load: Fetch work areas and then initialize Sortable.js
    // Refactor fetchWorkAreas to ensure Sortable.js is initialized AFTER table rendering
    const originalFetchWorkAreasFunction = fetchWorkAreas; // Store original reference
    fetchWorkAreas = async function() {
        await originalFetchWorkAreasFunction(); // Run original fetchWorkAreas logic
        initializeSortable(); // Then initialize Sortable.js
    };
    fetchWorkAreas(); // Call the refactored one for initial load
});