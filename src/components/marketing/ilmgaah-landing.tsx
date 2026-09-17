"use client";

import Link from "next/link";
import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const capabilityGroups = [
  {
    index: "01",
    title: "Admissions to enrolment",
    body: "Capture applications, review them with clarity, convert accepted applicants into governed student records, and keep every step traceable."
  },
  {
    index: "02",
    title: "Students & academics",
    body: "Keep profiles, classes, programs, documents and day-to-day academic context together instead of scattering institutional memory across files and chats."
  },
  {
    index: "03",
    title: "Biometric attendance",
    body: "Run student and teacher attendance from one operational flow, designed for fast daily marking and clear follow-up when someone needs attention."
  },
  {
    index: "04",
    title: "Qur’an & Hifz",
    body: "Track learning targets, attempts, revision and progress with workflows made for the rhythm of Qur’an learning rather than forced generic fields."
  },
  {
    index: "05",
    title: "Exams & results",
    body: "Manage exam cycles, marks and publishing without losing the connection between students, classes, subjects and institutional records."
  },
  {
    index: "06",
    title: "Staff, reports & documents",
    body: "Give administrators role-aware workspaces for teachers, leave, reporting, IDs and documents while keeping sensitive information appropriately separated."
  }
];

const dayFlow = [
  ["08:00", "Arrival", "Biometric attendance opens. Exceptions surface without noise."],
  ["10:30", "Learning", "Teachers work from the same student and program context."],
  ["13:00", "Operations", "Admissions, staff and document work continue in parallel."],
  ["16:30", "Review", "Reports turn today’s activity into decisions, not another spreadsheet."],
  ["Anytime", "Families", "Parent-facing information remains focused on what families actually need."]
];

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
      <path d="M4 10h11M11 6l4 4-4 4" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BrandWordmark({ inverse = false }: { inverse?: boolean }) {
  return (
    <span className={`brand-wordmark${inverse ? " brand-wordmark--inverse" : ""}`} aria-label="Ilmgaah">
      Ilmgaah<span aria-hidden="true">.</span>
    </span>
  );
}

