document.addEventListener('DOMContentLoaded', function() {
    const togglePasswordLink = document.querySelector('#togglePasswordLink');
    const passwordInput = document.querySelector('#password');

    if (togglePasswordLink && passwordInput) {
        togglePasswordLink.addEventListener('click', function (e) {
            e.preventDefault(); // Prevent the link from navigating

            // Toggle the type attribute of the password field
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            
            // Toggle the text of the link
            this.textContent = type === 'password' ? 'Show Password' : 'Hide Password';
        });
    }
});