// ==========================================
// AIR-1 Platform OS - Enhanced with Scroll-to-top & New Habit Tracker
// ==========================================

class AppStore {
    constructor() {
        this.STORAGE_KEY = 'air1_v3_data';
        this.defaultState = {
            theme: 'dark',
            habits: [  // Subjects / Habits list
                { id: 1, name: 'Physics Practice' },
                { id: 2, name: 'Chemistry Revision' },
                { id: 3, name: 'Mathematics' },
                { id: 4, name: 'Mock Test Analysis' }
            ],
            // Daily entries: { "2026-06-03": { studyHours: number, homeworkDone: boolean } }
            dailyEntries: {},
            logs: [],
            settings: { dailyGoalHours: 10, pomodoroMins: 25 }
        };
        this.state = this.loadData();
    }

    loadData() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : null;
            if (parsed) {
                return { ...this.defaultState, ...parsed, dailyEntries: parsed.dailyEntries || {} };
            }
            return this.defaultState;
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

    // Habits / Subjects management
    addHabit(name) {
        const id = Date.now();
        this.state.habits.push({ id, name });
        this.saveData();
    }

    renameHabit(id, newName) {
        const habit = this.state.habits.find(h => h.id == id);
        if (habit) habit.name = newName;
        this.saveData();
    }

    deleteHabit(id) {
        this.state.habits = this.state.habits.filter(h => h.id != id);
        this.saveData();
    }

    // Daily entry management (study hours + homework)
    updateDailyEntry(dateStr, studyHours, homeworkDone) {
        if (!this.state.dailyEntries[dateStr]) {
            this.state.dailyEntries[dateStr] = { studyHours: 0, homeworkDone: false };
        }
        if (studyHours !== undefined) this.state.dailyEntries[dateStr].studyHours = parseFloat(studyHours) || 0;
        if (homeworkDone !== undefined) this.state.dailyEntries[dateStr].homeworkDone = homeworkDone;
        this.saveData();
    }

    getDailyEntry(dateStr) {
        return this.state.dailyEntries[dateStr] || { studyHours: 0, homeworkDone: false };
    }

    addLog(log) {
        this.state.logs.push({ ...log, id: Date.now() });
        this.saveData();
    }

    getTodayStr() {
        return new Date().toISOString().split('T')[0];
    }

    getDailyStats(dateStr) {
        const entry = this.getDailyEntry(dateStr);
        const dayLogs = this.state.logs.filter(l => l.date === dateStr);
        const totalHoursFromLogs = dayLogs.reduce((acc, log) => acc + Number(log.hours), 0);
        // Use max between manual entry and logs (coherence)
        const studyHours = Math.max(entry.studyHours, totalHoursFromLogs);
        const homeworkDone = entry.homeworkDone;
        return { hours: studyHours, homeworkDone, totalHabits: this.state.habits.length };
    }

    getStreak() {
        let streak = 0;
        const d = new Date();
        d.setHours(0,0,0,0);
        while (true) {
            const dateStr = d.toISOString().split('T')[0];
            const entry = this.getDailyEntry(dateStr);
            const hasStudy = entry.studyHours > 0;
            if (hasStudy) {
                streak++;
                d.setDate(d.getDate() - 1);
            } else break;
        }
        return streak;
    }
}

// UI Controller
const store = new AppStore();
let trendChartInstance = null, subjectChartInstance = null;
let currentSelectedSubjectId = null;

// Helper: Scroll to top smoothly on navigation
function scrollToTopSmooth() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    applyTheme(store.state.theme);
    setupNavigation();
    setupTimer();
    renderAll();

    document.getElementById('theme-toggle').addEventListener('click', () => {
        applyTheme(store.toggleTheme());
        renderCharts();
    });
    document.getElementById('export-btn').addEventListener('click', exportData);
    document.getElementById('log-form').addEventListener('submit', handleLogSubmit);
    
    // New tracker events
    document.getElementById('tracker-month').value = getCurrentMonthString();
    document.getElementById('tracker-month').addEventListener('change', () => renderTrackerGrid());
    document.getElementById('refresh-tracker-btn').addEventListener('click', () => renderTrackerGrid());
    document.getElementById('air-mode-btn').addEventListener('click', () => { showToast("✨ AIR-1 Mode: Laser focus activated!"); });
    document.getElementById('export-csv-tracker').addEventListener('click', exportTrackerCSV);
    document.getElementById('add-subject-btn').addEventListener('click', addNewSubject);
    document.getElementById('rename-subject-btn').addEventListener('click', renameSelectedSubject);
    document.getElementById('delete-subject-btn').addEventListener('click', deleteSelectedSubject);
    document.getElementById('quick-study-hours-btn').addEventListener('click', quickAddStudyHours);
    
    renderAll();
});