export function IlmgaahLanding() {
  const root = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || !root.current) return;

    const ctx = gsap.context(() => {
      gsap.set("[data-hero-reveal]", { yPercent: 110, opacity: 0 });
      gsap.set("[data-hero-fade]", { y: 20, opacity: 0 });
      gsap.set("[data-hero-card]", { y: 36, opacity: 0, rotateX: 5 });

      const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
      intro
        .to("[data-hero-reveal]", { yPercent: 0, opacity: 1, duration: 1.05, stagger: 0.09 })
        .to("[data-hero-fade]", { y: 0, opacity: 1, duration: 0.8, stagger: 0.08 }, "-=0.62")
        .to("[data-hero-card]", { y: 0, opacity: 1, rotateX: 0, duration: 1.15 }, "-=0.78");

      gsap.utils.toArray<HTMLElement>("[data-reveal]").forEach((element) => {
        gsap.fromTo(
          element,
          { y: 28, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.9,
            ease: "power3.out",
            scrollTrigger: { trigger: element, start: "top 86%", once: true }
          }
        );
      });

      gsap.utils.toArray<HTMLElement>("[data-parallax]").forEach((element) => {
        const amount = Number(element.dataset.parallax ?? 20);
        gsap.fromTo(
          element,
          { y: amount * -0.45 },
          {
            y: amount,
            ease: "none",
            scrollTrigger: { trigger: element, start: "top bottom", end: "bottom top", scrub: 0.8 }
          }
        );
      });

      ScrollTrigger.matchMedia({
        "(min-width: 900px)": () => {
          const story = gsap.timeline({
            scrollTrigger: {
              trigger: ".story-shell",
              start: "top top+=90",
              end: "+=1500",
              scrub: 0.6,
              pin: ".story-visual",
              pinSpacing: false
            }
          });

          story
            .to(".story-screen--attendance", { opacity: 1, y: 0, duration: 1 })
            .to(".story-screen--students", { opacity: 0.12, scale: 0.97, duration: 1 }, "<")
            .to(".story-screen--reports", { opacity: 1, y: 0, duration: 1 })
            .to(".story-screen--attendance", { opacity: 0.12, scale: 0.97, duration: 1 }, "<");
        }
      });
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={root} className="ilmgaah-site">
      <a className="skip-link" href="#main">Skip to content</a>

      <header className="site-nav" data-hero-fade>
        <Link href="/" className="site-nav__brand" aria-label="Ilmgaah home">
          <BrandWordmark />
        </Link>
        <nav className="site-nav__links" aria-label="Primary navigation">
          <a href="#platform">Platform</a>
          <a href="#experience">Experience</a>
          <a href="#principles">Principles</a>
        </nav>
        <div className="site-nav__actions">
          <Link className="text-link" href="/login">Sign in</Link>
          <a className="button button--dark button--small" href="#private-demo">
            Private demo <ArrowIcon />
          </a>
        </div>
      </header>

      <main id="main">
        <section className="hero-section" aria-labelledby="hero-title">
          <div className="hero-noise" aria-hidden="true" />
          <div className="hero-grid hero-grid--lines" aria-hidden="true" />
          <div className="hero-copy">
            <p className="eyebrow" data-hero-fade>Institution operations, beautifully unified.</p>
            <h1 id="hero-title" className="hero-title">
              <span className="clip-line"><span data-hero-reveal>Run your institution</span></span>
              <span className="clip-line"><span data-hero-reveal>with less noise.</span></span>
            </h1>
            <p className="hero-summary" data-hero-fade>
              Ilmgaah brings admissions, student records, biometric attendance, academics, Qur’an & Hifz,
              exams, staff, documents and family communication into one calm operating system.
            </p>
            <div className="hero-actions" data-hero-fade>
              <a className="button button--dark" href="#private-demo">Request a private walkthrough <ArrowIcon /></a>
              <a className="button button--ghost" href="#platform">Explore platform</a>
            </div>
            <div className="hero-proof" data-hero-fade aria-label="Product principles">
              <span>English + Urdu</span>
              <span>Role-aware access</span>
              <span>Responsive by design</span>
            </div>
          </div>

          <div className="hero-object" data-hero-card>
            <div className="hero-object__halo" aria-hidden="true" />
            <div className="product-frame" data-parallax="22">
              <div className="product-frame__topbar">
                <div className="product-frame__dots" aria-hidden="true"><i /><i /><i /></div>
                <span>Today · Main branch</span>
                <span className="status-pill"><i /> Live</span>
              </div>
              <div className="product-frame__body">
                <aside className="mini-sidebar" aria-hidden="true">
                  <BrandWordmark />
                  <div className="mini-sidebar__nav">
                    <span className="active" /><span /><span /><span /><span /><span />
                  </div>
                  <span className="mini-sidebar__footer" />
                </aside>
                <div className="mini-dashboard">
                  <div className="mini-dashboard__header">
                    <div><small>Institution overview</small><strong>Good morning.</strong></div>
                    <span className="mini-avatar">AH</span>
                  </div>
                  <div className="metric-row">
                    <article><small>Students</small><strong>400</strong><span>active records</span></article>
                    <article><small>Attendance</small><strong>96%</strong><span>today</span></article>
                    <article><small>Teachers</small><strong>20</strong><span>active staff</span></article>
                  </div>
                  <div className="mini-dashboard__lower">
                    <article className="attendance-card">
                      <div className="card-head"><div><small>Attendance</small><strong>Today’s rhythm</strong></div><span>Biometric</span></div>
                      <div className="attendance-bars" aria-hidden="true">
                        {[54, 72, 66, 84, 76, 91, 86, 96].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}
                      </div>
                      <div className="bar-labels"><span>8 AM</span><span>Now</span></div>
                    </article>
                    <article className="attention-card">
                      <small>Needs attention</small>
                      <ul>
                        <li><i /> 8 attendance exceptions</li>
                        <li><i /> 3 admission reviews</li>
                        <li><i /> 5 revisions due</li>
                      </ul>
                    </article>
                  </div>
                </div>
              </div>
            </div>
            <p className="hero-caption">A composed workspace for a very busy day.</p>
          </div>
        </section>

        <section className="manifesto-section" id="platform">
          <div className="manifesto-index" data-reveal>01 — Platform</div>
          <div className="manifesto-copy" data-reveal>
            <p className="display-copy">
              Institutions do not need another dashboard. They need a <em>single source of operational truth</em>
              that feels calm enough to use every day.
            </p>
          </div>
          <div className="manifesto-aside" data-reveal>
            <p>Ilmgaah is designed around connected workflows, not disconnected features.</p>
            <a className="editorial-link" href="#capabilities">See what connects <ArrowIcon /></a>
          </div>
        </section>

        <section className="capabilities-section" id="capabilities" aria-labelledby="capabilities-title">
          <div className="section-heading" data-reveal>
            <div>
              <p className="eyebrow eyebrow--dark">One system. Real work.</p>
              <h2 id="capabilities-title">Everything important stays connected.</h2>
            </div>
            <p>From first enquiry to long-term student history, operational context moves with the person instead of disappearing between tools.</p>
          </div>
          <div className="capability-grid">
            {capabilityGroups.map((item) => (
              <article className="capability-card" key={item.index} data-reveal>
                <span className="capability-card__index">{item.index}</span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </div>
                <span className="capability-card__rule" aria-hidden="true" />
              </article>
            ))}
          </div>
        </section>

        <section className="story-section" id="experience">
          <div className="section-heading section-heading--story" data-reveal>
            <div>
              <p className="eyebrow eyebrow--light">The experience</p>
              <h2>Complex underneath. Quiet on the surface.</h2>
            </div>
            <p>Ilmgaah keeps information density where it helps, then uses hierarchy, spacing and role-aware views to remove everything a person does not need.</p>
          </div>

          <div className="story-shell">
            <div className="story-visual" aria-hidden="true">
              <div className="story-device">
                <div className="story-device__bar"><BrandWordmark inverse /><span>Institution workspace</span></div>
                <div className="story-device__canvas">
                  <div className="story-screen story-screen--students">
                    <div className="screen-label">Students</div>
                    <h3>Every student, one record.</h3>
                    <div className="student-row"><i>ZA</i><span><strong>Zayd Ahmed</strong><small>Hifz · Group A</small></span><b>Active</b></div>
                    <div className="student-row"><i>MK</i><span><strong>Mariam Khan</strong><small>Course 1 · Group B</small></span><b>Active</b></div>
                    <div className="student-row"><i>AR</i><span><strong>Ali Raza</strong><small>Hifz · Group C</small></span><b>Active</b></div>
                  </div>
                  <div className="story-screen story-screen--attendance">
                    <div className="screen-label">Attendance</div>
                    <h3>See today before it becomes tomorrow.</h3>
                    <div className="ring-stat"><span>96%</span><small>marked</small></div>
                    <div className="attendance-split"><span><strong>384</strong><small>present</small></span><span><strong>16</strong><small>needs review</small></span></div>
                  </div>
                  <div className="story-screen story-screen--reports">
                    <div className="screen-label">Reports</div>
                    <h3>From activity to a clear decision.</h3>
                    <div className="report-lines"><i /><i /><i /><i /><i /></div>
                    <div className="report-foot"><span>7-day attendance</span><strong>+2.8%</strong></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="story-copy">
              <article data-reveal>
                <span>01</span>
                <h3>Start with the person.</h3>
                <p>Student, parent, teacher or administrator—the interface begins with context, then reveals the work relevant to that role.</p>
              </article>
              <article data-reveal>
                <span>02</span>
                <h3>Make daily operations obvious.</h3>
                <p>Attendance, admissions, learning and exceptions are treated as living operational flows instead of buried menu items.</p>
              </article>
              <article data-reveal>
                <span>03</span>
                <h3>Turn records into confidence.</h3>
                <p>Reports and documents sit on top of governed records, so staff can move from “what happened?” to “what should we do?” quickly.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="day-section" aria-labelledby="day-title">
          <div className="day-intro" data-reveal>
            <p className="eyebrow eyebrow--dark">Built for the actual day</p>
            <h2 id="day-title">One institution. Many moving moments.</h2>
            <p>A system feels premium when people stop fighting it. Ilmgaah is shaped around the cadence of daily administration, teaching and family communication.</p>
          </div>
          <div className="day-flow">
            {dayFlow.map(([time, title, body], index) => (
              <article key={title} data-reveal>
                <div className="day-flow__rail"><span>{String(index + 1).padStart(2, "0")}</span><i /></div>
                <time>{time}</time>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="language-section" id="principles">
          <div className="language-background" aria-hidden="true" data-parallax="28">علمگاہ</div>
          <div className="language-copy" data-reveal>
            <p className="eyebrow eyebrow--light">English + Urdu</p>
            <h2>Language should feel native, not translated.</h2>
            <p>Ilmgaah supports English and Urdu across the product experience with careful attention to RTL layout, dense controls and the places where institutions switch language mid-workflow.</p>
            <div className="language-samples" aria-label="Language examples">
              <span>Students</span><i aria-hidden="true" />
              <span lang="ur" dir="rtl">طلبہ</span><i aria-hidden="true" />
              <span>Attendance</span><i aria-hidden="true" />
              <span lang="ur" dir="rtl">حاضری</span>
            </div>
          </div>
        </section>

        <section className="principles-section" aria-labelledby="principles-title">
          <div className="section-heading" data-reveal>
            <div>
              <p className="eyebrow eyebrow--dark">Product principles</p>
              <h2 id="principles-title">Trust is a design material.</h2>
            </div>
            <p>Institution software holds sensitive records. The product should communicate discipline not only through security rules, but through every interaction.</p>
          </div>
          <div className="principle-grid">
            <article data-reveal><span>01</span><h3>Role-aware by default</h3><p>Administrative controls, teacher workspaces and family-facing information remain intentionally separated.</p></article>
            <article data-reveal><span>02</span><h3>Tenant-aware structure</h3><p>Institution and branch context are treated as part of the operating model, not as labels added at the end.</p></article>
            <article data-reveal><span>03</span><h3>Clarity before decoration</h3><p>Motion, hierarchy and visual polish exist to make actions clearer. Nothing competes with the work itself.</p></article>
          </div>
        </section>

        <section className="closing-section" id="private-demo">
          <div className="closing-orbit closing-orbit--one" aria-hidden="true" />
          <div className="closing-orbit closing-orbit--two" aria-hidden="true" />
          <div className="closing-copy" data-reveal>
            <p className="eyebrow eyebrow--light">A calmer institution starts here.</p>
            <h2>See Ilmgaah in context.</h2>
            <p>Explore the product as an operating system for a real institution—not a slideshow of disconnected features.</p>
            <div className="closing-actions">
              <Link className="button button--ivory" href="/login">Enter workspace <ArrowIcon /></Link>
              <a className="text-link text-link--light" href="#platform">Review platform</a>
            </div>
          </div>
          <div className="closing-signature" data-reveal>
            <BrandWordmark inverse />
            <span>Institution operations, beautifully unified.</span>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <BrandWordmark />
        <p>Built for thoughtful institutions.</p>
        <div><a href="#platform">Platform</a><Link href="/login">Sign in</Link><a href="#private-demo">Private demo</a></div>
        <small>© {new Date().getFullYear()} Ilmgaah</small>
      </footer>
    </div>
  );
}
