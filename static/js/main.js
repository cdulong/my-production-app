// static/js/main.js (Global JavaScript for UI enhancements)
document.addEventListener('DOMContentLoaded', () => {
    // Function to highlight the current active sidebar link
    function highlightActiveSidebarLink() {
        const currentPath = window.location.pathname; // Get the path of the current page (e.g., '/', '/employees')
        const sidebarLinks = document.querySelectorAll('.sidebar-menu-item'); // Select all sidebar links

        sidebarLinks.forEach(link => {
            link.classList.remove('active'); // Remove 'active' class from all links first

            // Check if the link's href matches the current path
            // Handle root path separately, as href="/" matches all paths
            if (currentPath === '/' && link.getAttribute('href') === '/') {
                link.classList.add('active');
            } else if (currentPath !== '/' && link.getAttribute('href') !== '/' && currentPath.startsWith(link.getAttribute('href'))) {
                // For subpages, check if currentPath starts with the link's href (e.g., /employees matches /employees/1)
                link.classList.add('active');
            }
        });
    }

    // Call the function on initial page load
    highlightActiveSidebarLink();

    // You can add other global JavaScript functions here if needed
});