document.addEventListener('DOMContentLoaded', function () {
    const holidayList = document.getElementById('holidayList');
    const addHolidayForm = document.getElementById('addHolidayForm');

    // Function to fetch and display holidays
    async function fetchHolidays() {
        try {
            const response = await fetch('/api/holidays');
            if (!response.ok) throw new Error('Failed to fetch holidays');
            const holidays = await response.json();

            holidayList.innerHTML = ''; // Clear current list
            if (holidays.length === 0) {
                holidayList.innerHTML = '<li>No holidays defined.</li>';
            } else {
                holidays.forEach(holiday => {
                    const li = document.createElement('li');
                li.innerHTML = `
                    <span><strong>${holiday.description}</strong> - ${holiday.holiday_date}</span>
                    <button class="btn-sm delete-btn" data-id="${holiday.id}">Delete</button>
                `;
                    holidayList.appendChild(li);
                });
            }
        } catch (error) {
            console.error('Error:', error);
            showToast(error.message, 'error');
        }
    }
    // Handle form submission to add a new holiday
    addHolidayForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        const description = document.getElementById('holidayDescription').value;
        const date = document.getElementById('holidayDate').value;

        try {
            const response = await fetch('/api/holidays', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description, holiday_date: date })
            });
            const result = await response.json();

            if (!response.ok) throw new Error(result.message || 'Failed to add holiday');
            
            showToast('Holiday added successfully!', 'success');
            addHolidayForm.reset();
            fetchHolidays(); // Refresh the list
        } catch (error) {
            console.error('Error:', error);
            showToast(error.message, 'error');
        }
    });

    // Handle delete button clicks
    holidayList.addEventListener('click', async function (event) {
        if (event.target.classList.contains('delete-btn')) {
            const holidayId = event.target.dataset.id;
            if (!confirm('Are you sure you want to delete this holiday?')) return;

            try {
                const response = await fetch(`/api/holidays/${holidayId}`, { method: 'DELETE' });
                if (!response.ok) {
                     const result = await response.json();
                     throw new Error(result.message || 'Failed to delete holiday');
                }
                showToast('Holiday deleted successfully!', 'success');
                fetchHolidays(); // Refresh the list
            } catch (error) {
                console.error('Error:', error);
                showToast(error.message, 'error');
            }
        }
    });

    // Initial fetch of holidays
    fetchHolidays();
});