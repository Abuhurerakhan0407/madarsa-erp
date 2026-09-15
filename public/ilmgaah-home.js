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
})();
