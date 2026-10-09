(function () {
    var root = document.documentElement;
    var themeToggle = document.getElementById('theme-toggle');
    var menuToggle = document.getElementById('menu-toggle');
    var menu = document.getElementById('site-menu');

    if (themeToggle) {
        themeToggle.addEventListener('click', function () {
            var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            root.setAttribute('data-theme', next);
            localStorage.setItem('theme', next);
        });
    }

    if (menuToggle && menu) {
        menuToggle.addEventListener('click', function () {
            var open = menu.classList.toggle('hidden') === false;
            menuToggle.setAttribute('aria-expanded', String(open));
        });
    }
})();
