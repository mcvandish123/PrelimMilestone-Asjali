// Start each feature after the page HTML has loaded.
document.addEventListener('DOMContentLoaded', function () {
  initNavigation();
  initProjectsGallery();
});

function initNavigation() {
  const navToggle = document.getElementById('nav-toggle');
  const navMenu = document.getElementById('nav-menu');

  if (navToggle && navMenu) {
    navToggle.addEventListener('click', function () {
      const isExpanded = navToggle.getAttribute('aria-expanded') === 'true';
      navToggle.setAttribute('aria-expanded', !isExpanded);
      navMenu.classList.toggle('active');
    });
  }

  // Active navigation link highlighting
  const currentPath = window.location.pathname.split('/').pop() || 'home.html';
  const navLinks = document.querySelectorAll('.nav-link');
  
  navLinks.forEach(function (link) {
    const href = link.getAttribute('href');
    const isHomePage = currentPath === '' || currentPath === 'index.html';
    if (href === currentPath || (isHomePage && href === 'home.html')) {
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
    } else {
      link.classList.remove('active');
      link.removeAttribute('aria-current');
    }
  });
}

let allRepositories = [];

const MOCK_GITHUB_REPOS = [
  {
    name: 'CollabSpace',
    description: 'Co-working space website.',
    language: 'Vue',
    stargazers_count: 4,
    forks_count: 1,
    updated_at: '2026-08-22T10:15:00Z',
    html_url: 'https://github.com/mcvandish123/CollabSpace'
  },
  {
    name: 'TechTix',
    description: 'The official event platform of UP Mindanao SPARCS. (Forked from mcvandish123675/TechTix)',
    language: 'TypeScript',
    stargazers_count: 2,
    forks_count: 0,
    updated_at: '2026-08-05T16:40:00Z',
    html_url: 'https://github.com/mcvandish123/TechTix'
  },
  {
    name: 'Youtube-Algorithm-Counterpart',
    description: 'No description provided for this repository.',
    language: 'HTML',
    stargazers_count: 1,
    forks_count: 0,
    updated_at: '2026-07-18T09:05:00Z',
    html_url: 'https://github.com/mcvandish123/Youtube-Algorithm-Counterpart'
  },
  {
    name: 'Gamified-Offline-First-AI-Tutoring-Application',
    description: 'An application for the sake of education + gamification of a project.',
    language: 'TypeScript',
    stargazers_count: 3,
    forks_count: 0,
    updated_at: '2026-07-02T13:25:00Z',
    html_url: 'https://github.com/mcvandish123/Gamified-Offline-First-AI-Tutoring-Application'
  },
  {
    name: 'amazon-project',
    description: 'An Amazon project counterpart built with HTML/CSS and JavaScript, with some small backend JavaScript added to enhance interactivity.',
    language: 'JavaScript',
    stargazers_count: 2,
    forks_count: 0,
    updated_at: '2026-06-14T08:50:00Z',
    html_url: 'https://github.com/mcvandish123/amazon-project'
  }
];

const BOOKMARKS_STORAGE_KEY = 'bookmarkedRepos';

