// static/js/positions.js (Full and corrected code for Position Management with DnD)
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('positionForm');
    const positionsTableBody = document.getElementById('positionsTableBody');
    const positionIdField = document.getElementById('positionId');
    const titleField = document.getElementById('title');
    const defaultHoursField = document.getElementById('defaultHours');
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

    let editingPositionId = null; // To track if we are editing or adding
    let sortable = null; // Declare sortable variable in a scope accessible to onEnd

    // Function to fetch and display positions
    async function fetchPositions() {
        try {
            const response = await fetch('/api/positions'); // This now fetches sorted by display_order
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`HTTP error! status: ${response.status}, Message: ${errorData.message || 'Unknown error'}`);
            }
            const positions = await response.json();
            positionsTableBody.innerHTML = ''; // Clear existing rows

            if (positions.length === 0) {
                positionsTableBody.innerHTML = '<tr><td colspan="5">No positions created yet.</td></tr>'; // Adjust colspan
                return;
            }

            positions.forEach(pos => {
                const row = positionsTableBody.insertRow();
                row.setAttribute('data-id', String(pos.position_id)); 

                row.insertCell(0).textContent = pos.display_order;
                row.insertCell(1).textContent = pos.position_id;
                row.insertCell(2).textContent = pos.title;
                row.insertCell(3).textContent = pos.default_hours;

                const actionsCell = row.insertCell(4);

                // --- START: CORRECTED BUTTON WRAPPER LOGIC ---
                // 1. Create a wrapper div and apply the .action-buttons class.
                const buttonWrapper = document.createElement('div');
                buttonWrapper.className = 'action-buttons';
                
                // 2. We can align this specific wrapper to the right if needed.
                buttonWrapper.style.justifyContent = 'flex-end';

                const editButton = document.createElement('button');
                editButton.innerHTML = '<i class="fas fa-pencil"></i>';
                editButton.ariaLabel = 'Edit Position';
                editButton.onclick = () => editPosition(pos);
                editButton.classList.add('edit-btn');
                editButton.style.cssText = commonButtonStyleInline;
                buttonWrapper.appendChild(editButton); // Append button to wrapper

                const deleteButton = document.createElement('button');
                deleteButton.innerHTML = '<i class="fas fa-trash-can"></i>';
                deleteButton.ariaLabel = 'Delete Position';
                deleteButton.onclick = () => deletePosition(pos.position_id);
                deleteButton.classList.add('delete-btn');
                deleteButton.style.cssText = commonButtonStyleInline;
                buttonWrapper.appendChild(deleteButton); // Append button to wrapper

                // 3. Append the single wrapper div to the table cell.
                actionsCell.appendChild(buttonWrapper);
                // --- END: CORRECTED BUTTON WRAPPER LOGIC ---
            });

            initializeSortable();

        } catch (error) {
            console.error("Error fetching positions:", error);
            showToast(`Failed to load positions: ${error.message}`, 'error');
        }
    }

    // Function to handle form submission (Add/Edit)
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const title = titleField.value.trim();
        const defaultHours = parseFloat(defaultHoursField.value);

        if (!title || isNaN(defaultHours) || defaultHours < 0) {
            showToast('Please fill in a valid position title and non-negative default hours.', 'error');
            return;
        }

        const positionData = { title: title, default_hours: defaultHours };
        const method = editingPositionId ? 'PUT' : 'POST';
        const url = editingPositionId ? `/api/positions/${editingPositionId}` : '/api/positions';

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(positionData)
            });

            if (response.ok) {
                showToast('Position saved successfully!', 'success');
                form.reset();
                editingPositionId = null;
                saveButton.textContent = 'Save Position';
                cancelButton.style.display = 'none';
                fetchPositions();
            } else {
                const error = await response.json();
                showToast(`Error saving position: ${error.message}`, 'error');
            }
        } catch (error) {
            console.error("Error submitting position form:", error);
            showToast(`Failed to save position: ${error.message}`, 'error');
        }
    });

    // Function to populate form for editing
    function editPosition(pos) {
        editingPositionId = pos.position_id;
        positionIdField.value = pos.position_id;
        titleField.value = pos.title;
        defaultHoursField.value = pos.default_hours;
        saveButton.textContent = 'Update Position';
        cancelButton.style.display = 'inline-block';
    }

    // Function to cancel editing
    cancelButton.addEventListener('click', () => {
        form.reset();
        editingPositionId = null;
        saveButton.textContent = 'Save Position';
        cancelButton.style.display = 'none';
        positionIdField.value = '';
    });

    // Function to delete a position
    async function deletePosition(id) {
        if (!confirm('Are you sure you want to delete this position? This will also affect employees assigned to it. This action cannot be undone.')) return;

        try {
            const response = await fetch(`/api/positions/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                showToast('Position deleted successfully!', 'success');
                fetchPositions();
            } else {
                const error = await response.json();
                showToast(`Error deleting position: ${error.message}`, 'error');
            }
        } catch (error) {
            console.error("Error deleting position:", error);
            showToast(`Failed to delete position: ${error.message}`, 'error');
        }
    }

    // Initialize Sortable.js
    function initializeSortable() {
        if (sortable) {
            sortable.destroy();
        }
        sortable = Sortable.create(positionsTableBody, {
            animation: 150,
            draggable: 'tr',
            ghostClass: 'sortable-ghost',
            onEnd: async function (evt) {
                const newOrder = [];
                positionsTableBody.querySelectorAll('tr').forEach((row, index) => {
                    const positionIdRaw = row.getAttribute('data-id');
                    const parsedPositionId = parseInt(positionIdRaw);
                    newOrder.push({
                        position_id: parsedPositionId,
                        order: index
                    });
                });

                try {
                    const response = await fetch('/api/positions/reorder', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(newOrder)
                    });

                    if (response.ok) {
                        showToast('Position order updated successfully!', 'success');
                        fetchPositions();
                    } else {
                        const error = await response.json();
                        showToast(`Error updating order: ${error.message}`, 'error');
                        fetchPositions();
                    }
                } catch (error) {
                    console.error("Error saving new order:", error);
                    showToast(`Failed to save new order: ${error.message}`, 'error');
                    fetchPositions();
                }
            }
        });
    }

    // Initial load
    fetchPositions();
});