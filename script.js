// API Configuration
let BASE_API_URL = '';
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    BASE_API_URL = 'http://' + window.location.hostname + ':5000';
} else {
    // Production on Vercel
    BASE_API_URL = window.location.origin;
}
console.log("API Configured at:", BASE_API_URL || "Production (Relative)");

// Application State
let state = {
    currentSubject: "Mathematics",
    currentChapter: "Real Numbers",
    savedQuestions: parseStoredArray('pyq_saved'),
    searchQuery: "",
    yearFilter: "All",
    viewMode: "browse", // 'browse', 'saved', 'affiliates', or 'contact'
    isAdminMode: false,
    currentUser: JSON.parse(localStorage.getItem('pyq_user')) || null,
    affiliateData: [],
    authMode: 'login', // 'login' or 'signup'
    hasAccess: false,
    accessUntil: null
};
let eventListenersReady = false;
let adminListenersReady = false;

// DOM Elements
const elements = {
    subjectList: document.getElementById('subject-list'),
    chapterList: document.getElementById('chapter-list'),
    savedTab: document.getElementById('saved-tab'),
    affiliatesTab: document.getElementById('affiliates-tab'),
    contactTab: document.getElementById('contact-tab'),
    adminTab: document.getElementById('admin-tab'),
    uploadTab: document.getElementById('upload-tab'),
    uploadAffiliateTab: document.getElementById('upload-affiliate-tab'),
    savedCount: document.getElementById('saved-count'),
    searchInput: document.getElementById('search-input'),
    yearFilter: document.getElementById('year-filter'),
    questionsContainer: document.getElementById('questions-container'),
    viewTitle: document.getElementById('current-view-title'),

    // Modals
    adminLoginModal: document.getElementById('admin-login-modal'),
    adminDashboardModal: document.getElementById('admin-dashboard-modal'),
    uploadAffiliateModal: document.getElementById('upload-affiliate-modal'),
    closeLoginModalBtn: document.getElementById('close-login-modal'),
    closeDashboardModalBtn: document.getElementById('close-dashboard-modal'),
    closeAffiliateModalBtn: document.getElementById('close-affiliate-modal'),
    adminUsernameInput: document.getElementById('admin-username'),
    adminPasswordInput: document.getElementById('admin-password'),
    btnAdminLogin: document.getElementById('btn-admin-login'),
    loginError: document.getElementById('login-error'),
    uploadQuestionForm: document.getElementById('upload-question-form'),
    uploadAffiliateForm: document.getElementById('upload-affiliate-form'),
    menuToggle: document.getElementById('menu-toggle'),
    sidebar: document.querySelector('.sidebar'),
    sidebarOverlay: document.getElementById('sidebar-overlay'),
    sidebarClose: document.getElementById('sidebar-close'),

    // User Auth Elements
    userTab: document.getElementById('user-tab'),
    userTabText: document.getElementById('user-tab-text'),
    userAuthModal: document.getElementById('user-auth-modal'),
    closeAuthModalBtn: document.getElementById('close-auth-modal'),
    authToggleLogin: document.getElementById('toggle-login'),
    authToggleSignup: document.getElementById('toggle-signup'),
    authModalTitle: document.getElementById('auth-modal-title'),
    userAuthForm: document.getElementById('user-auth-form'),
    btnAuthSubmit: document.getElementById('btn-auth-submit'),
    authError: document.getElementById('auth-error'),
    authSuccess: document.getElementById('auth-success'),
    authUsername: document.getElementById('auth-username'),
    toastContainer: document.getElementById('toast-container'),
    btnToggleFooter: document.getElementById('btn-toggle-footer'),
    footerExpandContainer: document.getElementById('footer-expand-container'),

    // Access System Elements
    accessDeniedOverlay: document.getElementById('access-denied-overlay'),
    accessKeyModal: document.getElementById('access-key-modal'),
    closeAccessModalBtn: document.getElementById('close-access-modal'),
    btnShowKeyModal: document.getElementById('btn-show-key-modal'),
    accessKeyForm: document.getElementById('access-key-form'),
    accessKeyError: document.getElementById('access-key-error'),
    accessStatusTab: document.getElementById('access-status-tab'),
    accessExpiryText: document.getElementById('access-expiry-text'),
    btnClaimFreeAccess: document.getElementById('btn-claim-free-access')
};

// Application Data (Merge static data with backend data)
let appData = [...pyqData];
const API_URL = '/api/questions';

