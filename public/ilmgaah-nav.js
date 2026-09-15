(() => {
  const nav = document.querySelector('[data-site-nav]');
  if (!nav) return;

  const toggle = nav.querySelector('.site-menu-toggle');
  const panel = nav.querySelector('.site-mobile-panel');
  const sectionLinks = [...nav.querySelectorAll('[data-nav-section]')];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const setMenu = (open) => {
    if (!toggle || !panel) return;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    panel.classList.toggle('is-open', open);
    panel.setAttribute('aria-hidden', String(!open));
  };

  toggle?.addEventListener('click', () => {
    setMenu(toggle.getAttribute('aria-expanded') !== 'true');
  });

  sectionLinks.forEach((link) => {
    link.addEventListener('click', () => setMenu(false));
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setMenu(false);
  });

  const updateScrolledState = () => {
    nav.classList.toggle('is-scrolled', window.scrollY > 18);
  };
  updateScrolledState();
  window.addEventListener('scroll', updateScrolledState, { passive: true });

  const sections = sectionLinks
    .map((link) => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);

  if ('IntersectionObserver' in window && sections.length) {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      sectionLinks.forEach((link) => {
        link.classList.toggle('is-active', link.getAttribute('href') === `#${visible.target.id}`);
      });
    }, {
      rootMargin: '-24% 0px -58% 0px',
      threshold: [0, .2, .5, .8]
    });
    sections.forEach((section) => observer.observe(section));
  }

  const date = document.querySelector('.demo-date');
  if (date) {
    const label = new Intl.DateTimeFormat('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    }).format(new Date());
    date.textContent = label;
  }

  if (!reduce && 'animate' in nav) {
    nav.animate(
      [
        { opacity: 0, transform: 'translateY(-10px)' },
        { opacity: 1, transform: 'translateY(0)' }
      ],
      { duration: 520, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'both' }
    );
  }
})();
