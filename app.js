// ==========================================
// AIR-1 Platform OS - State & Logic
// ==========================================

class AppStore {
    constructor() {
        this.STORAGE_KEY = 'air1_v2_data';
        this.defaultState = {
            theme: 'light', 
            habits: [
                { id: 1, name: 'Physics Practice', color: '#8B5CF6' },
                { id: 2, name: 'Chemistry Revision', color: '#10B981' },
                { id: 3, name: 'Mathematics', color: '#3B82F6' },
                { id: 4, name: 'Mock Test Analysis', color: '#F43F5E' }
            ],
            completions: {}, 
            logs: [],
            settings: { dailyGoalHours: 10, pomodoroMins: 25 }
        };
        this.state = this.loadData();
    }

    loadData() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            return raw ? { ...this.defaultState, ...JSON.parse(raw) } : this.defaultState;
        } catch (e) {
            console.error("Storage error:", e);
            return this.defaultState;
        }
    }

    saveData() {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.state));
    }

    toggleTheme() {
        this.state.theme = this.state.theme === 'dark' ? 'light' : 'dark';
        this.saveData();
        return this.state.theme;
    }

    addHabit(name) {
        const id = Date.now();
        this.state.habits.push({ id, name, color: '#8B5CF6' });
        this.saveData();
    }

    toggleCompletion(dateStr, habitId, isChecked) {
        const key = `${dateStr}_${habitId}`;
        if (isChecked) this.state.completions[key] = true;
        else delete this.state.completions[key];
        this.saveData();
    }

    addLog(log) {
        this.state.logs.push({ ...log, id: Date.now() });
        this.saveData();
    }

    getTodayStr() {
        return new Date().toISOString().split('T')[0];
    }

    getDailyStats(dateStr) {
        const dayLogs = this.state.logs.filter(l => l.date === dateStr);
        const hours = dayLogs.reduce((acc, log) => acc + Number(log.hours), 0);
        
        let completedHabits = 0;
        this.state.habits.forEach(h => {
            if (this.state.completions[`${dateStr}_${h.id}`]) completedHabits++;
        });

        return { hours, completedHabits, totalHabits: this.state.habits.length };
    }

    getStreak() {
        let streak = 0;
        const d = new Date();
        while (true) {
            const dateStr = d.toISOString().split('T')[0];
            let active = this.state.habits.some(h => this.state.completions[`${dateStr}_${h.id}`]);
            if (active) {
                streak++;
                d.setDate(d.getDate() - 1);
            } else {
                break;
            }
        }
        return streak;
    }
}

// ==========================================
// UI Controller
// ==========================================

const store = new AppStore();
let trendChartInstance = null;
let subjectChartInstance = null;

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    applyTheme(store.state.theme);
    setupNavigation();
    setupTimer();
    renderAll();

    // Event Listeners
    document.getElementById('theme-toggle').addEventListener('click', () => {
        applyTheme(store.toggleTheme());
        renderCharts();
    });

    document.getElementById('export-btn').addEventListener('click', exportDashboardAsPNG);
    document.getElementById('log-form').addEventListener('submit', handleLogSubmit);
    document.getElementById('add-habit-btn').addEventListener('click', handleAddHabit);
    
    const now = new Date();
    document.getElementById('tracker-month').value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    document.getElementById('tracker-month').addEventListener('change', renderTrackerGrid);
});

function applyTheme(theme) {
    document.body.setAttribute('data-theme', theme);
}