function parseStoredArray(key) {
    try {
        const parsed = JSON.parse(localStorage.getItem(key));
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatText(value) {
    return escapeHtml(value)
        .replace(/&lt;br\s*\/?&gt;/gi, '<br>')
        .replace(/\r?\n/g, '<br>');
}

function safeUrl(value, fallback = '#') {
    try {
        const url = new URL(String(value ?? ''), window.location.origin);
        if (url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:') {
            return escapeHtml(url.href);
        }
    } catch (error) {
        return fallback;
    }

    return fallback;
}

function safeImageSrc(value) {
    const src = String(value ?? '');
    if (src.startsWith('data:image/')) {
        return escapeHtml(src);
    }

    return safeUrl(src, '');
}

// Initialize the application
async function init() {
    renderSkeletons();
    
    if (!state.currentUser) {
        // Force login if not logged in
        elements.userAuthModal.classList.add('active');
        // Hide close button on login modal when forced
        elements.closeAuthModalBtn.style.display = 'none';
        updateAccessUI(); // Ensure content is locked
        return;
    }

    if (state.currentUser) {
        elements.closeAuthModalBtn.style.display = 'flex'; // Restore if logged in
        await checkAccessStatus();
    }
    try {
        // Fetch questions from our backend
        const response = await fetch(`${BASE_API_URL}/api/questions`);
        if (response.ok) {
            const backendData = await response.json();
            appData = [...pyqData, ...backendData];

            // Ensure any new chapters from backend are added to subjectsMap
            backendData.forEach(q => {
                if (subjectsMap[q.subject] && !subjectsMap[q.subject].includes(q.chapter)) {
                    subjectsMap[q.subject].push(q.chapter);
                }
            });
            renderChapters();
            renderQuestions();
        }
    } catch (error) {
        console.warn("Backend not running or reachable. Falling back to local/static data.", error);
        const customData = parseStoredArray('pyq_custom_data');
        appData = [...pyqData, ...customData];
    }

    try {
        const affResponse = await fetch(`${BASE_API_URL}/api/affiliates`);
        if (affResponse.ok) {
            state.affiliateData = await affResponse.json();
        }
    } catch (err) {
        console.warn("Could not fetch affiliates.");
    }

    updateSavedCount();
    renderChapters();
    renderQuestions();
}

// Event Listeners
function setupEventListeners() {
    if (eventListenersReady) return;
    eventListenersReady = true;

    // Subject Selection
    elements.subjectList.addEventListener('click', (e) => {
        const li = e.target.closest('li');
        if (!li) return;

        // Remove active class from all subjects and saved tab
        Array.from(elements.subjectList.children).forEach(child => child.classList.remove('active'));
        elements.savedTab.classList.remove('active');
        elements.affiliatesTab.classList.remove('active');
        elements.contactTab.classList.remove('active');

        li.classList.add('active');
        state.currentSubject = li.dataset.subject;
        state.currentChapter = subjectsMap[state.currentSubject][0]; // default to first chapter
        state.viewMode = 'browse';

        renderChapters();
        renderQuestions();
    });

    // Chapter Selection
    elements.chapterList.addEventListener('click', (e) => {
        const li = e.target.closest('li');
        if (!li) return;

        Array.from(elements.chapterList.children).forEach(child => child.classList.remove('active'));
        li.classList.add('active');

        state.currentChapter = li.dataset.chapter;
        renderQuestions();
    });

    // Saved Tab
    elements.savedTab.addEventListener('click', () => {
        state.viewMode = 'saved';
        elements.savedTab.classList.add('active');
        elements.affiliatesTab.classList.remove('active');
        elements.contactTab.classList.remove('active');
        Array.from(elements.subjectList.children).forEach(child => child.classList.remove('active'));
        renderQuestions();
    });

    elements.affiliatesTab.addEventListener('click', () => {
        state.viewMode = 'affiliates';
        elements.affiliatesTab.classList.add('active');
        elements.savedTab.classList.remove('active');
        elements.contactTab.classList.remove('active');
        Array.from(elements.subjectList.children).forEach(child => child.classList.remove('active'));
        renderQuestions();
    });

    elements.contactTab.addEventListener('click', () => {
        state.viewMode = 'contact';
        elements.contactTab.classList.add('active');
        elements.savedTab.classList.remove('active');
        elements.affiliatesTab.classList.remove('active');
        Array.from(elements.subjectList.children).forEach(child => child.classList.remove('active'));
        renderQuestions();
    });

    // Search Input
    elements.searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.toLowerCase();
        renderQuestions();
    });

    // Year Filter
    elements.yearFilter.addEventListener('change', (e) => {
        state.yearFilter = e.target.value;
        renderQuestions();
    });

    // Questions Container (Delegation for Save and Solution toggle)
    elements.questionsContainer.addEventListener('click', (e) => {
        // Toggle Solution
        const toggleBtn = e.target.closest('.btn-toggle-solution');
        if (toggleBtn) {
            const solutionContent = toggleBtn.nextElementSibling;
            const icon = toggleBtn.querySelector('i');
            solutionContent.classList.toggle('show');
            if (solutionContent.classList.contains('show')) {
                icon.classList.replace('ri-eye-line', 'ri-eye-off-line');
                toggleBtn.innerHTML = '<i class="ri-eye-off-line"></i> Hide Solution';
            } else {
                icon.classList.replace('ri-eye-off-line', 'ri-eye-line');
                toggleBtn.innerHTML = '<i class="ri-eye-line"></i> View Solution';
            }
        }

        // Save Button
        const saveBtn = e.target.closest('.btn-save');
        if (saveBtn) {
            const questionId = saveBtn.dataset.id;
            toggleSave(questionId);

            if (state.viewMode === 'saved') {
                renderQuestions();
            } else {
                const isSaved = state.savedQuestions.includes(questionId);
                if (isSaved) {
                    saveBtn.classList.add('saved');
                    saveBtn.innerHTML = '<i class="ri-bookmark-3-fill"></i>';
                } else {
                    saveBtn.classList.remove('saved');
                    saveBtn.innerHTML = '<i class="ri-bookmark-3-line"></i>';
                }
            }
        }

        // Delete Button
        const deleteBtn = e.target.closest('.btn-delete');
        if (deleteBtn) {
            const questionId = deleteBtn.dataset.id;
            const affiliateId = deleteBtn.dataset.affiliateid;

            if (affiliateId) {
                showConfirm("Are you sure you want to delete this affiliate link?", () => deleteAffiliate(affiliateId));
            } else if (questionId) {
                showConfirm("Are you sure you want to delete this question?", () => deleteQuestion(questionId));
            }
        }
    });
}

