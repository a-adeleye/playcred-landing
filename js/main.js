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

const SITE_SECTION_SEGMENTS = ['players', 'advertisers', 'advertising', 'about', 'faq', 'contact'];

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

let contactConfigCache = undefined;

const CONTACT_CONFIG_DEFAULTS = {
  local: {
    contactApiUrl: 'http://localhost:8081/api/v1/contact',
    firebase: {
      apiKey: 'AIzaSyAH5IlpAIYlrYfXbWtEESSAUXIWH3kgRhU',
      authDomain: 'playcred-6e57b.firebaseapp.com',
      projectId: 'playcred-6e57b',
      appId: '1:370615590881:web:7db09cc3b621de73617ca0',
    },
    appCheckSiteKey: '6LcOOqYsAAAAABEKzNsx_ZGYMibPgbpLbRfEeRql',
  },
  production: {
    contactApiUrl: 'https://api.playcred.ae/api/v1/contact',
    firebase: {
      apiKey: 'AIzaSyBqD9T84q9bRWvzrLE1P5nZiwMsezyT2eI',
      authDomain: 'playcred-1a24f.firebaseapp.com',
      projectId: 'playcred-1a24f',
      appId: '1:777843113601:web:5b66623e1fa0a620b55780',
    },
    appCheckSiteKey: '6LeROxAtAAAAAO9E3Ce-4-Xl1chH5_CI1sTvSnIQ',
  },
};

function getRuntimeEnvironment() {
  const hostname = window.location.hostname.toLowerCase();

  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    window.location.protocol === 'file:'
  ) {
    return 'local';
  }

  return 'production';
}

function getFallbackContactConfig() {
  const environment = getRuntimeEnvironment();
  return CONTACT_CONFIG_DEFAULTS[environment];
}

function getContactConfig() {
  if (contactConfigCache !== undefined) {
    return contactConfigCache;
  }

  const configScript = document.getElementById('playcred-contact-config');
  if (configScript) {
    try {
      contactConfigCache = JSON.parse(configScript.textContent || 'null');
      if (contactConfigCache && contactConfigCache.contactApiUrl && contactConfigCache.firebase && contactConfigCache.appCheckSiteKey) {
        return contactConfigCache;
      }
    } catch (error) {
      // Fall through to the runtime defaults below.
    }
  }

  contactConfigCache = window.__PLAYCRED_CONTACT_CONFIG__ || getFallbackContactConfig();
  return contactConfigCache;
}

function getContactSubmissionUrl() {
  const config = getContactConfig();

  if (!config || !config.contactApiUrl) {
    throw new Error('Missing contact API configuration.');
  }

  return config.contactApiUrl;
}

let contactFirebaseSdkPromise = null;

async function getContactFirebaseSdk() {
  const config = getContactConfig();

  if (!config || !config.firebase || !config.appCheckSiteKey) {
    throw new Error('Missing Firebase App Check configuration.');
  }

  if (!contactFirebaseSdkPromise) {
    contactFirebaseSdkPromise = Promise.all([
      import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.12.5/firebase-app-check.js'),
    ]).then(([appModule, appCheckModule]) => {
      const app = appModule.initializeApp(config.firebase);
      const appCheck = appCheckModule.initializeAppCheck(app, {
        provider: new appCheckModule.ReCaptchaV3Provider(config.appCheckSiteKey),
        isTokenAutoRefreshEnabled: true,
      });

      return {
        appCheck,
        getToken: appCheckModule.getToken,
      };
    });
  }

  return contactFirebaseSdkPromise;
}

function collectContactFormPayload(form) {
  const getValue = (selector) => {
    const field = form.querySelector(selector);
    return field ? field.value.trim() : '';
  };

  return {
    fullName: getValue('#full-name'),
    email: getValue('#email'),
    phone: getValue('#phone') || null,
    inquiryType: getValue('#inquiry-type'),
    companyName: getValue('#company-name') || null,
    subject: getValue('#subject'),
    message: getValue('#message'),
    privacyConsent: Boolean(form.querySelector('#privacy-consent')?.checked),
    source: 'contact-page',
  };
}

async function readResponseBody(response) {
  const text = await response.text();

  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    return text;
  }
}

function wireContactForm() {
  const form = document.querySelector('[data-contact-form]');

  if (!form) {
    return;
  }

  const status = form.querySelector('[data-contact-status]');
  const submitButton = form.querySelector('button[type="submit"]');
  const originalButtonLabel = submitButton ? submitButton.innerHTML : '';

  function setStatus(message, variant) {
    if (!status) {
      return;
    }

    status.textContent = message;
    status.classList.remove('is-success', 'is-error');

    if (variant) {
      status.classList.add(variant);
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!form.reportValidity()) {
      return;
    }

    setStatus('Sending your message...', null);
    if (submitButton) {
      submitButton.disabled = true;
    }

    try {
      const { appCheck, getToken } = await getContactFirebaseSdk();
      let appCheckTokenResponse;

      try {
        appCheckTokenResponse = await getToken(appCheck, false);
      } catch (appCheckError) {
        console.error('App Check token retrieval failed.', appCheckError);
        throw new Error('App Check token retrieval failed.');
      }

      const response = await fetch(getContactSubmissionUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Firebase-AppCheck': appCheckTokenResponse.token,
        },
        body: JSON.stringify(collectContactFormPayload(form)),
      });

      if (!response.ok) {
        const errorBody = await readResponseBody(response);
        const detail = typeof errorBody === 'string' ? ` ${errorBody.slice(0, 180)}` : '';
        throw new Error(`Request failed with status ${response.status}.${detail}`);
      }

      const responseBody = await readResponseBody(response);
      if (responseBody && typeof responseBody === 'object' && responseBody.success === false) {
        throw new Error('Unexpected response body.');
      }

      form.reset();
      setStatus('Your message has been sent. We will get back to you soon.', 'is-success');
    } catch (error) {
      console.error('Contact form submit failed.', error);
      if (error && typeof error.message === 'string' && error.message.includes('App Check token retrieval failed')) {
        setStatus('App Check could not be verified right now. Please refresh and try again.', 'is-error');
      } else if (error && typeof error.message === 'string' && error.message.includes('Request failed with status 4')) {
        setStatus('The contact API rejected the request. Please check the form and try again.', 'is-error');
      } else {
        setStatus('We could not send your message just now. Please try again.', 'is-error');
      }
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.innerHTML = originalButtonLabel;
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  applyTheme(getInitialTheme());
  applyActiveNavLink();
  wireContactForm();

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
