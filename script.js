// Application State
let state = {
    currentSubject: "Mathematics",
    currentChapter: "Real Numbers",
    savedQuestions: parseStoredArray('pyq_saved'),
    searchQuery: "",
    yearFilter: "All",
    viewMode: "browse", // 'browse', 'saved', 'affiliates', or 'contact'
    isAdminMode: false,
    affiliateData: []
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
    uploadAffiliateForm: document.getElementById('upload-affiliate-form')
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
    try {
        // Fetch questions from our backend
        const response = await fetch(API_URL);
        if (response.ok) {
            const backendData = await response.json();
            appData = [...pyqData, ...backendData];

            // Ensure any new chapters from backend are added to subjectsMap
            backendData.forEach(q => {
                if (subjectsMap[q.subject] && !subjectsMap[q.subject].includes(q.chapter)) {
                    subjectsMap[q.subject].push(q.chapter);
                }
            });
        }
    } catch (error) {
        console.warn("Backend not running or reachable. Falling back to local/static data.", error);
        const customData = parseStoredArray('pyq_custom_data');
        appData = [...pyqData, ...customData];
    }

    try {
        const affResponse = await fetch(API_URL.replace('/questions', '/affiliates'));
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
                if (confirm("Are you sure you want to delete this affiliate link?")) {
                    deleteAffiliate(affiliateId);
                }
            } else if (questionId) {
                if (confirm("Are you sure you want to delete this question?")) {
                    deleteQuestion(questionId);
                }
            }
        }
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
        const imageSrc = safeImageSrc(q.image);

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
                
                ${imageSrc ? `<img src="${imageSrc}" alt="Diagram" class="question-image">` : ''}
                
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
}

function updateSavedCount() {
    elements.savedCount.textContent = state.savedQuestions.length;
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

        const subject = document.getElementById('upload-subject').value;
        const chapter = document.getElementById('upload-chapter').value;
        const year = document.getElementById('upload-year').value;
        const topic = document.getElementById('upload-topic').value;
        const questionText = document.getElementById('upload-question').value;
        const imageFile = document.getElementById('upload-image').files[0];
        const solutionText = document.getElementById('upload-solution').value;

        const processUpload = (base64Image) => {
            const newQuestion = {
                id: 'custom_' + Date.now(),
                subject: subject,
                chapter: chapter,
                year: year,
                topic: topic,
                question: questionText,
                image: base64Image,
                solution: solutionText
            };

            // Save to Backend
            fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(newQuestion)
            })
                .then(response => {
                    if (!response.ok) throw new Error("Failed to save to backend");
                    return response.json();
                })
                .then(data => {
                    // Also save to localStorage as a fallback
                    const customData = parseStoredArray('pyq_custom_data');
                    customData.push(newQuestion);
                    try {
                        localStorage.setItem('pyq_custom_data', JSON.stringify(customData));
                    } catch (e) { }

                    appData.push(newQuestion);

                    if (!subjectsMap[subject].includes(chapter)) {
                        subjectsMap[subject].push(chapter);
                    }

                    elements.adminDashboardModal.classList.remove('active');
                    elements.uploadQuestionForm.reset();

                    state.currentSubject = subject;
                    state.currentChapter = chapter;
                    state.viewMode = 'browse';

                    Array.from(elements.subjectList.children).forEach(child => {
                        if (child.dataset.subject === subject) {
                            child.classList.add('active');
                        } else {
                            child.classList.remove('active');
                        }
                    });
                    elements.savedTab.classList.remove('active');

                    renderChapters();
                    renderQuestions();

                    alert("Question successfully uploaded to Backend!");
                })
                .catch(error => {
                    console.error("Backend error:", error);
                    alert("Could not connect to backend server. Make sure the Python server is running.");
                });
        };

        if (imageFile) {
            const reader = new FileReader();
            reader.onload = function (event) {
                processUpload(event.target.result);
            };
            reader.readAsDataURL(imageFile);
        } else {
            processUpload(null);
        }
    });

    // Handle Affiliate Form Submission
    elements.uploadAffiliateForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const title = document.getElementById('affiliate-title').value;
        const description = document.getElementById('affiliate-description').value;
        const url = document.getElementById('affiliate-url').value;
        const imageFile = document.getElementById('affiliate-image').files[0];

        const processAffiliateUpload = (base64Image) => {
            const newAffiliate = {
                id: 'aff_' + Date.now(),
                title: title,
                description: description,
                url: url,
                image: base64Image
            };

            fetch(API_URL.replace('/questions', '/affiliates'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(newAffiliate)
            })
                .then(response => {
                    if (!response.ok) throw new Error("Failed to save affiliate");
                    return response.json();
                })
                .then(data => {
                    state.affiliateData.push(newAffiliate);
                    elements.uploadAffiliateModal.classList.remove('active');
                    elements.uploadAffiliateForm.reset();

                    // Switch to affiliates view to show the new link
                    state.viewMode = 'affiliates';
                    elements.affiliatesTab.classList.add('active');
                    elements.savedTab.classList.remove('active');
                    elements.contactTab.classList.remove('active');
                    Array.from(elements.subjectList.children).forEach(child => child.classList.remove('active'));

                    renderQuestions();
                    alert("Affiliate link successfully uploaded!");
                })
                .catch(error => {
                    console.error("Backend error:", error);
                    alert("Could not connect to backend server.");
                });
        };

        if (imageFile) {
            const reader = new FileReader();
            reader.onload = function (event) {
                processAffiliateUpload(event.target.result);
            };
            reader.readAsDataURL(imageFile);
        } else {
            processAffiliateUpload(null);
        }
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
        const response = await fetch(API_URL.replace('/questions', '/affiliates') + '/' + id, {
            method: 'DELETE'
        });

        if (response.ok) {
            state.affiliateData = state.affiliateData.filter(a => a.id !== id);
            renderQuestions();
        } else {
            alert("Failed to delete affiliate from backend.");
        }
    } catch (error) {
        console.error("Error deleting:", error);
        alert("Could not connect to backend to delete.");
    }
}

async function deleteQuestion(id) {
    try {
        const response = await fetch(API_URL + '/' + id, {
            method: 'DELETE'
        });

        if (response.ok) {
            // Remove from appData
            appData = appData.filter(q => q.id !== id);

            // Remove from localStorage
            let customData = parseStoredArray('pyq_custom_data');
            customData = customData.filter(q => q.id !== id);
            localStorage.setItem('pyq_custom_data', JSON.stringify(customData));

            // Remove from savedQuestions if it's there
            const savedIndex = state.savedQuestions.indexOf(id);
            if (savedIndex !== -1) {
                state.savedQuestions.splice(savedIndex, 1);
                localStorage.setItem('pyq_saved', JSON.stringify(state.savedQuestions));
                updateSavedCount();
            }

            renderQuestions();
        } else {
            alert("Failed to delete question from backend.");
        }
    } catch (error) {
        console.error("Error deleting:", error);
        alert("Could not connect to backend to delete.");
    }
}

// Start
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    setupAdminListeners();
    updateSavedCount();
    renderChapters();
    renderQuestions();
    init();
});
