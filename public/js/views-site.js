/* Gen-Z Hub — public website: landing page + static site pages (about, privacy, terms, guidelines, contact) */
(function () {
  'use strict';
  const G = window.GZ, S = G.state, esc = G.esc;

  const YEAR = new Date().getFullYear();

  const NAVBAR = () => `<header class="site-nav">
    <div class="site-wrap row">
      <a class="logo" href="#/welcome"><span class="logo-mark">Z</span><span class="txt">GEN-Z HUB</span></a>
      <nav class="row site-links" aria-label="Site">
        <a href="#/welcome">Home</a><a href="#/about">About</a><a href="#/guidelines">Guidelines</a><a href="#/contact">Contact</a>
      </nav>
      <div class="row" style="margin-left:auto;gap:8px">
        ${S.user ? `<a class="btn btn-primary btn-sm" href="#/">Open app →</a>`
          : `<a class="btn btn-ghost btn-sm" href="#/auth">Log in</a><a class="btn btn-primary btn-sm" href="#/auth?mode=signup">Join free</a>`}
      </div>
    </div></header>`;

  const FOOTER = () => `<footer class="site-foot">
    <div class="site-wrap">
      <div class="foot-grid">
        <div>
          <div class="logo" style="margin-bottom:8px"><span class="logo-mark">Z</span><span class="txt">GEN-Z HUB</span></div>
          <p class="small muted" style="max-width:280px">Connect. Build. Play. Grow. The social platform for the generation building businesses and winning lobbies.</p>
        </div>
        <div><b class="small">Platform</b>
          <a href="#/welcome">Overview</a><a href="#/welcome#business">Business Hub</a><a href="#/welcome#gaming">Gaming Hub</a><a href="#/auth?mode=signup">Create account</a></div>
        <div><b class="small">Company</b>
          <a href="#/about">About</a><a href="#/contact">Contact</a><a href="#/guidelines">Community guidelines</a></div>
        <div><b class="small">Legal</b>
          <a href="#/privacy">Privacy policy</a><a href="#/terms">Terms of use</a><a href="#/guidelines">Safety & reporting</a></div>
      </div>
      <div class="divider"></div>
      <div class="between wrap small muted">
        <span>© ${YEAR} Gen-Z Hub. An original platform — not affiliated with any other social network.</span>
        <span>Made for Gen-Z · 13+ only</span>
      </div>
    </div></footer>`;

  function sitePage(inner) {
    const view = G.mountFull(`${NAVBAR()}<main id="site-main">${inner}</main>${FOOTER()}`);
    document.documentElement.dataset.site = '1';
    return view;
  }

  /* ---------------- landing ---------------- */
  G.route('welcome', async () => {
    const c = S.counts || {};
    sitePage(`
      <section class="hero-land">
        <div class="site-wrap hero-grid">
          <div>
            <span class="pill" style="background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.25);color:#fff">🇧🇩 Built for Gen-Z · Free forever</span>
            <h1>Connect. Build.<br>Play. Grow.</h1>
            <p class="lede">One social platform for the things Gen-Z actually cares about — starting a business, learning skills, finding collaborators, and gaming with a real squad.</p>
            <div class="row wrap" style="gap:10px;margin-top:20px">
              <a class="btn btn-accent" href="#/auth?mode=signup">Create your free account</a>
              <a class="btn btn-ghost" style="color:#fff;border-color:rgba(255,255,255,.4)" href="#/auth">I already have an account</a>
            </div>
            <div class="row wrap stats-row">
              <div><b>${G.num(c.users || 0)}</b><span>members</span></div>
              <div><b>${G.num(c.posts || 0)}</b><span>posts</span></div>
              <div><b>${G.num(c.communities || 0)}</b><span>communities</span></div>
              <div><b>2</b><span>specialised hubs</span></div>
            </div>
          </div>
          <div class="hero-mock" aria-hidden="true">
            <div class="mock-card">
              <div class="row"><div class="mock-av"></div><div><div class="mock-line w120"></div><div class="mock-line w70 dim"></div></div></div>
              <div class="mock-line w100p" style="margin-top:14px"></div><div class="mock-line w80p"></div>
              <div class="mock-media"></div>
              <div class="row" style="gap:14px;margin-top:12px"><span class="mock-chip">👍 42</span><span class="mock-chip">💬 12</span><span class="mock-chip">🔁 5</span></div>
            </div>
            <div class="mock-card small-card">
              <b class="small">🔥 Trending</b>
              <div class="small muted">#startups · #esports · #freelancing</div>
            </div>
            <div class="mock-card small-card two">
              <b class="small">🤝 Looking for a co-founder</b>
              <div class="small muted">Business Hub · collaboration</div>
            </div>
          </div>
        </div>
      </section>

      <section class="site-wrap section">
        <h2 class="sec-title">Everything a modern social platform should do</h2>
        <p class="sec-sub">No marketplace. No AI gimmicks. Just real people, real communities and features that work.</p>
        <div class="feature-grid">
          ${[['📝', 'Posts that fit your life', 'Text, photo carousels, videos, links, hashtags and mentions — with public, connections-only or private visibility.'],
             ['💬', 'Private messaging', 'One-to-one chats with attachments, emoji, unread counts and read receipts. Only you and the recipient can access them.'],
             ['✨', 'Stories', '24-hour photo and video stories with a full-screen viewer, progress bars and a viewer list for the owner.'],
             ['👥', 'Groups with real roles', 'Public or approval-based private groups with owners, admins, moderators, rules and their own feed.'],
             ['🌐', 'Topic communities', 'Entrepreneurs, freelancers, developers, mobile gamers, esports players, football fans — join and post instantly.'],
             ['📅', 'Events', 'Meetups, workshops, scrims and tournaments with Going / Interested RSVPs and in-platform sharing.'],
             ['🔔', 'Notifications that matter', 'Reactions, comments, replies, mentions, follows, requests and group activity — each type toggleable.'],
             ['🛡️', 'Safety first', 'Report posts, comments, users, groups and communities. Block anyone. A moderation team reviews every report.']]
            .map(([i, t, d]) => `<div class="feature"><div class="fi-big">${i}</div><b>${t}</b><p class="small muted">${d}</p></div>`).join('')}
        </div>
      </section>

      <section class="site-wrap section" id="business">
        <div class="split">
          <div class="split-art biz-art">
            <div class="art-badge">💼 BUSINESS HUB</div>
            <ul class="art-list">
              <li>Business feed with topic filters</li><li>Collaboration board</li><li>Founder & freelancer communities</li>
              <li>Business events</li><li>My Network with connection requests</li>
            </ul>
          </div>
          <div>
            <h2 class="sec-title left">Business Hub — build, don't sell</h2>
            <p class="muted">A dedicated ecosystem for entrepreneurship, startups, freelancing, e-commerce, marketing, sales and investing education. Post your ideas, share what is working, and find people to build with.</p>
            <p class="muted">The collaboration board is for <b>looking for a co-founder, a developer, a designer or a team</b> — networking, not a marketplace. Nothing is bought or sold on Gen-Z Hub.</p>
            <div class="row wrap" style="gap:7px;margin-top:14px">${['Startups', 'Freelancing', 'Marketing', 'E-commerce', 'Technology', 'Business Ideas', 'Networking'].map((t) => `<span class="chip static">${t}</span>`).join('')}</div>
          </div>
        </div>
      </section>

      <section class="site-wrap section" id="gaming">
        <div class="split reverse">
          <div>
            <h2 class="sec-title left">Gaming Hub — find your squad</h2>
            <p class="muted">Mobile, PC and console. Post clips, discuss patches, join gaming communities and set your favourite games, platform and gamer tag on your profile.</p>
            <p class="muted">The Teams board is for <b>teammate finding, practice sessions and tournament participation</b>. It is a social feature — no betting, no gambling.</p>
            <div class="row wrap" style="gap:7px;margin-top:14px">${['Esports', 'Mobile Gaming', 'PC Gaming', 'Console Gaming', 'Tournaments', 'Teams'].map((t) => `<span class="chip static">${t}</span>`).join('')}</div>
          </div>
          <div class="split-art game-art">
            <div class="art-badge">🎮 GAMING HUB</div>
            <ul class="art-list">
              <li>Gaming feed with game categories</li><li>Team recruitment board</li><li>Discover gamers by platform</li>
              <li>Scrims & tournament events</li><li>Gaming profile fields</li>
            </ul>
          </div>
        </div>
      </section>

      <section class="site-wrap section">
        <h2 class="sec-title">Get started in three steps</h2>
        <div class="steps">
          ${[['1', 'Create your account', 'Name, username, email, password and date of birth. You must be 13 or older.'],
             ['2', 'Pick interests & hubs', 'Choose what you are into, then join Business Hub, Gaming Hub, both, or stay general.'],
             ['3', 'Post, join, connect', 'Follow people, join communities and groups, publish your first post and start chatting.']]
            .map(([n, t, d]) => `<div class="step"><span class="step-n">${n}</span><b>${t}</b><p class="small muted">${d}</p></div>`).join('')}
        </div>
        <div class="cta">
          <div><h3 style="margin:0 0 4px">Ready to join Gen-Z Hub?</h3>
            <p class="small" style="margin:0;opacity:.85">Free forever. Light and dark mode. English and বাংলা.</p></div>
          <a class="btn btn-accent" href="#/auth?mode=signup">Create account</a>
        </div>
      </section>`);
  });

  /* ---------------- static pages ---------------- */
  const PAGES = {
    about: ['About Gen-Z Hub', `
      <p class="lede-dark">Gen-Z Hub is an original social platform built for young people who are doing two things at once: building something real, and having fun doing it.</p>
      <h3>Why we exist</h3>
      <p>Most social platforms make you choose an identity. Business networks feel formal and old. Gaming spaces are fragmented across a dozen chat servers. General social feeds are noise. Gen-Z Hub keeps one profile, one feed and one messaging inbox — with two specialised ecosystems inside it: <b>Business Hub</b> and <b>Gaming Hub</b>.</p>
      <h3>What we do not do</h3>
      <ul><li>No marketplace, product listings or buying and selling.</li>
        <li>No AI chatbot, AI assistant or AI content generator — everything you read here is written by people.</li>
        <li>No betting or gambling features in Gaming Hub.</li>
        <li>No copying another company's branding or interface. Gen-Z Hub is its own design system.</li></ul>
      <h3>How it is built</h3>
      <p>A Node.js and Express backend with a relational database, server-side authorisation on every action, bcrypt password hashing, session cookies, rate limiting and file-upload validation. The interface is a lightweight single-page app that works on phones, tablets, laptops and desktops with light and dark themes.</p>
      <h3>Who it is for</h3>
      <p>Students, first-time founders, freelancers, developers, designers, marketers, content creators, mobile and PC gamers, and esports players — anyone from Gen-Z who wants to connect, build, play and grow.</p>`],

    privacy: ['Privacy policy', `
      <p class="small muted">Last updated: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      <h3>What we collect</h3>
      <ul><li><b>Account data:</b> full name, username, email address, date of birth and password (stored only as a bcrypt hash — never in plain text).</li>
        <li><b>Profile data:</b> anything you choose to add — bio, location, interests, avatar, cover image, business role, gaming details.</li>
        <li><b>Content:</b> posts, comments, stories, messages, events, groups and communities you create or join.</li>
        <li><b>Technical data:</b> a session cookie, timestamps and last-seen time used to keep you signed in and show activity.</li></ul>
      <h3>What we never do</h3>
      <ul><li>We never store or display your password. Administrators cannot see it.</li>
        <li>We do not sell your data or run third-party advertising trackers.</li>
        <li>We do not read your private messages except where required to act on an abuse report.</li></ul>
      <h3>Your controls</h3>
      <ul><li><b>Profile visibility:</b> public or connections-only.</li><li><b>Post privacy:</b> public, connections or private, per post.</li>
        <li><b>Notifications:</b> per-type on/off switches.</li><li><b>Blocking:</b> block any account to cut off interaction.</li>
        <li><b>Deletion:</b> delete your account from Settings → Account. This permanently removes your profile, posts, comments, messages, memberships and uploads.</li></ul>
      <h3>Cookies</h3>
      <p>We use a single essential cookie (<code>gz_session</code>) to keep you signed in. It is httpOnly, SameSite-protected and expires automatically. No advertising or analytics cookies are used.</p>
      <h3>Age requirement</h3>
      <p>You must be at least 13 years old to create an account. Accounts found to belong to younger users are removed.</p>`],

    terms: ['Terms of use', `
      <h3>1. Your account</h3>
      <p>You must be 13 or older, provide accurate information and keep your password secure. One person, one account. You are responsible for activity under your account.</p>
      <h3>2. Your content</h3>
      <p>You keep ownership of everything you post. By posting, you allow Gen-Z Hub to display and distribute that content inside the platform according to the privacy setting you chose.</p>
      <h3>3. Acceptable use</h3>
      <p>Do not post illegal content, harassment, hate speech, sexual content involving minors, spam, scams, malware, impersonation or content that violates someone else's rights. Do not attempt to break, overload or gain unauthorised access to the platform.</p>
      <h3>4. No marketplace, no gambling</h3>
      <p>Gen-Z Hub is not a marketplace. Do not use it to sell products, run paid listings, or operate betting or gambling activities.</p>
      <h3>5. Moderation</h3>
      <p>Reported content is reviewed by moderators. We may hide or delete content, restrict features, suspend or remove accounts that break these terms. Serious or repeated violations lead to permanent removal.</p>
      <h3>6. Availability</h3>
      <p>The service is provided as-is. We work to keep it available and secure but cannot guarantee uninterrupted service or that content posted by others is accurate.</p>
      <h3>7. Ending your use</h3>
      <p>You can delete your account at any time from Settings. We may terminate accounts that violate these terms.</p>`],

    guidelines: ['Community guidelines', `
      <p class="lede-dark">Gen-Z Hub only works if it stays useful and safe. These are the rules everyone agrees to.</p>
      <h3>Be real</h3><p>Use your real identity or a consistent handle. Do not impersonate other people, brands or organisations.</p>
      <h3>Be useful</h3><p>Share what you learned, what worked and what failed. In Business Hub, specifics beat motivational quotes. In Gaming Hub, help new players instead of flaming them.</p>
      <h3>Zero tolerance</h3>
      <ul><li>Harassment, bullying, threats or targeted hate.</li><li>Sexual content involving minors — reported to authorities immediately.</li>
        <li>Scams, fake investment schemes, "guaranteed returns" and financial fraud.</li><li>Spam, mass DMs and engagement farming.</li>
        <li>Selling products or services (this is not a marketplace) and any betting or gambling.</li></ul>
      <h3>Reporting</h3>
      <p>Every post, comment, user, group and community has a report action. Choose a category — spam, harassment, impersonation, inappropriate content or other — and add details. Reports go to a moderation queue where admins can remove content, suspend accounts or dismiss the report.</p>
      <h3>Blocking</h3>
      <p>Blocking is immediate and mutual: blocked accounts disappear from your feed and search, cannot message you, and any existing follows or connections are removed.</p>
      <h3>Appeals</h3>
      <p>If your content was removed and you believe it was a mistake, contact the team through the Contact page with the details.</p>`],

    contact: ['Contact', `
      <p class="lede-dark">Questions, bug reports, safety concerns or partnership ideas — reach the team here.</p>
      <div class="grid-cards" style="margin:18px 0">
        <div class="card pad"><b>🛟 Support</b><p class="small muted">Account, login or feature problems.</p><span class="link">support@genzhub.app</span></div>
        <div class="card pad"><b>🛡️ Safety & moderation</b><p class="small muted">Urgent abuse reports and appeals.</p><span class="link">safety@genzhub.app</span></div>
        <div class="card pad"><b>🤝 Partnerships</b><p class="small muted">Communities, events and collaborations.</p><span class="link">hello@genzhub.app</span></div>
      </div>
      <h3>Send a message</h3>
      <form id="contact-form" class="card pad stack" style="max-width:560px">
        <div><label class="label" for="cf-n">Your name</label><input class="input" id="cf-n" required></div>
        <div><label class="label" for="cf-e">Email</label><input class="input" id="cf-e" type="email" required></div>
        <div><label class="label" for="cf-t">Topic</label><select class="select" id="cf-t"><option>Support</option><option>Safety report</option><option>Feedback</option><option>Partnership</option></select></div>
        <div><label class="label" for="cf-m">Message</label><textarea class="textarea" id="cf-m" required maxlength="1200"></textarea></div>
        <button class="btn btn-primary">Send message</button>
        <p class="tiny muted" id="cf-note">This demo deployment has no mail server configured, so messages are not delivered — use the addresses above.</p>
      </form>`],
  };

  Object.keys(PAGES).forEach((key) => {
    G.route(key, async () => {
      const [title, body] = PAGES[key];
      sitePage(`<section class="site-wrap section page-body"><h1 class="page-title">${esc(title)}</h1>${body}</section>`);
      const f = G.qs('#contact-form');
      if (f) f.onsubmit = (e) => {
        e.preventDefault();
        G.toast('Thanks! In this deployment, please email the address listed above.', 'ok');
      };
    });
  });
})();