function getBookmarkedRepoUrls() {
  try {
    const raw = localStorage.getItem(BOOKMARKS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch (e) {
    // localStorage unavailable (e.g. private browsing) — fall back to an
    // empty, non-persistent bookmark set for this session.
    return new Set();
  }
}

function saveBookmarkedRepoUrls(urlSet) {
  try {
    localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(Array.from(urlSet)));
  } catch (e) {
    // Ignore write failures (storage disabled/full) — bookmark UI still
    // updates for the current session even if it can't persist.
  }
}

function isRepoBookmarked(repoUrl) {
  return getBookmarkedRepoUrls().has(repoUrl);
}

/**
 * Toggles the bookmark state for a repo (identified by its html_url) and
 * persists the change. Returns the new bookmarked state (true/false).
 */
function toggleRepoBookmark(repoUrl) {
  const bookmarks = getBookmarkedRepoUrls();
  let nowBookmarked;

  if (bookmarks.has(repoUrl)) {
    bookmarks.delete(repoUrl);
    nowBookmarked = false;
  } else {
    bookmarks.add(repoUrl);
    nowBookmarked = true;
  }

  saveBookmarkedRepoUrls(bookmarks);
  return nowBookmarked;
}

function initProjectsGallery() {
  const projectsGrid = document.getElementById('projects-grid');
  const searchInput = document.getElementById('search-input');
  const bookmarksOnlyToggle = document.getElementById('bookmarks-only-toggle');
  const spinnerContainer = document.getElementById('spinner-container');
  const errorContainer = document.getElementById('error-container');

  // Guard clause if not on the projects page
  if (!projectsGrid) return;

  const lockedUsername = 'mcvandish123';

  fetchGitHubRepos(lockedUsername);

  // W3 Requirement: Search projects by name (partial search) using JS DOM manipulation
  if (searchInput) {
    searchInput.addEventListener('input', function (e) {
      const query = e.target.value.toLowerCase().trim();
      filterAndRenderProjects(query);
    });
  }

  // Show Bookmarks Only toggle — re-filters using whatever search query is
  // currently active, so both filters combine naturally.
  if (bookmarksOnlyToggle) {
    bookmarksOnlyToggle.addEventListener('change', function () {
      const currentQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';
      filterAndRenderProjects(currentQuery);
    });
  }

  async function fetchGitHubRepos(username) {
    showSpinner(true);
    hideError();
    clearProjectsGrid();

    try {
      let data;

      try {
        // ----------------------------------------------------------------
        // REAL GITHUB API CALL (active)
        // ----------------------------------------------------------------
        const response = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=30`);

        if (!response.ok) {
          if (response.status === 403) {
            // Flag this error so the fallback logic below knows to use
            // mock data instead of showing it to the user as a failure.
            const rateLimitError = new Error('GitHub API rate limit exceeded.');
            rateLimitError.isRateLimit = true;
            throw rateLimitError;
          } else if (response.status === 404) {
            throw new Error(`GitHub user "${username}" was not found. Please verify the username.`);
          } else {
            throw new Error(`HTTP Error ${response.status}: Unable to retrieve repositories at this time.`);
          }
        }

        data = await response.json();

        if (!Array.isArray(data)) {
          throw new Error('Invalid data payload received from GitHub API.');
        }
      } catch (apiError) {
        if (apiError.isRateLimit) {
          console.warn('GitHub API rate limit reached — falling back to mock data.');
          displayError('GitHub API rate limit reached. Showing sample data instead.');
          data = await new Promise(function (resolve) {
            setTimeout(function () {
              resolve(MOCK_GITHUB_REPOS);
            }, 300);
          });
        } else {
          // Not a rate-limit issue — let the outer catch handle it normally.
          throw apiError;
        }
      }

      if (data.length === 0) {
        displayMessage(`User "${username}" has no public GitHub repositories yet.`);
        allRepositories = [];
        return;
      }

      // Save repositories for live search filtering
      allRepositories = data;

      // Render cards with optional existing search query
      const currentQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';
      filterAndRenderProjects(currentQuery);

    } catch (error) {
      // W4 Requirement: Graceful error handling (try/catch + user-friendly message)
      displayError(error.message || 'An unexpected error occurred while connecting to the GitHub API.');
    } finally {
      // Hide loading spinner
      showSpinner(false);
    }
  }

  /**
   * W3 Requirement: Filter projects by partial name match using JS DOM manipulation.
   * Also applies the "Show Bookmarks Only" toggle, if checked.
   */
  function filterAndRenderProjects(query) {
    clearProjectsGrid();

    const bookmarksOnly = bookmarksOnlyToggle ? bookmarksOnlyToggle.checked : false;

    const filtered = allRepositories.filter(function (repo) {
      const nameMatch = repo.name ? repo.name.toLowerCase().includes(query) : false;
      const descMatch = repo.description ? repo.description.toLowerCase().includes(query) : false;
      const langMatch = repo.language ? repo.language.toLowerCase().includes(query) : false;
      const matchesQuery = nameMatch || descMatch || langMatch;
      const matchesBookmark = bookmarksOnly ? isRepoBookmarked(repo.html_url) : true;
      return matchesQuery && matchesBookmark;
    });

    if (filtered.length === 0) {
      if (bookmarksOnly) {
        displayMessage(query ? `No bookmarked repositories matching "${query}" were found.` : 'No bookmarked repositories yet. Click "Bookmark" on a project to save it here.');
      } else {
        displayMessage(query ? `No repositories matching "${query}" were found.` : 'No repositories available.');
      }
      return;
    }

    // Dynamically create project cards using safe DOM methods
    filtered.forEach(function (repo) {
      const card = createProjectCardDOM(repo);
      projectsGrid.appendChild(card);
    });
  }

  /**
   * Safe DOM Card Creation (W3: Dynamically create project cards — no hardcoded HTML)
   * Avoids innerHTML to enforce security standards
   */
  function createProjectCardDOM(repo) {
    const article = document.createElement('article');
    article.className = 'project-card';

    // Header container
    const header = document.createElement('div');
    header.className = 'project-header';

    const title = document.createElement('h3');
    title.className = 'project-title';
    title.textContent = repo.name;

    const badge = document.createElement('span');
    badge.className = 'project-badge';
    badge.textContent = repo.language || 'General';

    header.appendChild(title);
    header.appendChild(badge);

    // Description
    const desc = document.createElement('p');
    desc.className = 'project-desc';
    desc.textContent = repo.description || 'No description provided for this repository.';

    // Meta (stars, forks, updated date)
    const meta = document.createElement('div');
    meta.className = 'project-meta';

    const stars = document.createElement('span');
    stars.textContent = `★ ${repo.stargazers_count || 0}`;

    const forks = document.createElement('span');
    forks.textContent = `⑂ ${repo.forks_count || 0}`;

    const updated = document.createElement('span');
    const updateDate = repo.updated_at ? new Date(repo.updated_at).toLocaleDateString() : 'N/A';
    updated.textContent = `Updated: ${updateDate}`;

    meta.appendChild(stars);
    meta.appendChild(forks);
    meta.appendChild(updated);

    // Repository Link
    const link = document.createElement('a');
    link.className = 'project-link';
    link.href = repo.html_url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'View on GitHub →';
    link.setAttribute('aria-label', `View ${repo.name} repository on GitHub`);

    const bookmarkBtn = document.createElement('button');
    bookmarkBtn.type = 'button';
    bookmarkBtn.className = 'project-bookmark-btn';
    const bookmarked = isRepoBookmarked(repo.html_url);
    bookmarkBtn.classList.toggle('bookmarked', bookmarked);
    bookmarkBtn.setAttribute('aria-pressed', String(bookmarked));
    bookmarkBtn.setAttribute('aria-label', `${bookmarked ? 'Remove bookmark from' : 'Bookmark'} ${repo.name}`);
    bookmarkBtn.textContent = bookmarked ? '★ Bookmarked' : '☆ Bookmark';

    bookmarkBtn.addEventListener('click', function (e) {
      e.preventDefault();
      const nowBookmarked = toggleRepoBookmark(repo.html_url);
      bookmarkBtn.classList.toggle('bookmarked', nowBookmarked);
      bookmarkBtn.setAttribute('aria-pressed', String(nowBookmarked));
      bookmarkBtn.setAttribute('aria-label', `${nowBookmarked ? 'Remove bookmark from' : 'Bookmark'} ${repo.name}`);
      bookmarkBtn.textContent = nowBookmarked ? '★ Bookmarked' : '☆ Bookmark';

      // If "Show Bookmarks Only" is active, re-filter immediately so an
      // unbookmarked repo's card disappears from view right away.
      if (bookmarksOnlyToggle && bookmarksOnlyToggle.checked) {
        const currentQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';
        filterAndRenderProjects(currentQuery);
      }
    });

    // Actions row groups the GitHub link and the bookmark toggle together
    const actions = document.createElement('div');
    actions.className = 'project-actions';
    actions.appendChild(link);
    actions.appendChild(bookmarkBtn);

    // Assemble components
    article.appendChild(header);
    article.appendChild(desc);
    article.appendChild(meta);
    article.appendChild(actions);

    return article;
  }

  function clearProjectsGrid() {
    if (projectsGrid) {
      projectsGrid.textContent = '';
    }
  }

  function showSpinner(visible) {
    if (spinnerContainer) {
      if (visible) {
        spinnerContainer.classList.add('visible');
      } else {
        spinnerContainer.classList.remove('visible');
      }
    }
  }

  function displayError(message) {
    if (errorContainer) {
      errorContainer.textContent = '';
      const p = document.createElement('p');
      p.textContent = message;
      errorContainer.appendChild(p);
      errorContainer.classList.add('visible');
    }
  }

  function hideError() {
    if (errorContainer) {
      errorContainer.classList.remove('visible');
    }
  }

  function displayMessage(msg) {
    clearProjectsGrid();
    const div = document.createElement('div');
    div.className = 'message-container';
    div.textContent = msg;
    projectsGrid.appendChild(div);
  }
}