(() => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const progress = document.querySelector('.scroll-progress i');

  const updateProgress = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = max > 0 ? window.scrollY / max : 0;
    if (progress) progress.style.width = `${Math.max(0, Math.min(100, ratio * 100))}%`;
  };
  updateProgress();
  window.addEventListener('scroll', updateProgress, { passive: true });

  document.querySelectorAll('.animate-words').forEach(el => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) {
      if (walker.currentNode.nodeValue.trim()) textNodes.push(walker.currentNode);
    }
    textNodes.forEach(node => {
      const frag = document.createDocumentFragment();
      node.nodeValue.split(/(\s+)/).forEach(part => {
        if (/^\s+$/.test(part)) frag.appendChild(document.createTextNode(part));
        else if (part) {
          const span = document.createElement('span');
          span.className = 'word';
          span.textContent = part;
          frag.appendChild(span);
        }
      });
      node.parentNode.replaceChild(frag, node);
    });
  });

  const revealEls = [...document.querySelectorAll('[data-reveal]')];
  if (reduce) {
    revealEls.forEach(el => el.classList.add('is-visible'));
    document.querySelectorAll('.animate-words').forEach(el => el.classList.add('is-word-visible'));
  } else {
    const revealObs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          if (entry.target.classList.contains('animate-words')) entry.target.classList.add('is-word-visible');
          const animated = entry.target.querySelectorAll('.animate-words');
          animated.forEach(el => el.classList.add('is-word-visible'));
          revealObs.unobserve(entry.target);
        }
      });
    }, { threshold: .12, rootMargin: '0px 0px -7% 0px' });
    revealEls.forEach(el => revealObs.observe(el));

    const wordObs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-word-visible');
          wordObs.unobserve(entry.target);
        }
      });
    }, { threshold: .25 });
    document.querySelectorAll('.animate-words').forEach(el => wordObs.observe(el));
  }

  const screens = [...document.querySelectorAll('.story-screen')];
  const steps = [...document.querySelectorAll('.story-step')];
  if (screens.length) {
    let storyIndex = 0;
    let storyTimer = null;
    const activate = idx => {
      storyIndex = (idx + screens.length) % screens.length;
      screens.forEach((screen, i) => screen.classList.toggle('is-active', i === storyIndex));
      steps.forEach((step, i) => step.classList.toggle('is-current', i === storyIndex));
    };
    const startStoryLoop = () => {
      if (reduce || storyTimer) return;
      storyTimer = window.setInterval(() => activate(storyIndex + 1), 2800);
    };
    const stopStoryLoop = () => {
      if (!storyTimer) return;
      window.clearInterval(storyTimer);
      storyTimer = null;
    };
    activate(0);
    startStoryLoop();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopStoryLoop();
      else startStoryLoop();
    });
  }

  if (!reduce && window.matchMedia('(pointer:fine)').matches) {
    document.querySelectorAll('[data-tilt]').forEach(card => {
      card.addEventListener('pointermove', e => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        card.style.setProperty('--mx', `${x * 100}%`);
        card.style.setProperty('--my', `${y * 100}%`);
        const rx = (0.5 - y) * 2.2;
        const ry = (x - 0.5) * 2.2;
        card.style.transform = `perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-2px)`;
      });
      card.addEventListener('pointerleave', () => { card.style.transform = ''; });
    });

    document.querySelectorAll('.magnetic').forEach(btn => {
      btn.addEventListener('pointermove', e => {
        const r = btn.getBoundingClientRect();
        const x = e.clientX - (r.left + r.width / 2);
        const y = e.clientY - (r.top + r.height / 2);
        btn.style.transform = `translate(${x * .08}px, ${y * .12}px)`;
      });
      btn.addEventListener('pointerleave', () => { btn.style.transform = ''; });
    });
  }

  /* Final public navigation + login access */
  if (!document.querySelector('link[href="/ilmgaah-nav.css"]')) {
    const navCss = document.createElement('link');
    navCss.rel = 'stylesheet';
    navCss.href = '/ilmgaah-nav.css';
    document.head.appendChild(navCss);
  }

  const oldNav = document.querySelector('header.nav');
  if (oldNav) {
    oldNav.outerHTML = `
      <header class="site-nav shell" data-site-nav>
        <a aria-label="Ilmgaah home" class="wordmark" href="#top">Ilmgaah<span>.</span></a>
        <nav aria-label="Primary navigation" class="site-nav-links">
          <a class="site-nav-link" data-nav-section href="#system">System</a>
          <a class="site-nav-link" data-nav-section href="#modules">Modules</a>
          <a class="site-nav-link" data-nav-section href="#experience">Experience</a>
          <a class="site-nav-link" data-nav-section href="#language">English + Urdu</a>
          <a class="site-nav-link" data-nav-section href="#principles">Principles</a>
        </nav>
        <div class="site-nav-actions">
          <a class="site-login" href="/login">Log in <small>Admin / staff</small></a>
          <button aria-controls="site-mobile-nav" aria-expanded="false" aria-label="Open navigation" class="site-menu-toggle" type="button"><span></span></button>
        </div>
        <div aria-hidden="true" class="site-mobile-panel" id="site-mobile-nav">
          <div class="site-mobile-panel-inner">
            <a class="site-nav-link" data-nav-section href="#system">System</a>
            <a class="site-nav-link" data-nav-section href="#modules">Modules</a>
            <a class="site-nav-link" data-nav-section href="#experience">Experience</a>
            <a class="site-nav-link" data-nav-section href="#language">English + Urdu</a>
            <a class="site-nav-link" data-nav-section href="#principles">Principles</a>
            <a class="site-login" href="/login">Log in <small>Admin / staff</small></a>
          </div>
        </div>
      </header>`;
  }

  const modules = document.querySelector('.bento-wrap');
  if (modules && !modules.id) modules.id = 'modules';
  const language = document.querySelector('.language.shell');
  if (language && !language.id) language.id = 'language';

  const context = document.querySelector('.command-context');
  if (context) {
    const small = context.querySelector('small');
    const strong = context.querySelector('strong');
    if (small) small.textContent = 'Sample workspace';
    if (strong) {
      strong.classList.add('demo-date');
      strong.textContent = new Intl.DateTimeFormat('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long'
      }).format(new Date());
    }
  }
  const livePill = document.querySelector('.live-pill');
  if (livePill) livePill.innerHTML = '<i></i> Demo';
  const avatar = document.querySelector('.command-greeting .avatar');
  if (avatar) {
    avatar.textContent = 'IG';
    avatar.setAttribute('aria-hidden', 'true');
  }

  const nav = document.querySelector('[data-site-nav]');
  if (nav) {
    const toggle = nav.querySelector('.site-menu-toggle');
    const panel = nav.querySelector('.site-mobile-panel');
    const links = [...nav.querySelectorAll('[data-nav-section]')];

    const setMenu = open => {
      if (!toggle || !panel) return;
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
      panel.classList.toggle('is-open', open);
      panel.setAttribute('aria-hidden', String(!open));
    };

    toggle?.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
    links.forEach(link => link.addEventListener('click', () => setMenu(false)));
    document.addEventListener('keydown', event => { if (event.key === 'Escape') setMenu(false); });

    const updateNav = () => nav.classList.toggle('is-scrolled', window.scrollY > 18);
    updateNav();
    window.addEventListener('scroll', updateNav, { passive: true });

    const sections = links.map(link => document.querySelector(link.getAttribute('href'))).filter(Boolean);
    if ('IntersectionObserver' in window && sections.length) {
      const sectionObserver = new IntersectionObserver(entries => {
        const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        links.forEach(link => link.classList.toggle('is-active', link.getAttribute('href') === `#${visible.target.id}`));
      }, { rootMargin: '-24% 0px -58% 0px', threshold: [0, .2, .5, .8] });
      sections.forEach(section => sectionObserver.observe(section));
    }

    if (!reduce && 'animate' in nav) {
      nav.animate(
        [{ opacity: 0, transform: 'translateY(-10px)' }, { opacity: 1, transform: 'translateY(0)' }],
        { duration: 520, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'both' }
      );
    }
  }
})();
