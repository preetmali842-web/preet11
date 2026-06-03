// --- Router ---
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-menu .nav-item');
    navItems.forEach(item => {
        if(!item.dataset.target) return;
        item.addEventListener('click', (e) => {
            navItems.forEach(n => n.classList.remove('active'));
            e.currentTarget.classList.add('active');
            
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            document.getElementById(e.currentTarget.dataset.target).classList.add('active');
            
            if (e.currentTarget.dataset.target === 'analytics') renderCharts();

            // FIX: Smooth scroll to the top of the page on every navigation click
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });
}