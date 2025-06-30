/**
 * Enhanced Mobile Menu Script for DriveLink NYC
 * Centralized implementation for all pages
 */

// Initialize mobile menu functionality
function initMobileMenu() {
  const menuToggle = document.querySelector('.menu-toggle');
  const navbarLinks = document.querySelector('.navbar-links');
  const body = document.body;

  if (!menuToggle || !navbarLinks) return;

  // Menu toggle click handler
  menuToggle.addEventListener('click', function(e) {
    e.stopPropagation();
    const isExpanded = this.getAttribute('aria-expanded') === 'true';
    this.setAttribute('aria-expanded', !isExpanded);
    navbarLinks.classList.toggle('active');
    body.classList.toggle('nav-open');
    
    // Update aria-label for accessibility
    const newState = isExpanded ? 'Open' : 'Close';
    this.setAttribute('aria-label', `${newState} navigation menu`);
  });

  // Close menu when clicking outside
  document.addEventListener('click', function(e) {
    if (!navbarLinks.contains(e.target) && e.target !== menuToggle) {
      menuToggle.setAttribute('aria-expanded', 'false');
      navbarLinks.classList.remove('active');
      body.classList.remove('nav-open');
      menuToggle.setAttribute('aria-label', 'Open navigation menu');
    }
  });

  // Close menu when clicking links (mobile)
  document.querySelectorAll('.navbar-links a').forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth <= 768) {
        menuToggle.setAttribute('aria-expanded', 'false');
        navbarLinks.classList.remove('active');
        body.classList.remove('nav-open');
        menuToggle.setAttribute('aria-label', 'Open navigation menu');
      }
    });
  });

  // Handle window resize with debounce
  let resizeTimer;
  function handleResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (window.innerWidth > 768) {
        menuToggle.setAttribute('aria-expanded', 'false');
        navbarLinks.classList.remove('active');
        body.classList.remove('nav-open');
        menuToggle.setAttribute('aria-label', 'Open navigation menu');
      }
    }, 250);
  }
  
  window.addEventListener('resize', handleResize);
  handleResize(); // Initialize
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initMobileMenu);