function applyTheme(theme) { document.body.setAttribute('data-theme', theme); }

function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-menu .nav-item');
    navItems.forEach(item => {
        if(!item.dataset.target) return;
        item.addEventListener('click', (e) => {
            navItems.forEach(n => n.classList.remove('active'));
            e.currentTarget.classList.add('active');
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            const targetId = e.currentTarget.dataset.target;
            document.getElementById(targetId).classList.add('active');
            if (targetId === 'analytics') renderCharts();
            if (targetId === 'tracker') renderTrackerGrid();
            // CRITICAL: scroll to top on every navigation
            scrollToTopSmooth();
        });
    });
}

function renderAll() {
    renderDashboard();
    renderSubjectsList();
    renderTrackerGrid();
    renderLogs();
    populateSubjectDropdown();
}

function renderDashboard() {
    const today = store.getTodayStr();
    const stats = store.getDailyStats(today);
    const streak = store.getStreak();
    document.getElementById('nav-streak').innerText = streak;
    document.getElementById('dash-hours-today').innerText = stats.hours.toFixed(1);
    document.getElementById('dash-homework-today').innerHTML = stats.homeworkDone ? '✅ Done' : '❌ Pending';
    
    const habitScore = stats.homeworkDone ? 50 : 0;
    const hourScore = Math.min((stats.hours / store.state.settings.dailyGoalHours) * 40, 40);
    const streakScore = Math.min(streak * 2, 10);
    const prodScore = Math.round(habitScore + hourScore + streakScore);
    document.getElementById('dash-prod-score').innerHTML = `${prodScore}<span class="text-muted">/100</span>`;
    
    const goalPct = Math.min(Math.round((stats.hours / store.state.settings.dailyGoalHours) * 100), 100);
    document.getElementById('goal-ring').setAttribute('stroke-dasharray', `${goalPct}, 100`);
    document.getElementById('goal-percentage').innerText = `${goalPct}%`;
    
    const insights = document.getElementById('ai-insights');
    insights.innerHTML = stats.hours < 2 ? 
        `<li><i data-lucide="alert-circle"></i> Low study hours today. Open the Habit Grid & update your progress.</li>` :
        `<li><i data-lucide="zap"></i> Great! Keep your ${store.state.settings.dailyGoalHours}h goal in sight.</li>`;
    if(streak > 3) insights.innerHTML += `<li><i data-lucide="flame"></i> 🔥 ${streak}-day streak! Unstoppable.</li>`;
    lucide.createIcons();
}

// --- Subjects list UI ---
function renderSubjectsList() {
    const container = document.getElementById('subjects-list-container');
    const selectAction = document.getElementById('select-subject-action');
    container.innerHTML = '';
    selectAction.innerHTML = '<option value="">-- Select subject --</option>';
    store.state.habits.forEach(habit => {
        const div = document.createElement('div');
        div.className = `subject-item ${currentSelectedSubjectId === habit.id ? 'selected' : ''}`;
        div.innerHTML = `<span class="subject-name">${escapeHtml(habit.name)}</span>`;
        div.addEventListener('click', () => {
            currentSelectedSubjectId = habit.id;
            renderSubjectsList();
        });
        container.appendChild(div);
        const option = document.createElement('option');
        option.value = habit.id;
        option.textContent = habit.name;
        selectAction.appendChild(option);
    });
}

function addNewSubject() {
    const input = document.getElementById('new-subject-name');
    const name = input.value.trim();
    if(name) {
        store.addHabit(name);
        input.value = '';
        renderSubjectsList();
        renderTrackerGrid();
        showToast(`Subject "${name}" added`);
    } else showToast("Enter subject name");
}

