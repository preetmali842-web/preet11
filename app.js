// ==========================================
// AIR-1 Platform OS - State & Logic
// ==========================================

class AppStore {
    constructor() {
        this.STORAGE_KEY = 'air1_v2_data';
        this.defaultState = {
            theme: 'dark',
            habits: [
                { id: 1, name: 'Physics Practice', color: '#8B5CF6' },
                { id: 2, name: 'Chemistry Revision', color: '#10B981' },
                { id: 3, name: 'Mathematics', color: '#3B82F6' },
                { id: 4, name: 'Mock Test Analysis', color: '#F43F5E' }
            ],
            completions: {}, // Format: "YYYY-MM-DD_habitId": true
            logs: [], // Study logs
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

    // --- Actions ---
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

    // --- Computed ---
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
        // Simple streak: days with at least 1 habit checked backwards from today
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
        renderCharts(); // Re-render charts for color contrast
    });

    document.getElementById('export-btn').addEventListener('click', exportData);
    document.getElementById('log-form').addEventListener('submit', handleLogSubmit);
    document.getElementById('add-habit-btn').addEventListener('click', handleAddHabit);
    
    // Default Month for Tracker
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
    
    // Topbar
    document.getElementById('nav-streak').innerText = streak;
    
    // Stats
    document.getElementById('dash-hours-today').innerText = stats.hours.toFixed(1);
    document.getElementById('dash-habits-today').innerText = `${stats.completedHabits}/${stats.totalHabits}`;
    
    // Prod Score (Algorithm: Habits % + Hours weight + Streak weight)
    const habitScore = stats.totalHabits ? (stats.completedHabits / stats.totalHabits) * 50 : 0;
    const hourScore = Math.min((stats.hours / store.state.settings.dailyGoalHours) * 40, 40);
    const streakScore = Math.min(streak * 2, 10);
    const prodScore = Math.round(habitScore + hourScore + streakScore);
    document.getElementById('dash-prod-score').innerHTML = `${prodScore}<span class="text-muted">/100</span>`;

    // Goal Ring
    const goalPct = Math.min(Math.round((stats.hours / store.state.settings.dailyGoalHours) * 100), 100);
    document.getElementById('goal-ring').setAttribute('stroke-dasharray', `${goalPct}, 100`);
    document.getElementById('goal-percentage').innerText = `${goalPct}%`;

    // AI Insights (Simulated Intelligence)
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
    
    // Header
    let theadHtml = `<tr><th class="cell-center">Day</th>`;
    store.state.habits.forEach(h => {
        theadHtml += `<th class="cell-center">${h.name}</th>`;
    });
    theadHtml += `</tr>`;
    document.getElementById('habit-head').innerHTML = theadHtml;

    // Body
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

    // Bind Checks
    document.querySelectorAll('.habit-check').forEach(chk => {
        chk.addEventListener('change', (e) => {
            store.toggleCompletion(e.target.dataset.date, e.target.dataset.id, e.target.checked);
            renderDashboard(); // Update stats live
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
    // Sort descending by date
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

// --- Analytics (Chart.js) ---
function renderCharts() {
    const style = getComputedStyle(document.body);
    const textColor = style.getPropertyValue('--text-main');
    const gridColor = style.getPropertyValue('--border-color');

    // 1. Trend Chart (Last 7 Days)
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
            labels: last7Days.map(d => d.slice(5)), // MM-DD
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

    // 2. Subject Bar Chart
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
                    new Audio('https://assets.mixkit.co/sfx/preview/mixkit-software-interface-start-2574.mp3').play().catch(()=>{});
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

// --- Utilities ---
function exportData() {
    const blob = new Blob([JSON.stringify(store.state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AIR1_Backup_${store.getTodayStr()}.json`;
    a.click();
    showToast("Data exported successfully!");
}

function showToast(message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i data-lucide="check-circle" style="vertical-align: middle; margin-right: 8px;"></i> ${message}`;
    container.appendChild(toast);
    lucide.createIcons();
    setTimeout(() => { toast.remove(); }, 3000);
}