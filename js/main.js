const THEME_STORAGE_KEY = 'playcred-theme';
const THEME_LIGHT = 'light';
const THEME_DARK = 'dark';

function isThemeValue(theme) {
  return theme === THEME_LIGHT || theme === THEME_DARK;
}

function getStoredTheme() {
  try {
    const theme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeValue(theme) ? theme : null;
  } catch (error) {
    return null;
  }
}

function applyTheme(theme, shouldPersist = false) {
  const resolvedTheme = isThemeValue(theme) ? theme : THEME_DARK;
  const root = document.documentElement;
  root.dataset.theme = resolvedTheme;
  root.style.colorScheme = resolvedTheme;

  if (shouldPersist) {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, resolvedTheme);
    } catch (error) {
      // Ignore storage failures and keep the in-memory theme change.
    }
  }

  document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
    const isDark = resolvedTheme === THEME_DARK;
    const label = button.querySelector('[data-theme-toggle-label]');

    button.setAttribute('aria-pressed', String(isDark));
    button.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
    if (label) {
      label.textContent = isDark ? 'Light' : 'Dark';
    }
  });

  return resolvedTheme;
}

function getInitialTheme() {
  return getStoredTheme() || THEME_DARK;
}

const SITE_SECTION_SEGMENTS = ['players', 'advertisers', 'advertising', 'about', 'faq'];

function getSiteSection(pathname) {
  const pathSegments = pathname.split('/').filter(Boolean);
  const primarySegment = pathSegments.find((segment) => SITE_SECTION_SEGMENTS.includes(segment)) || '';

  if (primarySegment === 'advertising') {
    return 'advertisers';
  }

  if (primarySegment === 'faq') {
    return 'about';
  }

  return primarySegment;
}

function applyActiveNavLink() {
  const activeSegment = getSiteSection(window.location.pathname);

  document.querySelectorAll('.nav-link').forEach((link) => {
    const linkSegment = getSiteSection(new URL(link.href).pathname);
    const isActive = activeSegment !== '' && linkSegment === activeSegment;

    link.classList.toggle('is-active', isActive);
    if (isActive) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  applyTheme(getInitialTheme());
  applyActiveNavLink();

  // Reveal animations
  const revealElements = document.querySelectorAll('.reveal');
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  revealElements.forEach(el => revealObserver.observe(el));

  // Header scroll effect
  const header = document.querySelector('.header');
  if (header) {
    window.addEventListener('scroll', () => {
      header.classList.toggle('scrolled', window.scrollY > 20);
    });
  }

  const themeToggle = document.querySelector('[data-theme-toggle]');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const nextTheme = document.documentElement.dataset.theme === THEME_DARK ? THEME_LIGHT : THEME_DARK;
      applyTheme(nextTheme, true);
    });
  }

  // Mobile menu toggle with overlay
  const menuToggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.nav');

  if (menuToggle && nav) {
    const overlay = document.createElement('div');
    overlay.className = 'nav-overlay';
    document.body.appendChild(overlay);

    function openNav() {
      nav.classList.add('active');
      menuToggle.classList.add('active');
      overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function closeNav() {
      nav.classList.remove('active');
      menuToggle.classList.remove('active');
      overlay.classList.remove('active');
      document.body.style.overflow = '';
    }

    menuToggle.addEventListener('click', () => {
      nav.classList.contains('active') ? closeNav() : openNav();
    });

    overlay.addEventListener('click', closeNav);

    // Close on nav link click (for same-page navigation)
    nav.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', closeNav);
    });
  }
});
