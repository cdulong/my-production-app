document.addEventListener('DOMContentLoaded', () => {

    // --- 1. Existing Function to highlight the current active sidebar link ---
    function highlightActiveSidebarLink() {
        const currentPath = window.location.pathname; // Get the path of the current page
        const sidebarLinks = document.querySelectorAll('.sidebar-menu-item'); // Select all sidebar links

        sidebarLinks.forEach(link => {
            const linkPath = link.getAttribute('href');
            link.classList.remove('active'); // Remove 'active' class from all links first

            // Check if the link's href matches the current path.
            // Using startsWith handles cases like /employees and /employees/1
            if (linkPath !== '/' && currentPath.startsWith(linkPath)) {
                link.classList.add('active');
            } else if (linkPath === '/' && currentPath === '/') {
                // Handle the root path explicitly
                link.classList.add('active');
            }
        });
    }

    // Call the highlight function on initial page load
    highlightActiveSidebarLink();


    // --- 2. New Functionality for the collapsible sidebar ---
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const body = document.body;

    const isSidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (isSidebarCollapsed) {
        body.classList.add('sidebar-collapsed');
    }

    if (sidebarToggle) {

        // Add click event listener to the toggle button
        sidebarToggle.addEventListener('click', function() {
            body.classList.toggle('sidebar-collapsed');

            // Save the new state to localStorage
            if (body.classList.contains('sidebar-collapsed')) {
                localStorage.setItem('sidebarCollapsed', 'true');
            } else {
                localStorage.setItem('sidebarCollapsed', 'false');
            }
        });
    }

    const bell = document.getElementById('notification-bell');
    const dropdown = document.getElementById('notification-dropdown');

    if (bell && dropdown) {
        bell.addEventListener('click', function(event) {
            event.stopPropagation(); // Prevents the document click listener from firing immediately
            dropdown.classList.toggle('show');
        });

        // Close the dropdown if the user clicks anywhere else on the page
        document.addEventListener('click', function(event) {
            if (!dropdown.contains(event.target) && !bell.contains(event.target)) {
                if (dropdown.classList.contains('show')) {
                    dropdown.classList.remove('show');
                }
            }
        });
    }

});