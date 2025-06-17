function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`; // e.g., toast success
    toast.textContent = message;

    container.appendChild(toast);

    // Animate in
    setTimeout(() => {
        toast.classList.add('show');
    }, 10); // Small delay to allow element to be added to DOM

    // Animate out and remove after duration
    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => {
            toast.remove();
        });
    }, duration);
}

$(document).ready(function() {
    function fetchNotifications() {
        if (typeof current_user_id === 'undefined') return; // Don't run if user not logged in

        $.ajax({
            url: '/get_notifications',
            type: 'GET',
            success: function(notifications) {
                updateNotificationUI(notifications);
            },
            error: function(error) {
                console.error('Error fetching notifications:', error);
            }
        });
    }

    function updateNotificationUI(notifications) {
        const count = notifications.length;
        const $countBadge = $('#notification-count');
        const $menu = $('#notifications-menu');

        $menu.empty(); // Clear old notifications

        if (count > 0) {
            $countBadge.text(count).show();
            notifications.forEach(function(n) {
                let notificationLink = n.link;
                
                // Check if the link already has parameters
                if (notificationLink.includes('?')) {
                    // If it does, add the new parameter with an ampersand
                    notificationLink += `&notification_id=${n.id}`;
                } else {
                    // If it doesn't, add the new parameter with a question mark
                    notificationLink += `?notification_id=${n.id}`;
                }

                $menu.append(`<li><a class="dropdown-item" href="${notificationLink}">${n.message}</a></li>`);
            });
        } else {
            $countBadge.hide();
            $menu.append('<li><span class="dropdown-item-text">No new notifications</span></li>');
        }
    }

    // Fetch notifications every 60 seconds
    fetchNotifications();
    setInterval(fetchNotifications, 60000);
});