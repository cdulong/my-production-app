// static/js/daily_hours_entry.js (Full and corrected code for navigation)
document.addEventListener('DOMContentLoaded', () => {
    const weekStartDatePicker = document.getElementById('weekStartDatePicker');
    const prevWeekBtn = document.getElementById('prevWeekBtn');
    const nextWeekBtn = document.getElementById('nextWeekBtn');
    const currentWeekDisplay = document.getElementById('currentWeekDisplay');
    const dailyHoursTableBody = document.querySelector('#dailyHoursTable tbody');
    const saveAllHoursBtn = document.getElementById('saveAllHoursBtn');
    const statusMessageDiv = document.getElementById('statusMessage'); // NEW: For displaying messages
    // --- NEW: Forecast Edit Toggle ---
    const editForecastToggle = document.getElementById('editForecastToggle');
    let forecastEditMode = false; // Initial state: forecast editing is off
    // --- END NEW ---

    const dateSpans = {
        'dateSun': document.getElementById('dateSun'),
        'dateMon': document.getElementById('dateMon'),
        'dateTue': document.getElementById('dateTue'),
        'dateWed': document.getElementById('dateWed'),
        'dateThu': document.getElementById('dateThu'),
        'dateFri': document.getElementById('dateFri'),
        'dateSat': document.getElementById('dateSat'),
    };

    let allWorkAreas = [];
    let currentWeekData = [];
    let currentMondayDisplayed = null; // NEW: Our single source of truth for the current week's Monday

    function formatDate(date) {
        if (!date || isNaN(date.getTime())) {
            console.error("formatDate received an invalid date:", date);
            return null;
        }
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return year + '-' + month + '-' + day;
    }

    function getMondayOfWeek(d) {
        const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        date.setHours(0, 0, 0, 0);

        const day = date.getDay();
        if (day === 0) {
            date.setDate(date.getDate() + 1);
        }
        const currentDayAfterSundayAdjustment = date.getDay();
        const daysToSubtract = currentDayAfterSundayAdjustment - 1;
        date.setDate(date.getDate() - daysToSubtract);
        return date;
    }

    function updateTableHeaderDates(mondayDate) {
        // Calculate the Sunday of *this* calendar week from the given Monday
        const sundayOfThisCalendarWeek = new Date(mondayDate);
        sundayOfThisCalendarWeek.setDate(mondayDate.getDate() - 1); // Go back one day from Monday to get Sunday

        const daysOfWeekShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dateObjects = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(sundayOfThisCalendarWeek);
            d.setDate(sundayOfThisCalendarWeek.getDate() + i);
            dateObjects.push(d);
            const spanId = `date${daysOfWeekShort[i]}`;
            if (dateSpans[spanId]) {
                dateSpans[spanId].textContent = String(d.getDate()).padStart(2, '0');
            } else {
                console.error(`Element with ID '${spanId}' not found. Check HTML IDs.`);
            }
        }
        // Display the Monday-Sunday range for the picker label
        const weekEndDate = new Date(mondayDate);
        weekEndDate.setDate(mondayDate.getDate() + 6); // Monday + 6 days = Sunday of that week
        currentWeekDisplay.textContent = `${formatDate(mondayDate)} - ${formatDate(weekEndDate)}`;
        
        // No longer return sundayToFetch; fetchDailyHours now takes Monday directly.
        // The function's purpose is now purely for header update and currentWeekDisplay.
        // The fetchDailyHours call will use the mondayDate directly.
    }

    // Helper to parse URL query parameters
    function getUrlParameter(name) {
        name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
        var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
        var results = regex.exec(location.search);
        return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
    }

    // --- NEW: Toggle Forecast Editing Function ---
    function toggleForecastEditing() {
        forecastEditMode = editForecastToggle.checked; // Update global state

        // Handle saving forecasts when toggle is turned OFF (Call BEFORE hiding inputs)
        if (!forecastEditMode) {
            saveForecastedHours();
        }

        const rows = dailyHoursTableBody.querySelectorAll('tr');
        rows.forEach(row => {
            row.querySelectorAll('div.actual-input-container').forEach(container => {
                const forecastedDisplaySpan = container.querySelector('.forecasted-display');
                const forecastedInput = container.querySelector('input[data-field="forecasted_hours"]');
                const actualInput = container.querySelector('input[data-field="actual_hours"]'); // Get actual input reference

                if (forecastedDisplaySpan && forecastedInput && actualInput) { // Ensure all elements exist
                    if (forecastEditMode) { // If turning editing ON (forecasts are editable)
                        forecastedDisplaySpan.style.display = 'none'; // Hide forecast read-only span
                        forecastedInput.style.display = 'inline-block'; // Show forecast input
                        actualInput.style.display = 'none'; // --- CRITICAL FIX: Hide actuals input ---
                    } else { // If turning editing OFF (actuals are editable/default)
                        forecastedDisplaySpan.style.display = 'inline-block'; // Show forecast read-only span
                        forecastedInput.style.display = 'none'; // Hide forecast input
                        actualInput.style.display = 'inline-block'; // --- CRITICAL FIX: Show actuals input ---
                    }
                }
            });
        });
    }

    // --- NEW: Save Forecasted Hours Function ---
    async function saveForecastedHours() {
        const forecastedEntriesToUpdate = [];
        const rows = dailyHoursTableBody.querySelectorAll('tr');

        rows.forEach(row => {
            row.querySelectorAll('div.actual-input-container').forEach(container => {
                const forecastedInput = container.querySelector('input[data-field="forecasted_hours"]');

                if (forecastedInput && forecastedInput.style.display !== 'none') { // Only process if input is visible
                    const dailyHourId = forecastedInput.getAttribute('data-daily-hour-id');
                    const employeeId = forecastedInput.getAttribute('data-employee-id');
                    const workDate = forecastedInput.getAttribute('data-work-date');
                    const overallWeekId = forecastedInput.getAttribute('data-overall-week-id');
                    
                    let newForecastValue = forecastedInput.value.trim();
                    newForecastValue = newForecastValue === '' ? null : parseFloat(newForecastValue);

                    // Only include in update if forecast value has changed or is being explicitly set
                    // For simplicity, we'll send all visible forecast inputs that are numbers.
                    forecastedEntriesToUpdate.push({
                        daily_hour_id: dailyHourId ? parseInt(dailyHourId) : null,
                        employee_id: parseInt(employeeId),
                        work_date: workDate,
                        new_forecasted_hours: newForecastValue,
                        overall_production_week_id: overallWeekId ? parseInt(overallWeekId) : null,
                        // Note: work_area_id is missing from here, will need to fetch from corresponding actualInput
                    });
                }
            });
        });

        if (forecastedEntriesToUpdate.length === 0) {
            console.log("No forecasted hours changed to save.");
            return;
        }

        // --- Important: Need work_area_id for each entry. It's stored on the actualInput's <td> or a hidden input.
        // Let's refine the loop to get work_area_id from the employee row's select.
        // This requires getting the work_area_id from the <select> element in the first visible column of each row.

        // Refactored collection:
        const refactoredForecastsToSave = [];
        const allRows = dailyHoursTableBody.querySelectorAll('tr');
        allRows.forEach(row => {
            const employeeId = row.querySelector('input[data-employee-id]').getAttribute('data-employee-id');
            const workAreaSelect = row.cells[1].querySelector('select'); // The work area select for the row
            const workAreaId = workAreaSelect ? parseInt(workAreaSelect.value) : null;

            row.querySelectorAll('input[data-field="forecasted_hours"]').forEach(input => {
                if (input.style.display !== 'none') { // Only process if input is visible (i.e. in edit mode)
                    const dailyHourId = input.getAttribute('data-daily-hour-id');
                    const workDate = input.getAttribute('data-work-date');
                    const overallWeekId = input.getAttribute('data-overall-week-id');
                    let newForecastValue = input.value.trim();
                    newForecastValue = newForecastValue === '' ? null : parseFloat(newForecastValue);

                    refactoredForecastsToSave.push({
                        daily_hour_id: dailyHourId ? parseInt(dailyHourId) : null,
                        employee_id: parseInt(employeeId),
                        work_date: workDate,
                        work_area_id: workAreaId, // Include work_area_id
                        new_forecasted_hours: newForecastValue,
                        overall_production_week_id: overallWeekId ? parseInt(overallWeekId) : null,
                    });
                }
            });
        });

        if (refactoredForecastsToSave.length === 0) {
            console.log("No forecasted hours to save.");
            return;
        }

        // Send to backend API
        try {
            const response = await fetch('/api/daily-hours/update-forecasts', { // NEW API endpoint
                method: 'PUT', // Or POST, PUT is suitable for update
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(refactoredForecastsToSave)
            });

            if (response.ok) {
                alert('Forecasted hours updated successfully!');
                // Re-fetch data to reflect changes and re-hide inputs
                fetchDailyHours(currentMondayDisplayed); 
            } else {
                const error = await response.json();
                alert(`Error saving forecasted hours: ${error.message}`);
                console.error('Forecasted hours save error:', error);
                fetchDailyHours(currentMondayDisplayed); // Refresh on error
            }
        } catch (error) {
            console.error("Error sending forecasted hours update:", error);
            alert(`An unexpected error occurred while saving forecasts: ${error.message}`);
            fetchDailyHours(currentMondayDisplayed); // Refresh on network error
        }
    }
    // --- END NEW ---

    async function fetchDailyHours(mondayDate) {
        const formattedMondayDate = formatDate(mondayDate);

        // console.log("--- fetchDailyHours Call (Sending Monday) ---");
        // console.log("DEBUG: Input 'mondayDate' to fetchDailyHours:", mondayDate);
        // console.log("DEBUG: Formatted Monday Date string for API:", formattedMondayDate);
        // console.log("DEBUG: Full API URL being requested:", `/api/daily-hours-entry?reporting_week_start_date=${formattedMondayDate}`);
        // console.log("----------------------------");

        dailyHoursTableBody.innerHTML = '<tr><td colspan="9">Loading hours...</td></tr>';
        currentWeekData = [];
        statusMessageDiv.textContent = '';
        saveAllHoursBtn.disabled = true;

        try {
            // Change parameter name here
            const response = await fetch(`/api/daily-hours-entry?reporting_week_start_date=${formattedMondayDate}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`HTTP error! Status: ${response.status}, Message: ${errorData.message || 'Unknown error'}`);
            }
            const data = await response.json();
            currentWeekData = data.employees_data;
            allWorkAreas = data.all_work_areas;

            // --- NEW: Check if overall week exists for this period ---
            if (data.current_overall_production_week_id === null) {
                statusMessageDiv.textContent = data.message_if_no_week;
                dailyHoursTableBody.innerHTML = '<tr><td colspan="9" style="color:gray; text-align: center;">No entries possible until Production Schedule is created.</td></tr>';
            } else {
                saveAllHoursBtn.disabled = false;
                renderDailyHoursTable();
            }
            // --- END NEW ---

        } catch (error) {
            console.error("Error fetching daily hours:", error);
            alert(`Failed to load daily hours: ${error.message}`);
            dailyHoursTableBody.innerHTML = `<tr><td colspan="9" style="color:red;">Error loading hours: ${error.message}</td></tr>`;
            saveAllHoursBtn.disabled = true; // Keep disabled on error
        }
    }

    function renderDailyHoursTable() {
        dailyHoursTableBody.innerHTML = '';

        currentWeekData.forEach(employee => {
            const row = dailyHoursTableBody.insertRow();
            row.insertCell(0).textContent = `${employee.first_name} ${employee.last_initial}`;

            const workAreaCell = row.insertCell(1);
            const workAreaSelect = document.createElement('select');
            workAreaSelect.setAttribute('data-employee-id', employee.employee_id);
            workAreaSelect.setAttribute('data-field', 'work_area_id');

            allWorkAreas.forEach(area => {
                const option = document.createElement('option');
                option.value = area.work_area_id;
                option.textContent = area.work_area_name;
                workAreaSelect.appendChild(option);
            });
            workAreaCell.appendChild(workAreaSelect);

            employee.daily_entries.forEach((entry, index) => {
                const dayCell = row.insertCell(index + 2);

                const container = document.createElement('div');
                container.classList.add('actual-input-container');

                // --- MODIFIED: Forecasted Hours Display/Edit ---
                const forecastedDisplaySpan = document.createElement('span'); // Span for read-only display
                forecastedDisplaySpan.classList.add('forecasted-display'); // Add class for styling
                forecastedDisplaySpan.textContent = `F: ${entry.forecasted_hours || '0.00'}`;
                container.appendChild(forecastedDisplaySpan);

                const forecastedInput = document.createElement('input'); // Input for editing forecast
                forecastedInput.type = 'number';
                forecastedInput.step = '0.01';
                forecastedInput.min = '0';
                forecastedInput.value = entry.forecasted_hours || '0.00';
                forecastedInput.style.display = 'none'; // Initially hidden
                forecastedInput.setAttribute('data-daily-hour-id', entry.daily_hour_id || '');
                forecastedInput.setAttribute('data-field', 'forecasted_hours'); // Identify as forecast input
                // Store actual overall_production_week_id for sending forecast updates
                forecastedInput.setAttribute('data-overall-week-id', entry.overall_production_week_id || '');
                forecastedInput.setAttribute('data-employee-id', employee.employee_id); // Employee ID for this entry
                forecastedInput.setAttribute('data-work-date', entry.work_date); // Work Date for this entry
                container.appendChild(forecastedInput);
                // --- END MODIFIED ---

                const actualInput = document.createElement('input');
                actualInput.type = 'number';
                actualInput.step = '0.01';
                actualInput.min = '0';
                actualInput.value = entry.actual_hours || '';
                actualInput.setAttribute('data-daily-hour-id', entry.daily_hour_id || '');
                actualInput.setAttribute('data-employee-id', employee.employee_id);
                actualInput.setAttribute('data-work-date', entry.work_date);
                actualInput.setAttribute('data-overall-week-id', entry.overall_production_week_id || '');
                actualInput.setAttribute('data-field', 'actual_hours');
                actualInput.setAttribute('data-forecasted-hours', entry.forecasted_hours);
                container.appendChild(actualInput);

                dayCell.appendChild(container);

                if (entry.work_area_id) {
                    workAreaSelect.value = entry.work_area_id;
                } else if (employee.primary_work_area_id) {
                    workAreaSelect.value = employee.primary_work_area_id;
                }
            });
        });
    }

    // Event listener for week start date picker change (MANUAL SELECTION)
    weekStartDatePicker.addEventListener('change', () => {
        const selectedDate = weekStartDatePicker.valueAsDate; // This is the Date object from the picker
        if (selectedDate) {
            // Get the Monday corresponding to the selected date (using JS's Date logic)
            // This is the source of truth for the picker's displayed Monday
            const calculatedMonday = getMondayOfWeek(selectedDate); // Re-use the existing JS helper

            // console.log("--- Date Picker Change Event (Manual Selection) ---");
            // console.log("Selected Date (from picker):", selectedDate.toISOString());
            // console.log("Calculated Monday (getMondayOfWeek):", calculatedMonday.toISOString());
            // console.log("-------------------------------");

            weekStartDatePicker.value = formatDate(calculatedMonday); // Always snap the picker to the calculated Monday
            currentMondayDisplayed = calculatedMonday; // Update our source of truth

            // Update headers and fetch data based on this Monday
            updateTableHeaderDates(calculatedMonday); // This sets the headers
            fetchDailyHours(calculatedMonday); // Fetch data using the Monday date
        } else {
            alert("No date selected. Resetting to current week.");
            const today = new Date();
            const todayMonday = getMondayOfWeek(today); // Get current Monday
            weekStartDatePicker.value = formatDate(todayMonday);
            currentMondayDisplayed = todayMonday;
            updateTableHeaderDates(todayMonday);
            fetchDailyHours(todayMonday);
        }
    });

    // Navigation buttons step by 7 days from the Monday displayed in the picker
    prevWeekBtn.addEventListener('click', () => {
        if (currentMondayDisplayed) {
            const newMonday = new Date(currentMondayDisplayed);
            newMonday.setDate(currentMondayDisplayed.getDate() - 7); // Calculate the new Monday

            weekStartDatePicker.value = formatDate(newMonday); // Update picker visually
            currentMondayDisplayed = newMonday; // Update our source of truth

            updateTableHeaderDates(newMonday); // Update headers
            fetchDailyHours(newMonday); // Fetch data using the new Monday
        }
    });

    nextWeekBtn.addEventListener('click', () => {
        if (currentMondayDisplayed) {
            const newMonday = new Date(currentMondayDisplayed);
            newMonday.setDate(currentMondayDisplayed.getDate() + 7); // Calculate the new Monday

            weekStartDatePicker.value = formatDate(newMonday); // Update picker visually
            currentMondayDisplayed = newMonday; // Update our source of truth

            updateTableHeaderDates(newMonday); // Update headers
            fetchDailyHours(newMonday); // Fetch data using the new Monday
        }
    });

    saveAllHoursBtn.addEventListener('click', async () => {
        const entriesToUpdate = [];
        const rows = dailyHoursTableBody.querySelectorAll('tr');

        rows.forEach(row => {
            const employeeId = row.querySelector('input[data-employee-id]').getAttribute('data-employee-id');
            const workAreaSelect = row.cells[1].querySelector('select');
            const currentWorkAreaId = parseInt(workAreaSelect.value);

            for (let i = 2; i < row.cells.length; i++) {
                const inputContainer = row.cells[i].querySelector('.actual-input-container');
                const actualInput = inputContainer.querySelector('input[data-field="actual_hours"]');

                if (actualInput) {
                    const dailyHourId = actualInput.getAttribute('data-daily-hour-id');
                    const workDate = actualInput.getAttribute('data-work-date');
                    const overallWeekId = actualInput.getAttribute('data-overall-week-id');
                    const forecastedHours = parseFloat(actualInput.getAttribute('data-forecasted-hours'));

                    let actualHoursValue = actualInput.value.trim();
                    actualHoursValue = actualHoursValue === '' ? null : parseFloat(actualHoursValue);

                    entriesToUpdate.push({
                        daily_hour_id: dailyHourId ? parseInt(dailyHourId) : null,
                        employee_id: parseInt(employeeId),
                        work_date: workDate,
                        work_area_id: currentWorkAreaId,
                        forecasted_hours: forecastedHours,
                        actual_hours: actualHoursValue,
                        overall_production_week_id: overallWeekId ? parseInt(overallWeekId) : null,
                    });
                }
            }
        });

        try {
            const response = await fetch('/api/daily-hours-entry/batch-update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(entriesToUpdate)
            });

            if (response.ok) {
                alert('Daily hours saved successfully!');
                // --- CRITICAL FIX: Pass the correct Monday from our source of truth ---
                fetchDailyHours(currentMondayDisplayed); // Use currentMondayDisplayed
                // --- END CRITICAL FIX ---
            } else {
                const error = await response.json();
                alert(`Error saving hours: ${error.message}`);
            }
        } catch (error) {
            console.error("Error saving daily hours:", error);
            alert(`Failed to save daily hours: ${error.message}`);
        } finally { // Added finally block for completeness (ensure button re-enabled)
            // No need to re-enable here as fetchDailyHours will disable/enable
        }
    });

    // --- NEW: Initial Load Logic (Use URL parameter if present) ---
    let initialDateFromUrl = getUrlParameter('reporting_week_start_date');
    let dateToLoad;

    if (initialDateFromUrl) {
        try {
            // Attempt to parse the date from URL
            const parsedDate = new Date(initialDateFromUrl + 'T00:00:00'); // Ensure it's treated as local midnight
            if (!isNaN(parsedDate.getTime())) { // Check if it's a valid date
                // Ensure it's a Monday. If not, snap to the Monday of its week.
                dateToLoad = getMondayOfWeek(parsedDate);
                // Also, if the parsed date wasn't a Monday, update the picker visually to the snapped Monday
                if (formatDate(parsedDate) !== formatDate(dateToLoad)) {
                    // Alert only if URL had a non-Monday that got snapped
                    alert(`The provided date (${initialDateFromUrl}) is not a Monday. Displaying schedule starting ${formatDate(dateToLoad)}.`);
                }
            } else {
                console.warn("WARN: Invalid date format in URL parameter. Defaulting to current week.");
                dateToLoad = getMondayOfWeek(new Date()); // Fallback to current week if URL date invalid
            }
        } catch (e) {
            console.error("Error parsing date from URL. Defaulting to current week:", e);
            dateToLoad = getMondayOfWeek(new Date()); // Fallback if any error during parsing
        }
    } else {
        dateToLoad = getMondayOfWeek(new Date()); // No URL parameter, default to current week
    }

    weekStartDatePicker.value = formatDate(dateToLoad); // Set picker to the determined Monday
    currentMondayDisplayed = dateToLoad; // Update our source of truth

    updateTableHeaderDates(dateToLoad); // Set initial headers
    fetchDailyHours(dateToLoad); // Fetch initial data
    // --- END NEW ---

    // --- NEW: Forecast Edit Toggle Event Listener ---
    editForecastToggle.addEventListener('change', toggleForecastEditing);
    // --- END NEW ---

});