function showToast(message, type = 'info') {
    if (!elements.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const iconMap = {
        'success': 'ri-checkbox-circle-line',
        'error': 'ri-error-warning-line',
        'info': 'ri-information-line'
    };

    toast.innerHTML = `
        <i class="${iconMap[type] || iconMap.info}"></i>
        <span>${escapeHtml(message)}</span>
    `;

    elements.toastContainer.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 100);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

function showConfirm(message, onConfirm) {
    if (confirm(message)) {
        onConfirm();
    }
}

function setupSidebarToggle() {
    if (!elements.menuToggle) return;

    const toggleSidebar = () => {
        const isMobile = window.innerWidth <= 1024;
        if (isMobile) {
            elements.sidebar.classList.toggle('active');
            elements.sidebarOverlay.classList.toggle('active');
            document.body.classList.toggle('sidebar-open');
        } else {
            elements.sidebar.classList.toggle('collapsed');
        }
    };

    elements.menuToggle.addEventListener('click', toggleSidebar);

    elements.sidebarOverlay.addEventListener('click', () => {
        elements.sidebar.classList.remove('active');
        elements.sidebarOverlay.classList.remove('active');
        document.body.classList.remove('sidebar-open');
    });

    if (elements.sidebarClose) {
        elements.sidebarClose.addEventListener('click', () => {
            elements.sidebar.classList.remove('active');
            elements.sidebarOverlay.classList.remove('active');
            document.body.classList.remove('sidebar-open');
        });
    }

    if (elements.btnToggleFooter) {
        elements.btnToggleFooter.addEventListener('click', () => {
            elements.footerExpandContainer.classList.toggle('footer-visible');
            const isVisible = elements.footerExpandContainer.classList.contains('footer-visible');
            elements.btnToggleFooter.querySelector('span').textContent = isVisible ? 'Hide Site Info' : 'Show Site Info';
            elements.btnToggleFooter.querySelector('i').className = isVisible ? 'ri-arrow-up-s-line' : 'ri-information-line';
        });
    }

    // Access Key Listeners
    if (elements.btnShowKeyModal) {
        elements.btnShowKeyModal.addEventListener('click', () => {
            elements.accessKeyModal.classList.add('active');
        });
    }

    if (elements.closeAccessModalBtn) {
        elements.closeAccessModalBtn.addEventListener('click', () => {
            elements.accessKeyModal.classList.remove('active');
        });
    }

    if (elements.accessKeyForm) {
        elements.accessKeyForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const key = document.getElementById('access-key-input').value.trim();
            handleKeyActivation(key);
        });
    }

    // Close sidebar on menu item click (mobile)
    const navItems = elements.sidebar.querySelectorAll('li, .saved-tab, .admin-tab');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            if (window.innerWidth <= 1024) {
                elements.sidebar.classList.remove('active');
                elements.sidebarOverlay.classList.remove('active');
                document.body.classList.remove('sidebar-open');
            }
        });
    });
}


