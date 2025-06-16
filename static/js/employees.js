// static/js/employees.js (Full and corrected code for Employee Management with DnD)
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('employeeForm');
    const tableBody = document.querySelector('#employeesTable tbody');
    const employeeIdField = document.getElementById('employeeId');
    const firstNameField = document.getElementById('firstName');
    const lastInitialField = document.getElementById('lastInitial');
    const positionField = document.getElementById('position');
    const primaryWorkAreaField = document.getElementById('primaryWorkArea');
    const forecastedHoursDisplay = document.getElementById('forecastedHoursDisplay');
    // --- NEW: Employment Date Input Fields ---
    const employmentStartDateField = document.getElementById('employmentStartDate');
    const employmentEndDateField = document.getElementById('employmentEndDate');
    // --- END NEW ---
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

    let editingEmployeeId = null;
    let workAreas = []; // To store fetched work areas for the dropdown
    let sortable = null; // Sortable.js instance

    // Helper to fetch positions for the dropdown
    let allPositions = []; // Store positions globally for use in other functions
    async function fetchPositionsForDropdown() {
        try {
            const response = await fetch('/api/positions');
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`HTTP error! status: ${response.status}, Message: ${errorData.message || 'Unknown error'}`);
            }
            allPositions = await response.json();
            positionField.innerHTML = '<option value="">--Select Position--</option>'; // Clear and add default option
            allPositions.forEach(pos => {
                const option = document.createElement('option');
                option.value = pos.position_id; // Use ID as value
                option.textContent = pos.title; // Display title
                positionField.appendChild(option);
            });
        } catch (error) {
            console.error("Error fetching positions for dropdown:", error);
            showToast(`Failed to load positions for dropdown: ${error.message}`, 'error');
        }
    }

    // Function to fetch and display employees
    async function fetchEmployees() {
        try {
            // This API call now fetches employees sorted by display_order from the backend
            const response = await fetch('/api/employees');
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`HTTP error! status: ${response.status}, Message: ${errorData.message || 'Unknown error'}`);
            }
            const employees = await response.json();
            tableBody.innerHTML = ''; // Clear existing rows

            employees.forEach(emp => {
                const row = tableBody.insertRow();
                row.setAttribute('data-id', emp.employee_id);

                row.insertCell(0).textContent = emp.display_order;
                row.insertCell(1).textContent = emp.employee_id;
                row.insertCell(2).textContent = emp.first_name;
                row.insertCell(3).textContent = emp.last_initial;
                row.insertCell(4).textContent = emp.position_title || 'N/A';
                row.insertCell(5).textContent = emp.primary_work_area_name || 'N/A';
                row.insertCell(6).textContent = emp.employment_start_date || '-';
                row.insertCell(7).textContent = emp.employment_end_date || '-';
                row.insertCell(8).textContent = emp.default_forecasted_daily_hours; // Adjusted index
                const actionsCell = row.insertCell(9); // Adjusted index

                const buttonContainer = document.createElement('div');
                buttonContainer.style.display = 'flex';
                buttonContainer.style.gap = '5px';
                buttonContainer.style.justifyContent = 'flex-end';
                buttonContainer.style.alignItems = 'center';
                buttonContainer.style.flexWrap = 'nowrap';
                
                const editButton = document.createElement('button');
                editButton.innerHTML = '<i class="fas fa-pencil"></i>'; // Pencil Icon
                editButton.ariaLabel = 'Edit Employee'; // Accessibility
                editButton.onclick = () => editEmployee(emp);
                editButton.classList.add('edit-btn'); // Class for specific styling (green)
                editButton.style.cssText = commonButtonStyleInline;
                buttonContainer.appendChild(editButton);

                const deleteButton = document.createElement('button');
                deleteButton.innerHTML = '<i class="fas fa-trash-can"></i>'; // Trash Can Icon
                deleteButton.ariaLabel = 'Delete Employee'; // Accessibility
                deleteButton.onclick = () => deleteEmployee(emp.employee_id);
                deleteButton.classList.add('delete-btn'); // Class for specific styling (red)
                deleteButton.style.cssText = commonButtonStyleInline;
                buttonContainer.appendChild(deleteButton);

                actionsCell.appendChild(buttonContainer);

            });

            // After rendering the table, re-initialize Sortable.js
            initializeSortable();

        } catch (error) {
            console.error("Error fetching employees:", error);
            showToast(`Failed to load employees: ${error.message}`, 'error');
        }
    }

    // Function to fetch work areas for the dropdown
    async function fetchWorkAreasForDropdown() {
        try {
            const response = await fetch('/api/work-areas');
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`HTTP error! status: ${response.status}, Message: ${errorData.message || 'Unknown error'}`);
            }
            workAreas = await response.json();
            primaryWorkAreaField.innerHTML = '<option value="">--Select Primary Work Area--</option>';
            workAreas.forEach(area => {
                const option = document.createElement('option');
                option.value = area.work_area_id;
                option.textContent = area.work_area_name;
                primaryWorkAreaField.appendChild(option);
            });
        } catch (error) {
            console.error("Error fetching work areas for dropdown:", error);
            showToast(`Failed to load work areas for dropdown: ${error.message}`, 'error');
        }
    }

    // Update forecasted hours display based on position selection
    positionField.addEventListener('change', () => {
        const selectedPositionId = parseInt(positionField.value);
        const selectedPosition = allPositions.find(pos => pos.position_id === selectedPositionId);
        
        if (selectedPosition) {
            forecastedHoursDisplay.textContent = selectedPosition.default_hours;
        } else {
            forecastedHoursDisplay.textContent = '';
        }
    });

    // Handle form submission (Add/Edit Employee)
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const employeeData = {
            first_name: firstNameField.value.trim(),
            last_initial: lastInitialField.value.trim(),
            position_id: parseInt(positionField.value), // Send the ID from the dropdown value
            primary_work_area_id: parseInt(primaryWorkAreaField.value),
            employment_start_date: employmentStartDateField.value, // YYYY-MM-DD string
            employment_end_date: employmentEndDateField.value || null // YYYY-MM-DD string or null
        };

        // --- CRITICAL FIX: Robust validation for all fields ---
        // 1. Validate required text/date fields
        if (!employeeData.first_name) {
            showToast('First Name is required.','error');
            return;
        }
        if (!employeeData.last_initial) {
            showToast('Last Initial is required.','error');
            return;
        }
        if (employeeData.last_initial.length > 1) {
            showToast('Last Initial should be a single character.','error');
            return;
        }
        if (!employeeData.employment_start_date) {
            showToast('Employment Start Date is required.','error');
            return;
        }

        // 2. Validate required numeric dropdowns (IDs)
        if (isNaN(employeeData.position_id)) {
            showToast('Please select a valid Position.','error');
            return;
        }
        if (isNaN(employeeData.primary_work_area_id)) {
            showToast('Please select a valid Primary Work Area.','error');
            return;
        }

        // 3. Validate date logic (End Date not before Start Date) - already present
        if (employeeData.employment_start_date && employeeData.employment_end_date) {
            if (new Date(employeeData.employment_start_date) > new Date(employeeData.employment_end_date)) {
                showToast('Employment End Date cannot be before Employment Start Date.','error');
                return;
            }
        }
        // --- END CRITICAL FIX ---

        const method = editingEmployeeId ? 'PUT' : 'POST';
        const url = editingEmployeeId ? `/api/employees/${editingEmployeeId}` : '/api/employees';

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(employeeData)
            });

            if (response.ok) {
                showToast('Employee saved successfully!', 'success');
                form.reset();
                forecastedHoursDisplay.textContent = '';
                editingEmployeeId = null;
                saveButton.textContent = 'Save Employee';
                cancelButton.style.display = 'none';
                fetchEmployees(); // Refresh table
            } else {
                const error = await response.json();
                showToast(`Error saving employee: ${error.message}`,'error');
            }
        } catch (error) {
            console.error("Error submitting employee form:", error);
            showToast(`Failed to save employee: ${error.message}`,'error');
        }
    });

    // Populate form for editing
    function editEmployee(emp) {
        editingEmployeeId = emp.employee_id;
        employeeIdField.value = emp.employee_id;
        firstNameField.value = emp.first_name;
        lastInitialField.value = emp.last_initial;
        positionField.value = emp.position_id; // Use ID to select option
        positionField.dispatchEvent(new Event('change')); // Trigger display update for forecasted hours
        primaryWorkAreaField.value = emp.primary_work_area_id;
        // --- NEW: Pre-fill employment dates ---
        employmentStartDateField.value = emp.employment_start_date || '';
        employmentEndDateField.value = emp.employment_end_date || '';
        // --- END NEW ---
        saveButton.textContent = 'Update Employee';
        cancelButton.style.display = 'inline-block';
    }

    // Cancel editing
    cancelButton.addEventListener('click', () => {
        form.reset();
        forecastedHoursDisplay.textContent = '';
        // --- NEW: Clear employment date fields ---
        employmentStartDateField.value = '';
        employmentEndDateField.value = '';
        // --- END NEW ---
        editingEmployeeId = null;
        saveButton.textContent = 'Save Employee';
        cancelButton.style.display = 'none';
        employeeIdField.value = '';
    });

    // Delete employee
    async function deleteEmployee(id) {
        if (!confirm('Are you sure you want to delete this employee? This action cannot be undone and may affect historical data.')) return;

        try {
            const response = await fetch(`/api/employees/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                showToast('Employee deleted successfully!','success');
                fetchEmployees(); // Refresh table
            } else {
                const error = await response.json();
                showToast(`Error deleting employee: ${error.message}`,'error');
            }
        } catch (error) {
            console.error("Error deleting employee:", error);
            showToast(`Failed to delete employee: ${error.message}`,'error');
        }
    }

    // --- Sortable.js Initialization and Order Saving Logic ---
    const employeesTableBody = document.getElementById('employeesTableBody'); // Ensure this ID exists on the <tbody>

    function initializeSortable() {
        if (sortable) { // Destroy previous instance if re-rendering table
            sortable.destroy();
        }
        sortable = Sortable.create(employeesTableBody, {
            animation: 150, // ms, animation speed
            draggable: 'tr', // Makes the entire <tr> element draggable
            ghostClass: 'sortable-ghost', // Class name for the drop placeholder
            onEnd: async function (evt) {
                // This event fires when drag-and-drop is finished
                const newOrder = [];
                // Iterate through the reordered rows to get their new sequence
                employeesTableBody.querySelectorAll('tr').forEach((row, index) => {
                    newOrder.push({
                        employee_id: parseInt(row.getAttribute('data-id')), // Get employee ID from data-id attribute
                        order: index // New order is simply its index in the list (0-based)
                    });
                });

                // console.log('DEBUG: New position order being sent:', JSON.stringify(newOrder)); // Use JSON.stringify

                try {
                    const response = await fetch('/api/employees/reorder', { // Call the new backend reorder API
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(newOrder)
                    });

                    if (response.ok) {
                        showToast('Employee order updated successfully!', 'success');
                        // Refresh the table to show updated display_order numbers and ensure consistency
                        fetchEmployees();
                    } else {
                        const error = await response.json();
                        showToast(`Error updating order: ${error.message}`,'error');
                        // If save fails, re-fetch to revert to original order (visual & data mismatch)
                        fetchEmployees();
                    }
                } catch (error) {
                    console.error("Error saving new order:", error);
                    showToast(`Failed to save new order: ${error.message}`,'error');
                    fetchEmployees(); // Revert to original order on network/server error
                }
            }
        });
        console.log("Sortable.js initialized:", sortable); // Confirm initialization
    }

    // Initial load: Fetch employees and then initialize Sortable.js
    // Refactor fetchEmployees to ensure Sortable.js is initialized AFTER table rendering
    const originalFetchEmployeesFunction = fetchEmployees; // Store original reference
    fetchEmployees = async function() {
        await originalFetchEmployeesFunction(); // Run original fetchEmployees logic
        initializeSortable(); // Then initialize Sortable.js
    };
    fetchEmployees(); // Call the refactored one for initial load

    // Initial fetch of work areas for dropdown
    fetchWorkAreasForDropdown();
        // --- NEW: Initial fetch of positions for dropdown ---
    fetchPositionsForDropdown().then(() => {
        // After positions are loaded, then fetch employees
        // This ensures the primaryWorkAreaField has options when employees are rendered
        fetchEmployees(); 
    });
});