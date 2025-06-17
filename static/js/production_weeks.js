// static/js/production_weeks.js (Full and corrected code block, with inlined cell creation and all functionalities)
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('productionWeekForm');
    const startDateField = document.getElementById('startDate');
    const tableBody = document.querySelector('#productionWeeksTable tbody');
    const contributingDatesDisplay = document.getElementById('contributingDatesDisplay');
    // --- NEW: Modal elements ---
    const modal = document.getElementById('contributingDatesModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    const closeModalButton = document.querySelector('.close-button');
    // --- END NEW ---

    let editingRowId = null; // Store the currently editing row's ID

    function formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // Helper to get the Sunday from a Monday date string
    function getSundayFromMonday(mondayDateStr) {
        const monday = new Date(mondayDateStr + 'T00:00:00'); // Ensure it's treated as midnight local time
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() - 1); // Subtract 1 day to get the previous Sunday
        return sunday;
    }

    function openModal() {
        modal.style.display = 'flex'; // Use flex to center, as per CSS
    }

    function closeModal() {
        modal.style.display = 'none';
        modalTitle.textContent = ''; // Clear title
        modalBody.innerHTML = ''; // Clear content
    }

    function getVarianceClass(actual, forecast) {
        if (actual === null || forecast === null || actual === undefined || forecast === undefined) {
            return ''; // No class if data is missing
        }
        const actualNum = parseFloat(actual);
        const forecastNum = parseFloat(forecast);

        if (isNaN(actualNum) || isNaN(forecastNum)) {
            return ''; // No class if values aren't valid numbers
        }

        if (actualNum > forecastNum) {
            return 'variance-negative';
        } else if (actualNum < forecastNum) {
            return 'variance-positive';
        }
        return ''; // Return empty string for neutral/equal to use default color
    }

    // Common inline style for buttons (basic sizing and alignment, colors from CSS)
    const commonButtonStyleInline = `
        /* Adjusted for icons */
        width: 35px; /* Smaller, fixed width for icon */
        height: 35px; /* Make it square */
        padding: 0; /* Remove padding, let icon fill */
        display: flex; /* Make button a flex container itself */
        justify-content: center; /* Center icon horizontally */
        align-items: center; /* Center icon vertically */
        overflow: hidden; /* Hide any overflow */

        font-size: 1.2em; /* Larger font size for the icon */
        vertical-align: middle;
        box-sizing: border-box;
        margin-right: 0; /* Managed by flexbox gap on parent td */
        /* Flexbox properties for the button itself (as a flex item) */
        flex-grow: 0;
        flex-shrink: 0;
        flex-basis: auto;

        /* Default colors (will be overridden by class styles in HTML) */
        background-color: #007bff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    `;

    async function fetchProductionWeeks() {
        try {
            const response = await fetch('/api/overall-production-weeks');
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`HTTP error! status: ${response.status}, Message: ${errorData.message || 'Unknown error'}`);
            }
            const schedules = await response.json(); 
            tableBody.innerHTML = ''; // Clear existing rows

            if (schedules.length === 0) {
                // Adjust colspan for total number of columns (11 data columns + 1 actions column = 12)
                tableBody.innerHTML = '<tr><td colspan="12">No production schedules created yet.</td></tr>';
                return;
            }

            schedules.forEach(schedule => { // Iterating through 'schedule'
                const row = tableBody.insertRow();
                row.id = `week-row-${schedule.overall_production_week_id}`;
                
                // --- Insert all data cells in order ---
                // Cell 0: ID (Read-only)
                row.insertCell().textContent = schedule.overall_production_week_id;

                // Cell 1: Reporting Schedule (Start - End) (Read-only)
                row.insertCell().textContent = `${schedule.reporting_week_start_date} -> ${schedule.reporting_week_end_date}`;

                // Cell 2: Forecasted Product Value (Editable)
                const forecastedProductValueCell = row.insertCell();
                forecastedProductValueCell.setAttribute('data-field', 'forecasted_product_value');
                forecastedProductValueCell.setAttribute('data-original-value', schedule.forecasted_product_value || '');
                forecastedProductValueCell.textContent = schedule.forecasted_product_value || '-'; // Initial text display
                const fpvInput = document.createElement('input');
                fpvInput.type = 'number'; fpvInput.step = '0.01'; fpvInput.min = '0';
                fpvInput.value = schedule.forecasted_product_value || '';
                fpvInput.style.display = 'none'; // Hidden by default
                forecastedProductValueCell.appendChild(fpvInput);

                // Cell 3: Actual Product Value (Editable)
                const actualProductValueCell = row.insertCell();
                actualProductValueCell.className = getVarianceClass(schedule.actual_product_value, schedule.forecasted_product_value);
                actualProductValueCell.setAttribute('data-field', 'actual_product_value');
                actualProductValueCell.setAttribute('data-original-value', schedule.actual_product_value || '');
                actualProductValueCell.textContent = schedule.actual_product_value || '-'; // Initial text display
                const apvInput = document.createElement('input');
                apvInput.type = 'number'; apvInput.step = '0.01'; apvInput.min = '0';
                apvInput.value = schedule.actual_product_value || '';
                apvInput.style.display = 'none';
                actualProductValueCell.appendChild(apvInput);

                // Cell 4: Forecasted $/HR (Read-only)
                const forecastedDphCell = row.insertCell();
                forecastedDphCell.classList.add('read-only-calculated');
                forecastedDphCell.textContent = schedule.forecasted_dollars_per_hour || '-';

                // Cell 5: Actual $/HR (Read-only)
                const actualDphCell = row.insertCell();
                actualDphCell.className = 'read-only-calculated ' + getVarianceClass(schedule.actual_dollars_per_hour, schedule.forecasted_dollars_per_hour);
                actualDphCell.textContent = schedule.actual_dollars_per_hour || '-';

                // Cell 6: Forecasted Boxes Built (Editable)
                const forecastedBoxesBuiltCell = row.insertCell();
                forecastedBoxesBuiltCell.setAttribute('data-field', 'forecasted_boxes_built');
                forecastedBoxesBuiltCell.setAttribute('data-original-value', schedule.forecasted_boxes_built || '');
                forecastedBoxesBuiltCell.textContent = schedule.forecasted_boxes_built || '-'; // Initial text display
                const fbbInput = document.createElement('input');
                fbbInput.type = 'number'; fbbInput.step = '1'; fbbInput.min = '0';
                fbbInput.value = schedule.forecasted_boxes_built || '';
                fbbInput.style.display = 'none';
                forecastedBoxesBuiltCell.appendChild(fbbInput);

                // Cell 7: Actual Boxes Built (Editable)
                const actualBoxesBuiltCell = row.insertCell();
                actualBoxesBuiltCell.className = getVarianceClass(schedule.actual_boxes_built, schedule.forecasted_boxes_built);
                actualBoxesBuiltCell.setAttribute('data-field', 'actual_boxes_built');
                actualBoxesBuiltCell.setAttribute('data-original-value', schedule.actual_boxes_built || '');
                actualBoxesBuiltCell.textContent = schedule.actual_boxes_built || '-'; // Initial text display
                const abbInput = document.createElement('input');
                abbInput.type = 'number'; abbInput.step = '1'; abbInput.min = '0';
                abbInput.value = schedule.actual_boxes_built || '';
                abbInput.style.display = 'none';
                actualBoxesBuiltCell.appendChild(abbInput);

                // Cell 8: Forecasted Total Production Hours (Read-only)
                const forecastedTotalHrsCell = row.insertCell();
                forecastedTotalHrsCell.classList.add('read-only-calculated');
                forecastedTotalHrsCell.textContent = schedule.forecasted_total_production_hours || '-';

                // Cell 9: Actual Total Production Hours (Read-only)
                const actualTotalHrsCell = row.insertCell();
                actualTotalHrsCell.className = 'read-only-calculated ' + getVarianceClass(schedule.forecasted_total_production_hours, schedule.actual_total_production_hours);
                actualTotalHrsCell.textContent = schedule.actual_total_production_hours || '-';

                // --- Cell 10: Actions (Last Cell) ---
                const actionsCell = row.insertCell(); 

                const buttonContainer = document.createElement('div');
                buttonContainer.style.display = 'flex';
                buttonContainer.style.gap = '5px';
                buttonContainer.style.justifyContent = 'flex-end';
                buttonContainer.style.alignItems = 'center';
                buttonContainer.style.flexWrap = 'nowrap';
                
                const viewDatesButton = document.createElement('button');
                // NEW: Use innerHTML for icon, add aria-label
                viewDatesButton.innerHTML = '<i class="fa-solid fa-calendar-days"></i>'; // Calendar Icon
                viewDatesButton.ariaLabel = 'View Contributing Dates'; // Accessibility
                viewDatesButton.onclick = () => window.showContributingDates(schedule.reporting_week_start_date);
                viewDatesButton.classList.add('view-dates-btn');
                viewDatesButton.style.cssText = commonButtonStyleInline;
                buttonContainer.appendChild(viewDatesButton);

                const goToDailyEntryButton = document.createElement('button');
                // NEW: Use innerHTML for icon, add aria-label
                goToDailyEntryButton.innerHTML = '<i class="fa-solid fa-clock"></i>'; // Clock Icon
                goToDailyEntryButton.ariaLabel = 'Go to Hours Entry'; // Accessibility
                goToDailyEntryButton.classList.add('go-to-daily-entry-btn');
                goToDailyEntryButton.style.cssText = commonButtonStyleInline;
                goToDailyEntryButton.onclick = () => {
                    window.location.href = `/daily-hours-entry?reporting_week_start_date=${schedule.reporting_week_start_date}`;
                };
                buttonContainer.appendChild(goToDailyEntryButton);

                const editButton = document.createElement('button');
                // NEW: Use innerHTML for icon, add aria-label
                editButton.innerHTML = '<i class="fa-solid fa-pencil"></i>'; // Pencil Icon
                editButton.ariaLabel = 'Edit Schedule'; // Accessibility
                editButton.classList.add('edit-btn');
                editButton.onclick = () => window.enableEditMode(schedule.overall_production_week_id);
                editButton.style.cssText = commonButtonStyleInline;
                buttonContainer.appendChild(editButton);

                const saveButton = document.createElement('button');
                // NEW: Use innerHTML for icon, add aria-label
                saveButton.innerHTML = '<i class="fa-solid fa-check"></i>'; // Check Mark Icon
                saveButton.ariaLabel = 'Save Changes'; // Accessibility
                saveButton.classList.add('save-btn');
                saveButton.onclick = () => window.saveProductionWeek(schedule.overall_production_week_id);
                saveButton.style.cssText = commonButtonStyleInline;
                saveButton.style.display = 'none'; // Hide on initial load
                buttonContainer.appendChild(saveButton);

                const cancelButton = document.createElement('button');
                // NEW: Use innerHTML for icon, add aria-label
                cancelButton.innerHTML = '<i class="fa-solid fa-arrow-left"></i>'; // Left Arrow/Back Icon
                cancelButton.ariaLabel = 'Cancel Edit'; // Accessibility
                cancelButton.classList.add('cancel-btn');
                cancelButton.onclick = () => window.disableEditMode(schedule.overall_production_week_id, true);
                cancelButton.style.cssText = commonButtonStyleInline;
                cancelButton.style.display = 'none'; // Hide on initial load
                buttonContainer.appendChild(cancelButton);

                const deleteButton = document.createElement('button');
                // NEW: Use innerHTML for icon, add aria-label
                deleteButton.innerHTML = '<i class="fa-solid fa-trash-can"></i>'; // Trash Can/Delete Icon
                deleteButton.ariaLabel = 'Delete Schedule'; // Accessibility
                deleteButton.classList.add('delete-btn');
                deleteButton.onclick = () => window.deleteProductionSchedule(schedule.overall_production_week_id);
                deleteButton.style.cssText = commonButtonStyleInline;
                buttonContainer.appendChild(deleteButton);

                actionsCell.appendChild(buttonContainer);
            });

        } catch (error) {
            console.error("CRITICAL ERROR in fetchProductionWeeks (Full Page Logic):", error);
            showToast(`CRITICAL ERROR: Failed to load production schedules: ${error.message}`,'error');
            tableBody.innerHTML = `<tr><td colspan="12" style="color:red;">Error loading schedules: ${error.message}</td></tr>`; // Adjust colspan
        }
    }

    

    // --- Make functions available globally for inline onclick attributes ---
    // This is necessary because functions defined inside DOMContentLoaded are not global by default.
    // Attach these to the window object.
    window.enableEditMode = function(weekId) {
        // console.log("DEBUG: enableEditMode called for weekId:", weekId);
        if (editingRowId !== null && editingRowId !== weekId) {
            window.disableEditMode(editingRowId, true);
        }
        editingRowId = weekId;
        const row = document.getElementById(`week-row-${weekId}`);
        // console.log("DEBUG: Row element found:", row);

        if (row) {
            row.classList.add('editable-row');
            // console.log("DEBUG: 'editable-row' class added. Current classes:", row.classList.value);
            
            row.querySelectorAll('td[data-field]').forEach(cell => {
                const input = cell.querySelector('input');
                
                // --- CRITICAL FIX: Hide text content and show input ---
                // Find and hide text node (if it exists)
                Array.from(cell.childNodes).forEach(node => {
                    if (node.nodeType === Node.TEXT_NODE) { // Check if it's a text node
                        node.textContent = ''; // Clear text content
                    }
                });

                if (input) { // Ensure input exists
                    // console.log("DEBUG: Processing input element:", input);
                    // console.log("DEBUG: Input current display (before change):", input.style.display);
                    input.style.display = 'inline-block'; // Show input
                    // console.log("DEBUG: Input new display (after change):", input.style.display);
                } else {
                    // console.warn("WARN: Could not find input in editable cell (this shouldn't happen). Cell:", cell);
                }
            });
            // Toggle buttons
            // console.log("DEBUG: Toggling button visibility...");
            row.querySelector('.edit-btn').style.display = 'none';
            row.querySelector('.delete-btn').style.display = 'none';
            row.querySelector('.view-dates-btn').style.display = 'none';
            row.querySelector('.go-to-daily-entry-btn').style.display = 'none'; // Hide new button
            row.querySelector('.save-btn').style.display = 'inline-block';
            row.querySelector('.cancel-btn').style.display = 'inline-block';
            // console.log("DEBUG: Button visibility toggled.");
        } else {
            // console.log("DEBUG: Row not found for enableEditMode:", weekId);
        }
    };

    window.disableEditMode = function(weekId, revertChanges = false) {
        // console.log("DEBUG: disableEditMode called for weekId:", weekId, "revertChanges:", revertChanges);
        editingRowId = null;
        const row = document.getElementById(`week-row-${weekId}`);
        if (row) {
            row.classList.remove('editable-row');
            row.querySelectorAll('td[data-field]').forEach(cell => {
                const input = cell.querySelector('input');
                if (input) { // Ensure input exists
                    input.style.display = 'none'; // Hide input
                    
                    if (revertChanges) {
                        input.value = cell.getAttribute('data-original-value'); // Revert input value
                    }
                    // --- CRITICAL FIX: Restore text content from input value ---
                    // Re-create text node if it was removed in enableEditMode
                    let textNode = Array.from(cell.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
                    if (!textNode) { // If text node was removed, re-create it
                        textNode = document.createTextNode('');
                        cell.prepend(textNode); // Add it back as the first child
                    }
                    textNode.textContent = input.value || '-'; // Update the text node with the value
                    // --- END CRITICAL FIX ---
                }
            });
            // Toggle buttons
            row.querySelector('.edit-btn').style.display = 'inline-block';
            row.querySelector('.delete-btn').style.display = 'inline-block';
            row.querySelector('.view-dates-btn').style.display = 'inline-block';
            row.querySelector('.go-to-daily-entry-btn').style.display = 'inline-block'; // Show new button
            row.querySelector('.save-btn').style.display = 'none';
            row.querySelector('.cancel-btn').style.display = 'none';
            // console.log("DEBUG: Button visibility toggled in disableEditMode.");
        }
    };

    window.saveProductionWeek = async function(weekId) {
        const row = document.getElementById(`week-row-${weekId}`);
        if (!row) return;

        const data = {
            forecasted_product_value: parseFloat(row.querySelector('td[data-field="forecasted_product_value"] input').value),
            actual_product_value: parseFloat(row.querySelector('td[data-field="actual_product_value"] input').value),
            forecasted_boxes_built: parseInt(row.querySelector('td[data-field="forecasted_boxes_built"] input').value),
            actual_boxes_built: parseInt(row.querySelector('td[data-field="actual_boxes_built"] input').value),
        };
        
        for (const key in data) {
            if (data[key] === '' || isNaN(data[key])) {
                data[key] = null;
            }
        }

        try {
            const response = await fetch(`/api/overall-production-weeks/${weekId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                showToast('Production Schedule updated successfully!','success');
                window.disableEditMode(weekId, false);
                fetchProductionWeeks();
            } else {
                const error = await response.json();
                showToast(`Error updating schedule: ${error.message}`,'error');
            }
        } catch (error) {
            console.error("Error saving production schedule:", error);
            showToast(`Failed to save production schedule: ${error.message}`,'error');
        }
    };

    window.showContributingDates = async function(reportingStartDateStr) {
        // Clear previous content and set loading message in modal body
        modalBody.innerHTML = `<h4>Calculating contributing dates for schedule starting ${reportingStartDateStr}...</h4>`;
        modalTitle.innerHTML = `Contributing Dates for Schedule Starting:<br> ${reportingStartDateStr}`;
        openModal(); // Open the modal

        try {
            const response = await fetch('/api/work-areas');
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Failed to fetch work areas: ${errorData.message || 'Unknown error'}`);
            }
            const workAreas = await response.json();
            const reportingStartDate = new Date(reportingStartDateStr + 'T00:00:00');

            let htmlContent = `<ul>`; // Removed h4 as title is in modalTitle

            workAreas.forEach(area => {
                const offsetDays = area.reporting_week_start_offset_days;
                const contributingStart = new Date(reportingStartDate);
                contributingStart.setDate(reportingStartDate.getDate() + offsetDays);

                const contributingEnd = new Date(contributingStart);
                contributingEnd.setDate(contributingStart.getDate() + area.contributing_duration_days - 1);

                htmlContent += `<li><strong>${area.work_area_name}:</strong> ${formatDate(contributingStart)} &rarr; ${formatDate(contributingEnd)}</li>`; // Use formatDate helper
            });
            htmlContent += `</ul>`;
            modalBody.innerHTML = htmlContent; // Inject content into modal body

        } catch (error) {
            console.error("Error displaying contributing dates:", error);
            modalBody.innerHTML = `<p style="color: red;">Error displaying contributing dates: ${error.message}</p>`;
            modalTitle.textContent = "Error Loading Dates";
        }
    }

    window.deleteProductionSchedule = async function(id) {
        const confirmationText = 'DELETE';
        const userConfirmation = prompt(`This action cannot be undone. You will be deleting the entire production schedule and all of its associated daily hour entries.\n\nPlease type "${confirmationText}" to confirm.`);

        // if (!confirm('Are you sure you want to delete this Production Schedule? This will also delete all associated daily hour records. This action cannot be undone.')) return;

        if (userConfirmation === null || userConfirmation.trim() !== confirmationText) {
            showToast('Deletion cancelled. The text must be entered exactly as "DELETE".', 'info');
            return; // Stop the function if confirmation is not correct
        }

        try {
            const response = await fetch(`/api/overall-production-weeks/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                showToast('Production Schedule deleted successfully!','success');
                fetchProductionWeeks(); //Refresh the table
            } else {
                // Handle server errors (e.g., 404, 500)
                const error = await response.json();
                showToast(`Error deleting production schedule: ${error.message}`,'error');
            }
        } catch (error) {
            // Handle network errors or other enexpected issues
            console.error("Error deleting production schedule:", error);
            showToast(`Failed to delete production schedule: ${error.message}`,'error');
        }
    };

    // NEW: Global function for creating a new production schedule ---
    window.createNewProductionSchedule = async function() {
        const startDate = startDateField.value; // Access startDateField from its original scope

        // console.log("DEBUG: createNewProductionSchedule function called via onclick.");
        // console.log("DEBUG: Start date from picker:", startDate);

        if (!startDate) {
            showToast('Please select a start date.','error');
            // console.log("DEBUG: Start date is empty.");
            return;
        }

        // console.log("DEBUG: Attempting to send POST request to /api/overall-production-weeks with date:", startDate);
        try {
            const response = await fetch('/api/overall-production-weeks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reporting_week_start_date: startDate })
            });

            if (response.ok) {
                showToast('Production Schedule created successfully and daily hours generated!','success');
                form.reset(); // Reset the form using the 'form' variable from parent scope
                fetchProductionWeeks(); // Refresh table
            } else {
                const error = await response.json();
                showToast(`Error creating production schedule: ${error.message}`,'error');
            }
        } catch (error) {
            console.error("Error submitting production schedule form:", error);
            showToast(`Failed to create production schedule: ${error.message}`,'error');
        }
    };

    // Initial load
    fetchProductionWeeks();
    
    // --- NEW: Close modal event listener ---
    closeModalButton.addEventListener('click', closeModal);
    // Close modal if clicking outside content (optional)
    window.addEventListener('click', (event) => {
        if (event.target == modal) {
            closeModal();
        }
    });
});