function renderChapters() {
    if (state.viewMode !== 'browse') {
        elements.chapterList.innerHTML = '';
        return;
    }

    const chapters = subjectsMap[state.currentSubject];
    elements.chapterList.innerHTML = chapters.map(chapter => `
        <li class="${chapter === state.currentChapter ? 'active' : ''}" data-chapter="${escapeHtml(chapter)}">
            <i class="ri-arrow-right-s-line"></i> ${escapeHtml(chapter)}
        </li>
    `).join('');
}

function renderQuestions() {
    elements.questionsContainer.innerHTML = '';
    elements.questionsContainer.classList.add('fade-in-up');
    setTimeout(() => elements.questionsContainer.classList.remove('fade-in-up'), 500);

    if (state.viewMode === 'admin-login') {
        renderAdminLoginPanel();
        return;
    }

    if (state.viewMode === 'contact') {
        elements.viewTitle.textContent = "Contact Me";
        document.getElementById('question-count-text').textContent = "Get in touch";
        const contactHtml = document.getElementById('contact-template').innerHTML;
        elements.questionsContainer.innerHTML = contactHtml;
        return;
    }

    if (state.viewMode === 'affiliates') {
        elements.viewTitle.textContent = "Recommended Resources";
        if (state.affiliateData.length === 0) {
            elements.questionsContainer.innerHTML = `
                <div class="empty-state">
                    <i class="ri-shopping-cart-2-line"></i>
                    <h3>No Resources Yet</h3>
                    <p>Check back later for recommended books and tools.</p>
                </div>
            `;
            return;
        }

        const grid = document.createElement('div');
        grid.className = 'affiliates-grid';

        const cardsHTML = state.affiliateData.map(aff => {
            const title = escapeHtml(aff.title);
            const imageSrc = safeImageSrc(aff.image);
            return `
                <div class="affiliate-card">
                    <div class="affiliate-header">
                        <div class="affiliate-title">${title}</div>
                        ${state.isAdminMode ? `
                        <button class="btn-delete" data-affiliateid="${escapeHtml(aff.id)}" title="Delete Affiliate">
                            <i class="ri-delete-bin-line"></i>
                        </button>
                        ` : ''}
                    </div>
                    <div class="affiliate-content">${formatText(aff.description)}</div>
                    ${imageSrc ? `<img src="${imageSrc}" class="affiliate-image" alt="${title}">` : ''}
                    <a href="${safeUrl(aff.url)}" target="_blank" rel="noopener noreferrer" class="btn-affiliate">Check it out <i class="ri-external-link-line"></i></a>
                </div>
            `;
        }).join('');

        grid.innerHTML = cardsHTML;
        elements.questionsContainer.appendChild(grid);
        return;
    }

    let filteredQuestions = appData;

    // Filter by mode
    if (state.viewMode === 'saved') {
        filteredQuestions = filteredQuestions.filter(q => state.savedQuestions.includes(q.id));
        elements.viewTitle.textContent = "Saved Questions";
    } else {
        filteredQuestions = filteredQuestions.filter(q =>
            q.subject === state.currentSubject &&
            q.chapter === state.currentChapter
        );
        elements.viewTitle.textContent = `${state.currentSubject} - ${state.currentChapter}`;
    }

    // Filter by year
    if (state.yearFilter !== "All") {
        filteredQuestions = filteredQuestions.filter(q => q.year === state.yearFilter);
    }

    // Filter by search
    if (state.searchQuery) {
        filteredQuestions = filteredQuestions.filter(q =>
            q.question.toLowerCase().includes(state.searchQuery) ||
            q.topic.toLowerCase().includes(state.searchQuery) ||
            q.chapter.toLowerCase().includes(state.searchQuery)
        );
    }

    // Update count
    document.getElementById('question-count-text').textContent = `Showing ${filteredQuestions.length} questions`;

    // Render logic
    if (filteredQuestions.length === 0) {
        elements.questionsContainer.innerHTML = `
            <div class="empty-state">
                <i class="ri-folder-open-line"></i>
                <p>No questions found.</p>
            </div>
        `;
        return;
    }

    elements.questionsContainer.innerHTML = filteredQuestions.map(q => {
        const isSaved = state.savedQuestions.includes(q.id);
        const saveIcon = isSaved ? 'ri-bookmark-3-fill' : 'ri-bookmark-3-line';
        const saveClass = isSaved ? 'btn-save saved' : 'btn-save';
        const imageSrc = q.image ? safeImageSrc(q.image) : null;

        return `
            <div class="question-frame" id="q-${escapeHtml(q.id)}">
                <div class="frame-header">
                    <div class="metadata-badges">
                        <span class="badge badge-year">${escapeHtml(q.year)}</span>
                        <span class="badge badge-topic">${escapeHtml(q.topic)}</span>
                        ${state.viewMode === 'saved' ? `<span class="badge badge-topic" style="background:rgba(99,102,241,0.1); color:var(--primary); border-color:var(--primary)">${escapeHtml(q.subject)} - ${escapeHtml(q.chapter)}</span>` : ''}
                    </div>
                    <div>
                        <button class="${saveClass}" data-id="${escapeHtml(q.id)}" title="Save Question">
                            <i class="${saveIcon}"></i>
                        </button>
                        ${(state.isAdminMode && String(q.id).startsWith('custom_')) ? `
                        <button class="btn-delete" data-id="${escapeHtml(q.id)}" title="Delete Question">
                            <i class="ri-delete-bin-line"></i>
                        </button>
                        ` : ''}
                    </div>
                </div>
                
                <div class="question-content">
                    ${formatText(q.question)}
                </div>
                
                ${imageSrc ? `<img src="${imageSrc}" class="question-image">` : ''}
                
                <div class="solution-section">
                    <button class="btn-toggle-solution">
                        <i class="ri-eye-line"></i> View Solution
                    </button>
                    <div class="solution-content">
                        ${formatText(q.solution)}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function toggleSave(id) {
    const index = state.savedQuestions.indexOf(id);
    if (index === -1) {
        state.savedQuestions.push(id);
    } else {
        state.savedQuestions.splice(index, 1);
    }

    localStorage.setItem('pyq_saved', JSON.stringify(state.savedQuestions));
    updateSavedCount();
    
    const isSaved = state.savedQuestions.includes(id);
    showToast(isSaved ? "Question saved to bookmarks" : "Question removed from bookmarks", isSaved ? "success" : "info");

    if (state.currentUser) {
        syncSavedWithBackend();
    }
}

async function syncSavedWithBackend() {
    if (!state.currentUser) return;
    try {
        await fetch(`${BASE_API_URL}/api/user/saved`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: state.currentUser.id,
                savedIds: state.savedQuestions
            })
        });
    } catch (err) {
        console.warn("Failed to sync saved questions with backend.");
    }
}

async function fetchUserSavedQuestions() {
    if (!state.currentUser) return;
    try {
        const response = await fetch(`${BASE_API_URL}/api/user/saved?userId=${state.currentUser.id}`);
        if (response.ok) {
            const backendSaved = await response.json();
            // Merge local and backend saved (unique set)
            const combined = [...new Set([...state.savedQuestions, ...backendSaved])];
            state.savedQuestions = combined;
            localStorage.setItem('pyq_saved', JSON.stringify(combined));
            updateSavedCount();
            
            // If local was different, sync back the merged version
            if (combined.length !== backendSaved.length) {
                syncSavedWithBackend();
            }
        }
    } catch (err) {
        console.warn("Failed to fetch saved questions from backend.");
    }
}

function updateSavedCount() {
    elements.savedCount.textContent = state.savedQuestions.length;
}

function renderSkeletons() {
    elements.questionsContainer.innerHTML = Array(3).fill(0).map(() => `
        <div class="skeleton-card">
            <div class="skeleton skeleton-title"></div>
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text" style="width: 80%"></div>
        </div>
    `).join('');
}

// --- Admin Features Logic ---
function setupAdminListeners() {
    if (adminListenersReady) return;
    adminListenersReady = true;

    // Open Login Modal / Handle Logout
    elements.adminTab.addEventListener('click', () => {
        if (state.isAdminMode) {
            if (confirm("Do you want to log out of Admin Mode?")) {
                state.isAdminMode = false;
                elements.adminTab.innerHTML = '<i class="ri-user-settings-fill"></i><span>Admin Area</span>';
                elements.uploadTab.style.display = 'none';
                elements.uploadAffiliateTab.style.display = 'none';
                renderQuestions();
            }
        } else {
            showAdminLoginPanel();
        }
    });

    // Open Upload Modal
    elements.uploadTab.addEventListener('click', () => {
        elements.adminDashboardModal.classList.add('active');
    });

    elements.uploadAffiliateTab.addEventListener('click', () => {
        elements.uploadAffiliateModal.classList.add('active');
    });

    // Close Modals
    elements.closeLoginModalBtn.addEventListener('click', (e) => {
        e.preventDefault();
        elements.adminLoginModal.classList.remove('active');
        if (window.location.hash === '#admin-login-modal') {
            history.replaceState(null, '', window.location.pathname + window.location.search);
        }
    });

    elements.closeDashboardModalBtn.addEventListener('click', () => {
        elements.adminDashboardModal.classList.remove('active');
    });

    elements.closeAffiliateModalBtn.addEventListener('click', () => {
        elements.uploadAffiliateModal.classList.remove('active');
    });

    // Verify Password
    elements.btnAdminLogin.addEventListener('click', () => {
        const username = elements.adminUsernameInput.value.trim();
        const password = elements.adminPasswordInput.value;

        if (!username) {
            elements.loginError.textContent = 'Please enter a username.';
            elements.loginError.style.display = 'block';
            return;
        }

        loginAsAdmin(username, password, elements.loginError);
    });

    // Handle form submission
    elements.uploadQuestionForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const formData = new FormData();
        formData.append('subject', document.getElementById('upload-subject').value);
        formData.append('chapter', document.getElementById('upload-chapter').value);
        formData.append('year', document.getElementById('upload-year').value);
        formData.append('topic', document.getElementById('upload-topic').value);
        formData.append('question', document.getElementById('upload-question').value);
        formData.append('solution', document.getElementById('upload-solution').value);
        const imageFile = document.getElementById('upload-image').files[0];
        if (imageFile) formData.append('image', imageFile);

        fetch(`${BASE_API_URL}/api/questions`, {
            method: 'POST',
            body: formData
        })
            .then(response => {
                if (!response.ok) throw new Error("Failed to save to backend");
                return response.json();
            })
            .then(data => {
                init();
                elements.adminDashboardModal.classList.remove('active');
                elements.uploadQuestionForm.reset();
                showToast("Question successfully uploaded!", "success");
            })
            .catch(error => {
                console.error("Backend error:", error);
                showToast("Could not connect to backend server.", "error");
            });
    });

    // Handle Affiliate Form Submission
    elements.uploadAffiliateForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const formData = new FormData();
        formData.append('title', document.getElementById('affiliate-title').value);
        formData.append('description', document.getElementById('affiliate-description').value);
        formData.append('url', document.getElementById('affiliate-url').value);
        const imageFile = document.getElementById('affiliate-image').files[0];
        if (imageFile) formData.append('image', imageFile);

        fetch(`${BASE_API_URL}/api/affiliates`, {
            method: 'POST',
            body: formData
        })
            .then(response => {
                if (!response.ok) throw new Error("Failed to save affiliate");
                return response.json();
            })
            .then(data => {
                init();
                elements.uploadAffiliateModal.classList.remove('active');
                elements.uploadAffiliateForm.reset();
                showToast("Affiliate link successfully uploaded!", "success");
            })
            .catch(error => {
                console.error("Backend error:", error);
                showToast("Could not connect to backend server.", "error");
            });
    });
}

function showAdminLoginPanel() {
    state.viewMode = 'admin-login';
    Array.from(elements.subjectList.children).forEach(child => child.classList.remove('active'));
    elements.savedTab.classList.remove('active');
    elements.affiliatesTab.classList.remove('active');
    elements.contactTab.classList.remove('active');
    renderAdminLoginPanel();
}

function renderAdminLoginPanel() {
    elements.viewTitle.textContent = "Admin Area";
    document.getElementById('question-count-text').textContent = "Sign in to manage content";
    elements.questionsContainer.innerHTML = `
        <div class="admin-login-panel">
            <h2>Admin Login</h2>
            <p>Enter your admin details to upload or manage questions and resources.</p>
            <div class="form-group">
                <input type="text" id="inline-admin-username" placeholder="Enter username" autocomplete="username">
            </div>
            <div class="form-group">
                <input type="password" id="inline-admin-password" placeholder="Enter password" autocomplete="current-password">
            </div>
            <button class="btn-primary" id="inline-admin-login">Login</button>
            <p id="inline-login-error" class="error-text"></p>
        </div>
    `;

    const usernameInput = document.getElementById('inline-admin-username');
    const passwordInput = document.getElementById('inline-admin-password');
    const loginButton = document.getElementById('inline-admin-login');
    const loginError = document.getElementById('inline-login-error');

    loginButton.addEventListener('click', () => {
        loginAsAdmin(usernameInput.value.trim(), passwordInput.value, loginError);
    });

    passwordInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            loginAsAdmin(usernameInput.value.trim(), passwordInput.value, loginError);
        }
    });

    usernameInput.focus();
}

function loginAsAdmin(username, password, errorElement) {
    if (!username) {
        errorElement.textContent = 'Please enter a username.';
        errorElement.style.display = 'block';
        return;
    }

    if (password !== 'admin123') {
        errorElement.textContent = 'Incorrect password.';
        errorElement.style.display = 'block';
        return;
    }

    state.isAdminMode = true;
    elements.adminLoginModal.classList.remove('active');
    if (window.location.hash === '#admin-login-modal') {
        history.replaceState(null, '', window.location.pathname + window.location.search);
    }

    elements.uploadTab.style.display = 'flex';
    elements.uploadAffiliateTab.style.display = 'flex';
    elements.adminTab.innerHTML = `<i class="ri-user-settings-fill" style="color:var(--success)"></i><span>${escapeHtml(username)} (Active)</span>`;
    state.viewMode = 'browse';
    renderChapters();
    renderQuestions();
}

async function deleteAffiliate(id) {
    try {
        const response = await fetch(`${BASE_API_URL}/api/affiliates/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            state.affiliateData = state.affiliateData.filter(a => a.id !== id);
            showToast("Affiliate link deleted", "info");
            renderQuestions();
        } else {
            showToast("Failed to delete affiliate", "error");
        }
    } catch (error) {
        console.error("Error deleting affiliate:", error);
        showToast("Connection error during delete", "error");
    }
}

