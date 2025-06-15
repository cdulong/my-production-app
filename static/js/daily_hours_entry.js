// static/js/daily_hours_entry.js (with improved forecast editing workflow)
document.addEventListener('DOMContentLoaded', () => {
    // --- Element Selectors ---
    const editForecastToggle = document.getElementById('editForecastToggle');
    const forecastActionsDiv = document.getElementById('forecastActions');
    const saveForecastBtn = document.getElementById('saveForecastBtn');
    const cancelForecastBtn = document.getElementById('cancelForecastBtn');
    const dailyHoursTableBody = document.querySelector('#dailyHoursTable tbody');
    
    // Keep other existing element selectors...
    const weekStartDatePicker = document.getElementById('weekStartDatePicker');
    const prevWeekBtn = document.getElementById('prevWeekBtn');
    const nextWeekBtn = document.getElementById('nextWeekBtn');
    const currentWeekDisplay = document.getElementById('currentWeekDisplay');
    const saveAllHoursBtn = document.getElementById('saveAllHoursBtn');
    const statusMessageDiv = document.getElementById('statusMessage');
    const dateSpans = {
        'dateSun': document.getElementById('dateSun'),
        'dateMon': document.getElementById('dateMon'),
        'dateTue': document.getElementById('dateTue'),
        'dateWed': document.getElementById('dateWed'),
        'dateThu': document.getElementById('dateThu'),
        'dateFri': document.getElementById('dateFri'),
        'dateSat': document.getElementById('dateSat'),
    };

    // --- State Variables ---
    let allWorkAreas = [];
    let currentWeekData = [];
    let currentMondayDisplayed = null;

    // --- Helper Functions (autosizeSelect, formatDate, getMondayOfWeek, etc.) ---
    // (These functions remain the same as before, so they are omitted here for brevity)
    // Please keep your existing helper functions in this section.
    function autosizeSelect(selectElement) {
        if (!selectElement) return;
        const resize = () => {
            const tempSpan = document.createElement('span');
            tempSpan.style.visibility = 'hidden';
            tempSpan.style.position = 'absolute';
            tempSpan.style.whiteSpace = 'nowrap';
            tempSpan.style.font = window.getComputedStyle(selectElement).font;
            const selectedOption = selectElement.options[selectElement.selectedIndex];
            if (selectedOption) {
                tempSpan.textContent = selectedOption.textContent;
            } else {
                tempSpan.textContent = '...';
            }
            document.body.appendChild(tempSpan);
            selectElement.style.width = `${tempSpan.offsetWidth + 35}px`;
            document.body.removeChild(tempSpan);
        };
        selectElement.addEventListener('change', resize);
        resize();
    }

    function formatDate(date) {
        if (!date || isNaN(date.getTime())) return null;
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function getMondayOfWeek(d) {
        const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        date.setHours(0, 0, 0, 0);
        const day = date.getDay();
        if (day === 0) date.setDate(date.getDate() + 1);
        const currentDayAfterSundayAdjustment = date.getDay();
        const daysToSubtract = currentDayAfterSundayAdjustment - 1;
        date.setDate(date.getDate() - daysToSubtract);
        return date;
    }

    function getUrlParameter(name) {
        name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
        var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
        var results = regex.exec(location.search);
        return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
    }

    function updateTableHeaderDates(mondayDate) {
        const sundayOfThisCalendarWeek = new Date(mondayDate);
        sundayOfThisCalendarWeek.setDate(mondayDate.getDate() - 1);
        const daysOfWeekShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        for (let i = 0; i < 7; i++) {
            const d = new Date(sundayOfThisCalendarWeek);
            d.setDate(sundayOfThisCalendarWeek.getDate() + i);
            const spanId = `date${daysOfWeekShort[i]}`;
            if (dateSpans[spanId]) {
                dateSpans[spanId].textContent = String(d.getDate()).padStart(2, '0');
            }
        }
        const weekEndDate = new Date(mondayDate);
        weekEndDate.setDate(mondayDate.getDate() + 6);
        currentWeekDisplay.textContent = `${formatDate(mondayDate)} - ${formatDate(weekEndDate)}`;
    }


    // --- NEW: Forecast Editing Workflow ---

    function setForecastEditMode(isEditing) {
        const rows = dailyHoursTableBody.querySelectorAll('tr');
        rows.forEach(row => {
            row.querySelectorAll('div.actual-input-container').forEach(container => {
                const forecastedDisplaySpan = container.querySelector('.forecasted-display');
                const forecastedInput = container.querySelector('input[data-field="forecasted_hours"]');
                const actualInput = container.querySelector('input[data-field="actual_hours"]');

                if (forecastedDisplaySpan && forecastedInput && actualInput) {
                    forecastedDisplaySpan.style.display = isEditing ? 'none' : 'inline-block';
                    forecastedInput.style.display = isEditing ? 'inline-block' : 'none';
                    actualInput.style.display = isEditing ? 'none' : 'inline-block';
                }
            });
        });

        // Show/hide action buttons
        forecastActionsDiv.classList.toggle('hidden', !isEditing);
        
        // Disable the main "Save All Hours" button during forecast editing
        saveAllHoursBtn.disabled = isEditing;
    }

    editForecastToggle.addEventListener('change', () => {
        const isEditing = editForecastToggle.checked;
        setForecastEditMode(isEditing);

        // If user unchecks the box without saving, it acts like a cancel
        if (!isEditing) {
            cancelForecastEditing();
        }
    });

    cancelForecastBtn.addEventListener('click', () => {
        cancelForecastEditing();
    });
    
    function cancelForecastEditing() {
        showToast('Forecast edits have been canceled.', 'info');
        fetchDailyHours(currentMondayDisplayed); // Re-fetch original data to discard changes
        editForecastToggle.checked = false;
        setForecastEditMode(false);
    }

    saveForecastBtn.addEventListener('click', async () => {
        const forecastsToSave = [];
        const allRows = dailyHoursTableBody.querySelectorAll('tr');
        
        allRows.forEach(row => {
            const employeeIdInput = row.querySelector('input[data-employee-id]');
            if (!employeeIdInput) return;
            const employeeId = employeeIdInput.getAttribute('data-employee-id');
            const workAreaSelect = row.cells[1].querySelector('select');
            const workAreaId = workAreaSelect ? parseInt(workAreaSelect.value) : null;

            row.querySelectorAll('input[data-field="forecasted_hours"]').forEach(input => {
                const dailyHourId = input.getAttribute('data-daily-hour-id');
                const workDate = input.getAttribute('data-work-date');
                const overallWeekId = input.getAttribute('data-overall-week-id');
                let newForecastValue = input.value.trim();
                newForecastValue = newForecastValue === '' ? null : parseFloat(newForecastValue);

                forecastsToSave.push({
                    daily_hour_id: dailyHourId ? parseInt(dailyHourId) : null,
                    employee_id: parseInt(employeeId),
                    work_date: workDate,
                    work_area_id: workAreaId,
                    new_forecasted_hours: newForecastValue,
                    overall_production_week_id: overallWeekId ? parseInt(overallWeekId) : null,
                });
            });
        });

        if (forecastsToSave.length === 0) {
            showToast("No forecasted hours to save.", "info");
            return;
        }

        try {
            const response = await fetch('/api/daily-hours/update-forecasts', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(forecastsToSave)
            });

            if (response.ok) {
                showToast('Forecasted hours updated successfully!', 'success');
            } else {
                const error = await response.json();
                throw new Error(error.message);
            }
        } catch (error) {
            showToast(`Error saving forecasted hours: ${error.message}`, 'error');
            console.error('Forecasted hours save error:', error);
        } finally {
            // This runs after success or failure
            editForecastToggle.checked = false; // Uncheck the box
            setForecastEditMode(false); // Hide buttons and inputs
            fetchDailyHours(currentMondayDisplayed); // Refresh data from DB
        }
    });

    
    // --- Data Fetching and Rendering ---

    async function fetchDailyHours(mondayDate) {
        // ... (This function remains the same as before)
        const formattedMondayDate = formatDate(mondayDate);
        dailyHoursTableBody.innerHTML = '<tr><td colspan="9">Loading hours...</td></tr>';
        currentWeekData = [];
        statusMessageDiv.textContent = '';
        saveAllHoursBtn.disabled = true;

        try {
            const response = await fetch(`/api/daily-hours-entry?reporting_week_start_date=${formattedMondayDate}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`HTTP error! Status: ${response.status}, Message: ${errorData.message || 'Unknown error'}`);
            }
            const data = await response.json();
            currentWeekData = data.employees_data;
            allWorkAreas = data.all_work_areas;

            if (data.current_overall_production_week_id === null) {
                statusMessageDiv.textContent = data.message_if_no_week;
                dailyHoursTableBody.innerHTML = '<tr><td colspan="9" style="color:gray; text-align: center;">No entries possible until Production Schedule is created.</td></tr>';
            } else {
                saveAllHoursBtn.disabled = false;
                renderDailyHoursTable();
            }
        } catch (error) {
            showToast(`Failed to load daily hours: ${error.message}`, 'error');
            dailyHoursTableBody.innerHTML = `<tr><td colspan="9" style="color:red;">Error loading hours: ${error.message}</td></tr>`;
            saveAllHoursBtn.disabled = true;
        }
    }

    function renderDailyHoursTable() {
        // ... (This function remains the same as before)
        dailyHoursTableBody.innerHTML = '';
        currentWeekData.forEach(employee => {
            const row = dailyHoursTableBody.insertRow();
            row.insertCell(0).textContent = `${employee.first_name} ${employee.last_initial}`;
            const workAreaCell = row.insertCell(1);
            const workAreaSelect = document.createElement('select');
            workAreaSelect.setAttribute('data-employee-id', employee.employee_id);
            workAreaSelect.setAttribute('data-field', 'work_area_id');
            workAreaSelect.classList.add('table-select');

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

                const forecastedDisplaySpan = document.createElement('span');
                forecastedDisplaySpan.classList.add('forecasted-display');
                forecastedDisplaySpan.textContent = `F: ${entry.forecasted_hours || '0.00'}`;
                container.appendChild(forecastedDisplaySpan);

                const forecastedInput = document.createElement('input');
                forecastedInput.type = 'number';
                forecastedInput.step = '0.01';
                forecastedInput.min = '0';
                forecastedInput.value = entry.forecasted_hours || '0.00';
                forecastedInput.style.display = 'none';
                forecastedInput.setAttribute('data-daily-hour-id', entry.daily_hour_id || '');
                forecastedInput.setAttribute('data-field', 'forecasted_hours');
                forecastedInput.setAttribute('data-overall-week-id', entry.overall_production_week_id || '');
                forecastedInput.setAttribute('data-employee-id', employee.employee_id);
                forecastedInput.setAttribute('data-work-date', entry.work_date);
                container.appendChild(forecastedInput);

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
            autosizeSelect(workAreaSelect);
        });
    }

    // --- Navigation and Main Save Button Listeners ---
    // (These functions remain the same as before, so they are omitted here for brevity)
    weekStartDatePicker.addEventListener('change', () => {
        const selectedDate = weekStartDatePicker.valueAsDate;
        if (selectedDate) {
            const calculatedMonday = getMondayOfWeek(selectedDate);
            weekStartDatePicker.value = formatDate(calculatedMonday);
            currentMondayDisplayed = calculatedMonday;
            updateTableHeaderDates(calculatedMonday);
            fetchDailyHours(calculatedMonday);
        }
    });

    prevWeekBtn.addEventListener('click', () => {
        if (currentMondayDisplayed) {
            const newMonday = new Date(currentMondayDisplayed);
            newMonday.setDate(currentMondayDisplayed.getDate() - 7);
            weekStartDatePicker.value = formatDate(newMonday);
            currentMondayDisplayed = newMonday;
            updateTableHeaderDates(newMonday);
            fetchDailyHours(newMonday);
        }
    });

    nextWeekBtn.addEventListener('click', () => {
        if (currentMondayDisplayed) {
            const newMonday = new Date(currentMondayDisplayed);
            newMonday.setDate(currentMondayDisplayed.getDate() + 7);
            weekStartDatePicker.value = formatDate(newMonday);
            currentMondayDisplayed = newMonday;
            updateTableHeaderDates(newMonday);
            fetchDailyHours(newMonday);
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
                showToast('Daily hours saved successfully!', 'success');
                fetchDailyHours(currentMondayDisplayed);
            } else {
                const error = await response.json();
                showToast(`Error saving hours: ${error.message}`, 'error');
            }
        } catch (error) {
            showToast(`Failed to save daily hours: ${error.message}`, 'error');
        }
    });


    // --- Initial Page Load Logic ---
    let initialDateFromUrl = getUrlParameter('reporting_week_start_date');
    let dateToLoad;
    if (initialDateFromUrl) {
        try {
            const parsedDate = new Date(initialDateFromUrl + 'T00:00:00');
            if (!isNaN(parsedDate.getTime())) {
                dateToLoad = getMondayOfWeek(parsedDate);
                if (formatDate(parsedDate) !== formatDate(dateToLoad)) {
                    showToast(`The provided date (${initialDateFromUrl}) is not a Monday. Displaying schedule starting ${formatDate(dateToLoad)}.`, 'error');
                }
            } else {
                dateToLoad = getMondayOfWeek(new Date());
            }
        } catch (e) {
            dateToLoad = getMondayOfWeek(new Date());
        }
    } else {
        dateToLoad = getMondayOfWeek(new Date());
    }
    weekStartDatePicker.value = formatDate(dateToLoad);
    currentMondayDisplayed = dateToLoad;
    updateTableHeaderDates(dateToLoad);
    fetchDailyHours(dateToLoad);
});