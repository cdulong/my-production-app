// static/js/positions.js (Full and corrected code for Position Management with DnD)
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('positionForm');
    const positionsTableBody = document.getElementById('positionsTableBody');
    const positionIdField = document.getElementById('positionId');
    const titleField = document.getElementById('title');
    const defaultHoursField = document.getElementById('defaultHours');
    const saveButton = form.querySelector('button[type="submit"]');
    const cancelButton = document.getElementById('cancelEdit');

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
                // --- CRITICAL FIX: Explicitly convert position_id to string for data-id ---
                row.setAttribute('data-id', String(pos.position_id)); // Ensure it's set as a string "5", "6", etc.
                // --- END CRITICAL FIX ---

                row.insertCell(0).textContent = pos.display_order; // Display the order
                row.insertCell(1).textContent = pos.position_id; // ID
                row.insertCell(2).textContent = pos.title; // Title
                row.insertCell(3).textContent = pos.default_hours; // Default Hours

                const actionsCell = row.insertCell(4); // Actions column (adjusted index)
                
                const editButton = document.createElement('button');
                editButton.textContent = 'Edit';
                editButton.onclick = () => editPosition(pos);
                actionsCell.appendChild(editButton);

                const deleteButton = document.createElement('button');
                deleteButton.textContent = 'Delete';
                deleteButton.onclick = () => deletePosition(pos.position_id);
                actionsCell.appendChild(deleteButton);
            });

            // After rendering the table, re-initialize Sortable.js
            initializeSortable();

        } catch (error) {
            console.error("Error fetching positions:", error);
            alert(`Failed to load positions: ${error.message}`);
        }
    }

    // Function to handle form submission (Add/Edit)
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const title = titleField.value.trim();
        const defaultHours = parseFloat(defaultHoursField.value);

        // Basic validation
        if (!title || isNaN(defaultHours) || defaultHours < 0) {
            alert("Please fill in a valid position title and non-negative default hours.");
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
                alert('Position saved successfully!');
                form.reset();
                editingPositionId = null;
                saveButton.textContent = 'Save Position';
                cancelButton.style.display = 'none'; // Hide cancel button
                fetchPositions(); // Refresh table
            } else {
                const error = await response.json();
                alert(`Error saving position: ${error.message}`);
            }
        } catch (error) {
            console.error("Error submitting position form:", error);
            alert(`Failed to save position: ${error.message}`);
        }
    });

    // Function to populate form for editing
    function editPosition(pos) {
        editingPositionId = pos.position_id;
        positionIdField.value = pos.position_id;
        titleField.value = pos.title;
        defaultHoursField.value = pos.default_hours;
        saveButton.textContent = 'Update Position';
        cancelButton.style.display = 'inline-block'; // Show cancel button
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
                alert('Position deleted successfully!');
                fetchPositions(); // Refresh table
            } else {
                const error = await response.json();
                alert(`Error deleting position: ${error.message}`);
            }
        } catch (error) {
            console.error("Error deleting position:", error);
            alert(`Failed to delete position: ${error.message}`);
        }
    }

    // Initial load
    fetchPositions();

    // Initialize Sortable.js
    function initializeSortable() {
        if (sortable) { // Destroy old instance if it exists
            sortable.destroy();
        }
        sortable = Sortable.create(positionsTableBody, {
            animation: 150, // ms, animation speed
            draggable: 'tr', // Makes the entire <tr> element draggable
            ghostClass: 'sortable-ghost', // Class name for the drop placeholder
            onEnd: async function (evt) {
                // This event fires when drag-and-drop is finished
                const newOrder = [];
                // Iterate through the reordered rows to get their new sequence
                positionsTableBody.querySelectorAll('tr').forEach((row, index) => {
                    const positionIdRaw = row.getAttribute('data-id'); // Get the raw attribute value
                    const parsedPositionId = parseInt(positionIdRaw); // Attempt to parse it

                    console.log(`DEBUG: Row index ${index} - Raw data-id: "${positionIdRaw}", Parsed ID: ${parsedPositionId}, Order: ${index}`);

                    newOrder.push({
                        position_id: parsedPositionId, // Use the parsed value (will be NaN if input was "null")
                        order: index // New order is simply its index in the list
                    });
                });

                console.log('DEBUG: New position order being sent (JSON String):', JSON.stringify(newOrder));

                try {
                    const response = await fetch('/api/positions/reorder', { // Call the new backend reorder API
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(newOrder)
                    });

                    if (response.ok) {
                        alert('Position order updated successfully!');
                        // Refresh the table to show updated display_order numbers
                        fetchPositions();
                    } else {
                        const error = await response.json();
                        alert(`Error updating order: ${error.message}`);
                        // If save fails, re-fetch to revert to original order
                        fetchPositions();
                    }
                } catch (error) {
                    console.error("Error saving new order:", error);
                    alert(`Failed to save new order: ${error.message}`);
                    fetchPositions(); // Revert to original order on error
                }
            }
        });
        console.log("Sortable.js initialized:", sortable); // Confirm initialization
    }

    // Initial load: Fetch positions and then initialize Sortable.js
    // Refactor fetchPositions to ensure Sortable.js is initialized AFTER table rendering
    const originalFetchPositionsFunction = fetchPositions; // Store original reference
    fetchPositions = async function() {
        await originalFetchPositionsFunction(); // Run original fetchPositions logic
        initializeSortable(); // Then initialize Sortable.js
    };
    fetchPositions(); // Call the refactored one for initial load
});