function renameSelectedSubject() {
    if(!currentSelectedSubjectId) { showToast("Select a subject first"); return; }
    const newName = prompt("New name:");
    if(newName && newName.trim()) {
        store.renameHabit(currentSelectedSubjectId, newName.trim());
        renderSubjectsList();
        renderTrackerGrid();
        showToast("Renamed");
    }
}

function deleteSelectedSubject() {
    if(!currentSelectedSubjectId) { showToast("Select a subject first"); return; }
    if(confirm("Delete subject? Logs remain but subject reference removed.")) {
        store.deleteHabit(currentSelectedSubjectId);
        currentSelectedSubjectId = null;
        renderSubjectsList();
        renderTrackerGrid();
        showToast("Deleted");
    }
}

function quickAddStudyHours() {
    const today = store.getTodayStr();
    const hours = prompt("Enter study hours for today:", store.getDailyEntry(today).studyHours);
    if(hours !== null && !isNaN(parseFloat(hours))) {
        store.updateDailyEntry(today, parseFloat(hours), undefined);
        renderTrackerGrid();
        renderDashboard();
        showToast(`✅ ${hours} hours logged for today`);
    }
}

// --- Tracker Grid (Study Hours + Homework per day) ---
function getCurrentMonthString() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
}

function renderTrackerGrid() {
    const monthInput = document.getElementById('tracker-month').value;
    if(!monthInput) return;
    const [year, month] = monthInput.split('-');
    const daysInMonth = new Date(year, month, 0).getDate();
    const tbody = document.getElementById('month-grid-body');
    tbody.innerHTML = '';
    
    for(let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${month}-${String(d).padStart(2,'0')}`;
        const entry = store.getDailyEntry(dateStr);
        const row = tbody.insertRow();
        row.insertCell(0).innerText = d;
        
        // Hours cell
        const hoursCell = row.insertCell(1);
        const hoursInput = document.createElement('input');
        hoursInput.type = 'number';
        hoursInput.step = '0.5';
        hoursInput.value = entry.studyHours;
        hoursInput.className = 'input-field';
        hoursInput.style.width = '100px';
        hoursInput.addEventListener('change', (e) => {
            store.updateDailyEntry(dateStr, e.target.value, undefined);
            renderDashboard();
            showToast(`Updated ${dateStr}: ${e.target.value} hrs`);
        });
        hoursCell.appendChild(hoursInput);
        
        // Homework checkbox
        const hwCell = row.insertCell(2);
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.checked = entry.homeworkDone;
        chk.style.transform = 'scale(1.2)';
        chk.addEventListener('change', (e) => {
            store.updateDailyEntry(dateStr, undefined, e.target.checked);
            renderDashboard();
            showToast(`Homework ${e.target.checked ? 'completed' : 'incomplete'} for ${dateStr}`);
        });
        hwCell.appendChild(chk);
    }
}

// Export CSV for current month
function exportTrackerCSV() {
    const monthInput = document.getElementById('tracker-month').value;
    if(!monthInput) return;
    const [year, month] = monthInput.split('-');
    const daysInMonth = new Date(year, month, 0).getDate();
    let csvRows = [["Day","Study Hours","Homework (Yes/No)"]];
    for(let d=1; d<=daysInMonth; d++) {
        const dateStr = `${year}-${month}-${String(d).padStart(2,'0')}`;
        const entry = store.getDailyEntry(dateStr);
        csvRows.push([d, entry.studyHours, entry.homeworkDone ? "Yes" : "No"]);
    }
    const csvContent = csvRows.map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], {type: "text/csv"});
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `habit_tracker_${year}_${month}.csv`;
    link.click();
    showToast("CSV exported");
}

// Logs & Analytics remain similar but integrated with store
function populateSubjectDropdown() {
    const select = document.getElementById('log-subject');
    select.innerHTML = '<option value="">Select Subject</option>';
    store.state.habits.forEach(h => {
        select.innerHTML += `<option value="${escapeHtml(h.name)}">${escapeHtml(h.name)}</option>`;
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
    if(!log.date || !log.subject || !log.hours) { showToast("Fill required fields"); return; }
    store.addLog(log);
    // Also update daily entry if this date is same as log date to keep consistency
    const existing = store.getDailyEntry(log.date);
    store.updateDailyEntry(log.date, existing.studyHours + parseFloat(log.hours), existing.homeworkDone);
    e.target.reset();
    renderAll();
    showToast("Session logged + daily hours updated");
}

function renderLogs() {
    const tbody = document.getElementById('logs-body');
    const sorted = [...store.state.logs].sort((a,b) => new Date(b.date) - new Date(a.date));
    tbody.innerHTML = sorted.slice(0,15).map(log => `
        <tr><td>${log.date}</td><td>${escapeHtml(log.subject)}</td><td>${log.hours}h</td><td>${log.qs}</td><td><button class="btn-secondary" style="padding:4px 8px;">Edit</button></td></tr>
    `).join('') || `<tr><td colspan="5" class="cell-center text-muted">No logs</td></tr>`;
}

function renderCharts() {
    const style = getComputedStyle(document.body);
    const textColor = style.getPropertyValue('--text-main');
    const gridColor = style.getPropertyValue('--border-color');
    const trendCtx = document.getElementById('trendChart').getContext('2d');
    const last7Days = Array.from({length:7}, (_,i) => {
        const d = new Date(); d.setDate(d.getDate() - (6-i)); return d.toISOString().split('T')[0];
    });
    const hoursData = last7Days.map(date => store.getDailyEntry(date).studyHours);
    if(trendChartInstance) trendChartInstance.destroy();
    trendChartInstance = new Chart(trendCtx, {
        type: 'line', data: { labels: last7Days.map(d=>d.slice(5)), datasets: [{ label:'Study Hours', data: hoursData, borderColor:'#8B5CF6', backgroundColor:'rgba(139,92,246,0.1)', borderWidth:3, fill:true }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor } }, x: { ticks: { color: textColor } } } }
    });
    const subCtx = document.getElementById('subjectChart').getContext('2d');
    const subjectTotals = {};
    store.state.logs.forEach(log => { subjectTotals[log.subject] = (subjectTotals[log.subject] || 0) + Number(log.hours); });
    if(subjectChartInstance) subjectChartInstance.destroy();
    subjectChartInstance = new Chart(subCtx, { type:'bar', data:{ labels:Object.keys(subjectTotals), datasets:[{ label:'Total Hours', data:Object.values(subjectTotals), backgroundColor:'#3B82F6' }] }, options: { responsive:true, maintainAspectRatio:false } });
}

// Timer unchanged
let timerInterval, timerSeconds = 25*60, isRunning = false;
function setupTimer() {
    updateTimerDisplay();
    document.getElementById('btn-start-timer').onclick = () => { if(!isRunning) { isRunning=true; timerInterval=setInterval(()=>{ if(timerSeconds>0) timerSeconds--, updateTimerDisplay(); else clearInterval(timerInterval), showToast("Focus complete!"); },1000); } };
    document.getElementById('btn-pause-timer').onclick = () => { isRunning=false; clearInterval(timerInterval); };
    document.getElementById('btn-reset-timer').onclick = () => { isRunning=false; clearInterval(timerInterval); timerSeconds=25*60; updateTimerDisplay(); };
}
function updateTimerDisplay() { const mins=Math.floor(timerSeconds/60), secs=timerSeconds%60; document.getElementById('time-left').innerText=`${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`; }

function exportData() { const blob=new Blob([JSON.stringify(store.state,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`AIR1_Backup_${store.getTodayStr()}.json`; a.click(); showToast("Data exported"); }

function showToast(msg) { const toast=document.createElement('div'); toast.className='toast'; toast.innerHTML=`<i data-lucide="check-circle"></i> ${msg}`; document.getElementById('toast-container').appendChild(toast); lucide.createIcons(); setTimeout(()=>toast.remove(),3000); }
function escapeHtml(str) { return String(str).replace(/[&<>]/g, function(m){ if(m==='&') return '&amp;'; if(m==='<') return '&lt;'; if(m==='>') return '&gt;'; return m;}); }