// --- Router ---
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-menu .nav-item');
    navItems.forEach(item => {
        if(!item.dataset.target) return;
        item.addEventListener('click', (e) => {
            navItems.forEach(n => n.classList.remove('active'));
            e.currentTarget.classList.add('active');
            
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            document.getElementById(e.currentTarget.dataset.target).classList.add('active');
            
            if (e.currentTarget.dataset.target === 'analytics') renderCharts();
            
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });
}

// --- Master Render ---
function renderAll() {
    renderDashboard();
    renderTrackerGrid();
    renderLogs();
    populateSubjectDropdown();
}

// --- Dashboard ---
function renderDashboard() {
    const today = store.getTodayStr();
    const stats = store.getDailyStats(today);
    const streak = store.getStreak();
    
    document.getElementById('nav-streak').innerText = streak;
    document.getElementById('dash-hours-today').innerText = stats.hours.toFixed(1);
    document.getElementById('dash-habits-today').innerText = `${stats.completedHabits}/${stats.totalHabits}`;
    
    const habitScore = stats.totalHabits ? (stats.completedHabits / stats.totalHabits) * 50 : 0;
    const hourScore = Math.min((stats.hours / store.state.settings.dailyGoalHours) * 40, 40);
    const streakScore = Math.min(streak * 2, 10);
    const prodScore = Math.round(habitScore + hourScore + streakScore);
    document.getElementById('dash-prod-score').innerHTML = `${prodScore}<span class="text-muted">/100</span>`;

    const goalPct = Math.min(Math.round((stats.hours / store.state.settings.dailyGoalHours) * 100), 100);
    document.getElementById('goal-ring').setAttribute('stroke-dasharray', `${goalPct}, 100`);
    document.getElementById('goal-percentage').innerText = `${goalPct}%`;

    const insights = document.getElementById('ai-insights');
    insights.innerHTML = '';
    
    if (stats.hours < 2) {
        insights.innerHTML += `<li><i data-lucide="alert-circle" class="text-muted"></i> You have a slow start today. Try a 25-minute Pomodoro to build momentum.</li>`;
    } else {
        insights.innerHTML += `<li><i data-lucide="zap" class="text-muted"></i> Great momentum today! Keep pushing towards your ${store.state.settings.dailyGoalHours}h goal.</li>`;
    }

    if (streak > 3) {
        insights.innerHTML += `<li><i data-lucide="flame" class="text-muted"></i> Amazing ${streak}-day streak! Consistency is the key to top percentiles.</li>`;
    } else {
        insights.innerHTML += `<li><i data-lucide="calendar" class="text-muted"></i> Remember, showing up every day is more important than perfect days.</li>`;
    }
    lucide.createIcons();
}

// --- Habit Grid ---
function handleAddHabit() {
    const name = prompt("Enter new habit or subject name:");
    if (name && name.trim()) {
        store.addHabit(name.trim());
        renderAll();
        showToast("Habit added successfully");
    }
}

function renderTrackerGrid() {
    const monthInput = document.getElementById('tracker-month').value;
    if(!monthInput) return;
    const [year, month] = monthInput.split('-');
    const daysInMonth = new Date(year, month, 0).getDate();
    
    let theadHtml = `<tr><th class="cell-center">Day</th>`;
    store.state.habits.forEach(h => {
        theadHtml += `<th class="cell-center">${h.name}</th>`;
    });
    theadHtml += `</tr>`;
    document.getElementById('habit-head').innerHTML = theadHtml;

    let tbodyHtml = '';
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${month}-${String(d).padStart(2,'0')}`;
        tbodyHtml += `<tr><td class="cell-center fw-bold">${d}</td>`;
        
        store.state.habits.forEach(h => {
            const isChecked = store.state.completions[`${dateStr}_${h.id}`];
            tbodyHtml += `
                <td class="cell-center">
                    <input type="checkbox" class="habit-check" 
                           data-date="${dateStr}" data-id="${h.id}" 
                           ${isChecked ? 'checked' : ''}>
                </td>`;
        });
        tbodyHtml += `</tr>`;
    }
    document.getElementById('habit-body').innerHTML = tbodyHtml;

    document.querySelectorAll('.habit-check').forEach(chk => {
        chk.addEventListener('change', (e) => {
            store.toggleCompletion(e.target.dataset.date, e.target.dataset.id, e.target.checked);
            renderDashboard();
        });
    });
}

// --- Study Logs ---
function populateSubjectDropdown() {
    const select = document.getElementById('log-subject');
    select.innerHTML = '<option value="">Select Subject</option>';
    store.state.habits.forEach(h => {
        select.innerHTML += `<option value="${h.name}">${h.name}</option>`;
    });
}

function handleLogSubmit(e) {
    e.preventDefault();
    const log = {
        date: document.getElementById('log-date').value,
        subject: document.getElementById('log-subject').value,
        hours: document.getElementById('log-hours').value,
        qs: document.getElementById('log-qs').value || 0
    };
    store.addLog(log);
    e.target.reset();
    renderAll();
    showToast("Session logged successfully!");
}

function renderLogs() {
    const tbody = document.getElementById('logs-body');
    const sorted = [...store.state.logs].sort((a,b) => new Date(b.date) - new Date(a.date));
    
    tbody.innerHTML = sorted.slice(0, 15).map(log => `
        <tr>
            <td>${log.date}</td>
            <td>${log.subject}</td>
            <td><span style="font-weight:700; color:var(--accent-purple)">${log.hours}h</span></td>
            <td>${log.qs}</td>
            <td><button class="btn-secondary" style="padding:4px 8px; font-size:0.8rem">Edit</button></td>
        </tr>
    `).join('') || `<tr><td colspan="5" class="cell-center text-muted">No logs recorded yet.</td></tr>`;
}

// --- Analytics ---
function renderCharts() {
    const style = getComputedStyle(document.body);
    const textColor = style.getPropertyValue('--text-main');
    const gridColor = style.getPropertyValue('--border-color');

    const trendCtx = document.getElementById('trendChart').getContext('2d');
    const last7Days = Array.from({length: 7}, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return d.toISOString().split('T')[0];
    });

    const hoursData = last7Days.map(date => store.getDailyStats(date).hours);

    if(trendChartInstance) trendChartInstance.destroy();
    trendChartInstance = new Chart(trendCtx, {
        type: 'line',
        data: {
            labels: last7Days.map(d => d.slice(5)),
            datasets: [{
                label: 'Study Hours',
                data: hoursData,
                borderColor: '#8B5CF6',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                borderWidth: 3,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor } },
                x: { grid: { color: gridColor }, ticks: { color: textColor } }
            },
            plugins: { legend: { labels: { color: textColor } } }
        }
    });

    const subCtx = document.getElementById('subjectChart').getContext('2d');
    const subjectTotals = {};
    store.state.logs.forEach(log => {
        subjectTotals[log.subject] = (subjectTotals[log.subject] || 0) + Number(log.hours);
    });

    if(subjectChartInstance) subjectChartInstance.destroy();
    subjectChartInstance = new Chart(subCtx, {
        type: 'bar',
        data: {
            labels: Object.keys(subjectTotals),
            datasets: [{
                label: 'Total Hours',
                data: Object.values(subjectTotals),
                backgroundColor: '#3B82F6',
                borderRadius: 8
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor } },
                x: { grid: { display: false }, ticks: { color: textColor } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// --- Pomodoro Timer ---
let timerInterval;
let timerSeconds = store.state.settings.pomodoroMins * 60;
let isRunning = false;

function setupTimer() {
    updateTimerDisplay();
    document.getElementById('btn-start-timer').addEventListener('click', () => {
        if(!isRunning) {
            isRunning = true;
            timerInterval = setInterval(() => {
                if(timerSeconds > 0) {
                    timerSeconds--;
                    updateTimerDisplay();
                } else {
                    clearInterval(timerInterval);
                    isRunning = false;
                    showToast("Focus session complete!");
                }
            }, 1000);
        }
    });

    document.getElementById('btn-pause-timer').addEventListener('click', () => {
        isRunning = false;
        clearInterval(timerInterval);
    });

    document.getElementById('btn-reset-timer').addEventListener('click', () => {
        isRunning = false;
        clearInterval(timerInterval);
        timerSeconds = store.state.settings.pomodoroMins * 60;
        updateTimerDisplay();
    });
}

function updateTimerDisplay() {
    const mins = Math.floor(timerSeconds / 60);
    const secs = timerSeconds % 60;
    document.getElementById('time-left').innerText = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
}

// --- Utilities ($1000 Feature: Mobile-Proof PNG Export) ---
function exportDashboardAsPNG() {
    if (typeof html2canvas === 'undefined') {
        showToast("Error: html2canvas library not loaded.");
        return;
    }

    const targetElement = document.getElementById('export-target');
    showToast("Processing high-quality PNG... 📸");

    const themeBg = getComputedStyle(document.body).getPropertyValue('--bg-base');

    html2canvas(targetElement, {
        backgroundColor: themeBg,
        scale: 2, 
        useCORS: true,
        logging: false
    }).then(canvas => {
        const url = canvas.toDataURL('image/png');
        
        // Mobile-proof: Create a full-screen overlay with the image
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.95)';
        overlay.style.zIndex = '999999';
        overlay.style.display = 'flex';
        overlay.style.flexDirection = 'column';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.padding = '20px';
        overlay.style.backdropFilter = 'blur(10px)';
        
        const img = document.createElement('img');
        img.src = url;
        img.style.maxWidth = '100%';
        img.style.maxHeight = '75%';
        img.style.borderRadius = '16px';
        img.style.boxShadow = '0 10px 40px rgba(139, 92, 246, 0.4)';
        
        const text = document.createElement('p');
        text.innerText = "👆 LONG PRESS IMAGE TO SAVE 👆";
        text.style.color = '#E2E8F0';
        text.style.fontWeight = '800';
        text.style.marginTop = '24px';
        text.style.fontSize = '1.1rem';
        text.style.letterSpacing = '1px';

        const closeBtn = document.createElement('button');
        closeBtn.innerText = "Close Window";
        closeBtn.style.marginTop = '20px';
        closeBtn.style.padding = '12px 24px';
        closeBtn.style.background = '#F43F5E';
        closeBtn.style.color = 'white';
        closeBtn.style.border = 'none';
        closeBtn.style.borderRadius = '12px';
        closeBtn.style.fontWeight = 'bold';
        closeBtn.style.cursor = 'pointer';
        
        closeBtn.onclick = () => document.body.removeChild(overlay);

        overlay.appendChild(img);
        overlay.appendChild(text);
        overlay.appendChild(closeBtn);
        document.body.appendChild(overlay);

        showToast("Success! Image generated.");
    }).catch(err => {
        console.error("Export failed:", err);
        showToast("Failed to save image. Try again.");
    });
}

function showToast(message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i data-lucide="check-circle"></i> ${message}`;
    container.appendChild(toast);
    lucide.createIcons();
    setTimeout(() => { toast.remove(); }, 3000);
}