async function deleteQuestion(id) {
    try {
        const response = await fetch(`${BASE_API_URL}/api/questions/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            // Remove from appData
            appData = appData.filter(q => q.id !== id);
            showToast("Question deleted", "info");
            renderQuestions();
        } else {
            showToast("Failed to delete question", "error");
        }
    } catch (error) {
        console.error("Error deleting question:", error);
        showToast("Connection error during delete", "error");
    }
}

function setupUserAuthListeners() {
    if (!elements.userTab) return;

    elements.userTab.addEventListener('click', () => {
        if (state.currentUser) {
            if (confirm(`Do you want to log out, ${state.currentUser.username}?`)) {
                state.currentUser = null;
                localStorage.removeItem('pyq_user');
                updateUserUI();
            }
        } else {
            elements.userAuthModal.classList.add('active');
            elements.authUsername.focus();
        }
    });

    elements.closeAuthModalBtn.addEventListener('click', () => {
        elements.userAuthModal.classList.remove('active');
        clearAuthForm();
    });

    elements.authToggleLogin.addEventListener('click', () => setAuthMode('login'));
    elements.authToggleSignup.addEventListener('click', () => setAuthMode('signup'));

    elements.userAuthForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('auth-username').value.trim();
        const password = document.getElementById('auth-password').value;

        if (state.authMode === 'login') {
            handleLogin(username, password);
        } else {
            handleSignup(username, password);
        }
    });
}

function setAuthMode(mode) {
    state.authMode = mode;
    if (mode === 'login') {
        elements.authToggleLogin.classList.add('active');
        elements.authToggleSignup.classList.remove('active');
        elements.authModalTitle.textContent = 'User Login';
        elements.btnAuthSubmit.textContent = 'Login';
    } else {
        elements.authToggleSignup.classList.add('active');
        elements.authToggleLogin.classList.remove('active');
        elements.authModalTitle.textContent = 'Create Account';
        elements.btnAuthSubmit.textContent = 'Sign Up';
    }
    elements.authError.style.display = 'none';
}

async function handleLogin(username, password) {
    const url = `${BASE_API_URL}/api/login`;
    console.log("Attempting login at:", url);
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        if (response.ok) {
            state.currentUser = data.user;
            localStorage.setItem('pyq_user', JSON.stringify(data.user));
            elements.userAuthModal.classList.remove('active');
            updateUserUI();
            await checkAccessStatus(); // Check access after login
            await fetchUserSavedQuestions();
            clearAuthForm();
        } else {
            elements.authError.textContent = data.error || `Login failed (Status: ${response.status})`;
            elements.authError.style.display = 'block';
        }
    } catch (err) {
        console.error("Login Error Details:", err);
        elements.authError.textContent = `Connection error: ${err.message || 'Server unreachable'}`;
        elements.authError.style.display = 'block';
    }
}

async function handleSignup(username, password) {
    const url = `${BASE_API_URL}/api/register`;
    console.log("Attempting signup at:", url);
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        if (response.ok) {
            elements.authSuccess.textContent = 'Account created! You can now login.';
            elements.authSuccess.style.display = 'block';
            setTimeout(() => {
                setAuthMode('login');
                elements.authSuccess.style.display = 'none';
            }, 2000);
        } else {
            elements.authError.textContent = data.error || `Registration failed (Status: ${response.status})`;
            elements.authError.style.display = 'block';
        }
    } catch (err) {
        console.error("Signup Error Details:", err);
        elements.authError.textContent = `Connection error: ${err.message || 'Server unreachable'}`;
        elements.authError.style.display = 'block';
    }
}

function updateUserUI() {
    if (!elements.userTabText) return;
    if (state.currentUser) {
        elements.userTabText.textContent = state.currentUser.username;
        elements.userTab.classList.add('active');
        elements.userTab.style.background = 'rgba(99, 102, 241, 0.1)';
        elements.userTab.style.color = 'var(--primary)';
        elements.userTab.style.borderColor = 'var(--primary)';
    } else {
        elements.userTabText.textContent = 'User Login';
        elements.userTab.classList.remove('active');
        elements.userTab.style.background = '';
        elements.userTab.style.color = '';
        elements.userTab.style.borderColor = '';
    }
}

function clearAuthForm() {
    elements.userAuthForm.reset();
    elements.authError.style.display = 'none';
    elements.authSuccess.style.display = 'none';
}

// Access System Functions
async function checkAccessStatus() {
    if (!state.currentUser) {
        state.hasAccess = false;
        updateAccessUI();
        return;
    }

    try {
        const response = await fetch(`${BASE_API_URL}/api/access/status?userId=${state.currentUser.id}`);
        const data = await response.json();
        state.hasAccess = data.hasAccess;
        state.accessUntil = data.accessUntil;
        updateAccessUI();
    } catch (err) {
        console.error("Failed to check access status");
    }
}

async function handleKeyActivation(key) {
    if (!state.currentUser) {
        showToast("Please login first to activate a key.", "info");
        elements.accessKeyModal.classList.remove('active');
        elements.userAuthModal.classList.add('active');
        return;
    }

    try {
        const response = await fetch(`${BASE_API_URL}/api/access/activate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: state.currentUser.id, key: key })
        });

        const data = await response.json();
        if (response.ok) {
            state.hasAccess = true;
            state.accessUntil = data.accessUntil;
            showToast("Access unlocked for 24 hours!", "success");
            elements.accessKeyModal.classList.remove('active');
            updateAccessUI();
        } else {
            elements.accessKeyError.textContent = data.error || "Invalid Key";
        }
    } catch (err) {
        elements.accessKeyError.textContent = "Connection error";
    }
}

function updateAccessUI() {
    // If not logged in, content is always locked
    const isLocked = !state.hasAccess || !state.currentUser;
    elements.accessDeniedOverlay.style.display = isLocked ? 'flex' : 'none';
    
    // Disable interactions with container if locked
    elements.questionsContainer.style.filter = isLocked ? 'blur(8px)' : 'none';
    elements.questionsContainer.style.pointerEvents = isLocked ? 'none' : 'auto';

    if (state.hasAccess && state.accessUntil) {
        const expiry = new Date(state.accessUntil);
        elements.accessExpiryText.textContent = `Access until: ${expiry.toLocaleDateString()} ${expiry.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
        elements.accessStatusTab.style.display = 'flex';
    } else {
        elements.accessStatusTab.style.display = 'none';
    }
}

function setupAccessClaimListener() {
    if (!elements.btnClaimFreeAccess) return;

    elements.btnClaimFreeAccess.addEventListener('click', async () => {
        if (!state.currentUser) {
            showToast("Please login first to claim access.", "info");
            elements.userAuthModal.classList.add('active');
            return;
        }

        // 1. Open the Ad Page in a new tab
        // Replace this URL with your ShrinkMe/AdFly/Shortener link
        const adPageUrl = `https://www.google.com/search?q=Your+Ad+Link+Here`; 
        window.open(adPageUrl, '_blank');

        // 2. Immediately grant access in the background
        try {
            const response = await fetch(`${BASE_API_URL}/api/access/claim?userId=${state.currentUser.id}`);
            if (response.ok) {
                showToast("Access Unlocked! Check the new tab for your ad.", "success");
                // Refresh the local state to show content immediately
                await checkAccessStatus(); 
            }
        } catch (err) {
            console.error("Auto-claim error:", err);
        }
    });
}

// Start
document.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();
    setupAdminListeners();
    setupSidebarToggle();
    setupUserAuthListeners();
    setupAccessClaimListener();
    updateSavedCount();
    
    // Initial UI state
    if (state.currentUser) {
        updateUserUI();
        await fetchUserSavedQuestions();
    }
    
    renderChapters();
    renderQuestions();
    
    // Background data fetch and access check
    await init();

    // Check for success redirect from free claim
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('accessClaimed') === 'true') {
        showToast("Access Unlocked! Happy Studying! 🎉", "success");
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }
});
