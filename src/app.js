/**
 * GIT-SEARCH Core Frontend
 * Premium Analytics & AI Discovery
 */

document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const el = {
        btnScan: document.getElementById('btnScan'),
        btnExport: document.getElementById('btnExport'),
        btnClear: document.getElementById('btnClear'),
        btnSaveConfig: document.getElementById('btnSaveConfig'),
        configModal: document.getElementById('configModal'),
        gitPathInput: document.getElementById('gitPathInput'),
        repoInput: document.getElementById('repoInput'),
        fileList: document.getElementById('fileList'),
        statCommits: document.getElementById('statCommits'),
        statAuthors: document.getElementById('statAuthors'),
        statChurn: document.getElementById('statChurn'),
        statImpact: document.getElementById('statImpact'),
        heatmap: document.getElementById('activityHeatmap'),
        churnRanking: document.getElementById('churnRanking'),
        colabNetwork: document.getElementById('colabNetwork'),
        loader: document.getElementById('loader'),
        loaderText: document.getElementById('loaderText'),
        currentRepoName: document.getElementById('currentRepoName'),
        lastSync: document.getElementById('lastSync'),
        branchBadge: document.getElementById('branchBadge'),
        commitSearchInput: document.getElementById('commitSearchInput'),
        searchResults: document.getElementById('searchResults'),
        aiInsightsList: document.getElementById('aiInsightsList'),
        aiChatTrigger: document.getElementById('aiChatTrigger'),
        aiChatWindow: document.getElementById('aiChatWindow'),
        closeChat: document.getElementById('closeChat'),
        chatMessages: document.getElementById('chatMessages'),
        aiMsgInput: document.getElementById('aiMsgInput'),
        sendAiMsg: document.getElementById('sendAiMsg'),
        // Acciones V2
        repoActions: document.getElementById('repoActions'),
        authorFilter: document.getElementById('authorFilter'),
        btnToggleClone: document.getElementById('btnToggleClone'),
        cloneDropdown: document.getElementById('cloneDropdown'),
        cloneTabs: document.querySelectorAll('.clone-tab'),
        cloneUrlInput: document.getElementById('cloneUrlInput'),
        btnCopyClone: document.getElementById('btnCopyClone'),
        btnDownloadZip: document.getElementById('btnDownloadZip'),
        btnLocalOpen: document.getElementById('btnLocalOpen'),
        // V3 Extra
        geminiKeyInput: document.getElementById('geminiKeyInput'),
        geminiModelInput: document.getElementById('geminiModelInput'),
        lastActiveDate: document.getElementById('lastActiveDate'),
        totalEdits: document.getElementById('totalEdits'),
        // Commits Timeline Panel
        commitsPanel: document.getElementById('commitsPanel'),
        commitsAuthorName: document.getElementById('commitsAuthorName'),
        commitsCountBadge: document.getElementById('commitsCountBadge'),
        commitsTimeline: document.getElementById('commitsTimeline')
    };

    let typingMsg = null;
    let langChartInstance = null;
    
    // Mapeo detallado de lenguajes basado en GitHub Colors
    const extMap = {
        'js': { name: 'JavaScript', color: '#f1e05a' },
        'ts': { name: 'TypeScript', color: '#3178c6' },
        'html': { name: 'HTML', color: '#e34c26' },
        'css': { name: 'CSS', color: '#563d7c' },
        'py': { name: 'Python', color: '#3572A5' },
        'java': { name: 'Java', color: '#b07219' },
        'c': { name: 'C', color: '#555555' },
        'cpp': { name: 'C++', color: '#f34b7d' },
        'cs': { name: 'C#', color: '#178600' },
        'php': { name: 'PHP', color: '#4F5D95' },
        'rb': { name: 'Ruby', color: '#701516' },
        'go': { name: 'Go', color: '#00ADD8' },
        'rs': { name: 'Rust', color: '#dea584' },
        'md': { name: 'Markdown', color: '#083fa1' },
        'json': { name: 'JSON', color: '#292929' },
        'vue': { name: 'Vue', color: '#41b883' },
        'sh': { name: 'Shell', color: '#89e051' },
        'cjs': { name: 'JavaScript', color: '#f1e05a' },
        'mjs': { name: 'JavaScript', color: '#f1e05a' }
    };

    let currentData = null;
    let originalRepoUrl = '';
    let searchHistory = [];

    // Initialization
    async function init() {
        try {
            const res = await fetch('/api/config');
            const config = await res.json();
            el.gitPathInput.value = config.gitPath || 'git';
            el.geminiKeyInput.value = config.groqKey || '';
            el.geminiModelInput.value = config.groqModel || 'llama3-8b-8192';
        } catch (e) { console.warn('Config not loaded'); }
    }
    init();

    // Event Listeners
    el.btnScan.addEventListener('click', analyzeRepo);
    el.btnClear.addEventListener('click', resetDashboard);
    el.btnSaveConfig.addEventListener('click', saveConfig);
    el.btnExport.addEventListener('click', exportPDF);
    el.aiChatTrigger.addEventListener('click', () => el.aiChatWindow.classList.toggle('hidden'));
    el.closeChat.addEventListener('click', () => el.aiChatWindow.classList.add('hidden'));
    el.sendAiMsg.addEventListener('click', handleUserMsg);
    el.aiMsgInput.addEventListener('keypress', (e) => e.key === 'Enter' && handleUserMsg());
    el.btnTestGit = document.getElementById('btnTestGit');
    el.testGitResult = document.getElementById('testGitResult');
    el.btnTestGit.addEventListener('click', testGitConnection);

    // Lógica filtro por autor
    el.authorFilter.addEventListener('change', applyAuthorFilter);

    // Lógica Clone Dropdown
    el.btnToggleClone.addEventListener('click', (e) => {
        e.stopPropagation();
        el.cloneDropdown.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
        if (!el.cloneDropdown.contains(e.target) && e.target !== el.btnToggleClone) {
            el.cloneDropdown.classList.remove('active');
        }
    });

    el.cloneTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            el.cloneTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            updateCloneUrl(tab.dataset.target);
        });
    });

    el.btnCopyClone.addEventListener('click', () => {
        navigator.clipboard.writeText(el.cloneUrlInput.value);
        const originalHtml = el.btnCopyClone.innerHTML;
        el.btnCopyClone.innerHTML = '✅';
        setTimeout(() => el.btnCopyClone.innerHTML = originalHtml, 2000);
    });

    el.btnDownloadZip.addEventListener('click', async () => {
        const repoPath = el.repoInput.value.trim();
        if (!repoPath) return alert('Escanea un repositorio primero.');

        showLoader(true, 'Generando archivo ZIP...');
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = `/api/download-zip?path=${encodeURIComponent(repoPath)}`;
        document.body.appendChild(iframe);

        setTimeout(() => {
            iframe.remove();
            showLoader(false);
        }, 4000);
    });

    el.btnLocalOpen.addEventListener('click', () => {
        if (!originalRepoUrl) return;
        window.location.href = `x-github-client://openRepo/${originalRepoUrl}`;
    });

    function updateCloneUrl(type) {
        if (!originalRepoUrl) return;
        let base = originalRepoUrl.replace('.git', '');
        switch (type) {
            case 'httpsTab': el.cloneUrlInput.value = base + '.git'; break;
            case 'sshTab': el.cloneUrlInput.value = base.replace('https://github.com/', 'git@github.com:') + '.git'; break;
            case 'cliTab': el.cloneUrlInput.value = 'gh repo clone ' + base.replace('https://github.com/', ''); break;
        }
    }

    el.commitSearchInput.addEventListener('input', debounce(async (e) => {
        const query = e.target.value.trim();
        if (query.length < 2) {
            el.searchResults.classList.add('hidden');
            return;
        }
        const repoPath = el.repoInput.value.trim();
        const res = await fetch(`/api/search?path=${encodeURIComponent(repoPath)}&query=${encodeURIComponent(query)}`);
        const { commits } = await res.json();

        if (query.length > 2) {
            searchHistory.push({ query, time: new Date().toLocaleTimeString(), count: commits.length });
        }

        renderSearchResults(commits);
    }, 300));

    async function testGitConnection() {
        el.testGitResult.classList.remove('hidden');
        el.testGitResult.textContent = 'Probando conexión...';
        el.testGitResult.className = 'test-result processing';

        try {
            const res = await fetch('/api/test-git');
            const data = await res.json();
            if (data.success) {
                el.testGitResult.textContent = '✅ Git Conectado: ' + data.output;
                el.testGitResult.className = 'test-result success';
            } else {
                throw new Error(data.error);
            }
        } catch (e) {
            el.testGitResult.textContent = '❌ Error: ' + e.message;
            el.testGitResult.className = 'test-result error';
        }
    }

    async function analyzeRepo() {
        const path = el.repoInput.value.trim();
        if (!path) return alert('Ingresa una ruta de repositorio');

        showLoader(true, 'GIT-SEARCH: Indexando y Analizando...');
        try {
            const [analytics, tree] = await Promise.all([
                fetchData(`/api/analytics?path=${encodeURIComponent(path)}`),
                fetchData(`/api/tree?path=${encodeURIComponent(path)}`)
            ]);

            currentData = { ...analytics, files: tree.files };

            // Llenar selector de autores
            const authors = [...new Set(currentData.commits.map(c => c.autor))].sort((a, b) => a.localeCompare(b));
            el.authorFilter.innerHTML = '<option value="all">Todos los colaboradores</option>' +
                authors.map(a => `<option value="${a}">${a}</option>`).join('');

            renderDashboard(currentData);

            originalRepoUrl = path;
            el.repoActions.style.display = 'flex';
            updateCloneUrl('httpsTab');

            el.currentRepoName.textContent = path.split(/[\\/]/).pop().replace('.git', '') || 'Dashboard';
            el.lastSync.textContent = `Sincronización: ${new Date().toLocaleTimeString()}`;
            el.branchBadge.textContent = 'Active Analysis';
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            showLoader(false);
        }
    }

    async function saveConfig() {
        const gitPath = el.gitPathInput.value.trim();
        const groqKey = el.geminiKeyInput.value.trim();
        const groqModel = el.geminiModelInput.value.trim();

        await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gitPath, groqKey, groqModel })
        });
        el.configModal.classList.add('hidden');
    }

    function resetDashboard() {
        currentData = null;
        originalRepoUrl = '';
        el.repoInput.value = '';
        el.currentRepoName.textContent = 'Dashboard Inteligente';
        el.lastSync.textContent = 'Sincronización: --:--';
        el.branchBadge.textContent = 'Esperando...';

        el.statCommits.textContent = '0';
        el.statAuthors.textContent = '0';
        el.statChurn.textContent = '0';
        el.statImpact.textContent = '--';
        el.totalEdits.textContent = 'Total ediciones: 0';
        el.lastActiveDate.textContent = 'Última conexión: --';

        el.repoActions.style.display = 'none';
        el.authorFilter.innerHTML = '<option value="all">Todos los colaboradores</option>';

        el.heatmap.innerHTML = '';
        el.churnRanking.innerHTML = '<p class="empty-state">No hay datos disponibles</p>';
        el.colabNetwork.innerHTML = '<p class="empty-state">Esperando análisis...</p>';
        el.aiInsightsList.innerHTML = '';
        el.fileList.innerHTML = '<li class="empty-state">Ingresa una ruta para comenzar</li>';

        if (el.commitsPanel) el.commitsPanel.style.display = 'none';
        if (el.commitsTimeline) el.commitsTimeline.innerHTML = '<p class="empty-state">No hay aportes para mostrar</p>';
        if (langChartInstance) {
            langChartInstance.destroy();
            langChartInstance = null;
        }
    }

    function applyAuthorFilter(e) {
        const selectedAuthor = e.target.value;
        if (!currentData) return;

        // 1. Filtrar los commits
        let filteredCommits = currentData.commits;
        if (selectedAuthor !== 'all') {
            filteredCommits = currentData.commits.filter(c => c.autor === selectedAuthor);
        }

        // 2. Recalcular las métricas (Heatmap y Churn) localmente
        const heatmapData = {};
        const churnMap = {};

        filteredCommits.forEach(commit => {
            const dateStr = commit.dateStr || (commit.fecha ? String(commit.fecha).split('T')[0] : null);
            if (dateStr) {
                heatmapData[dateStr] = (heatmapData[dateStr] || 0) + 1;
            }

            if (commit.archivos) {
                commit.archivos.forEach(file => {
                    churnMap[file.nombre] = (churnMap[file.nombre] || 0) + 1;
                });
            }
        });

        const churnRanking = Object.entries(churnMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([name, count]) => ({ name, count }));

        // 3. Crear un payload filtrado que pasa a la UI
        const customData = {
            ...currentData,
            commits: filteredCommits,
            metrics: {
                ...currentData.metrics,
                heatmapData: heatmapData,
                churnRanking: churnRanking
            }
        };

        el.commitsAuthorName.textContent = selectedAuthor === 'all' ? 'Todos' : selectedAuthor;

        renderDashboard(customData);
    }

    function renderDashboard(data) {
        const { commits, metrics, files } = data;

        // Statistics
        el.statCommits.textContent = commits.length;

        // Contar colaboradores utilizando el email para agrupaciones más exactas en vez del nombre
        const uniqueContributors = new Set(commits.map(c => {
            if (c.email) return c.email.trim().toLowerCase();
            return c.autor.trim().toLowerCase();
        }));

        el.statAuthors.textContent = uniqueContributors.size;
        el.statChurn.textContent = metrics.churnRanking.length > 0 ? metrics.churnRanking[0].count : 0;

        // Heatmap Didactic Stats
        el.totalEdits.textContent = `Total ediciones: ${commits.length}`;
        const lastDate = commits[0] ? (commits[0].dateStr || (commits[0].fecha ? String(commits[0].fecha).split('T')[0] : '--')) : '--';
        el.lastActiveDate.textContent = `Última conexión: ${lastDate}`;

        // Health Score (mock logic)
        const health = Math.max(0, 100 - (metrics.churnRanking.length * 2));
        el.statImpact.textContent = `${health}%`;

        renderHeatmap(metrics.heatmapData);
        renderChurn(metrics.churnRanking);
        renderSynergy(metrics.synergy);
        renderAI(metrics.aiInsights);
        renderSidebar(files, metrics.churnRanking);
        renderLanguageChart(files);
        renderCommitsTimeline(commits);
    }

    function renderCommitsTimeline(commits) {
        if (!commits || commits.length === 0) {
            el.commitsPanel.style.display = 'none';
            return;
        }

        el.commitsPanel.style.display = 'block';
        el.commitsCountBadge.textContent = `${commits.length} commits`;

        // Renderizar todos los commits pero limitando la vista inicial o usando scroll (ya tiene scroll)
        el.commitsTimeline.innerHTML = commits.map(c => {
            let addCount = 0;
            let delCount = 0;
            if (c.archivos) {
                c.archivos.forEach(f => {
                    addCount += f.adiciones || 0;
                    delCount += f.eliminaciones || 0;
                });
            }

            const dateObj = c.fecha ? new Date(c.fecha) : null;
            const dateFormatted = dateObj ? dateObj.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' }) : c.dateStr;

            return `
                <div class="commit-card">
                    <div class="commit-card-header">
                        <div class="commit-author">
                            🧑‍💻 ${c.autor}
                        </div>
                        <div class="commit-date">${dateFormatted}</div>
                    </div>
                    <div class="commit-message">${c.mensaje}</div>
                    <div class="commit-stats">
                        <span class="commit-hash">${c.hash.substring(0, 7)}</span>
                        <span class="commit-stat-files">📄 ${c.archivos ? c.archivos.length : 0} archivos</span>
                        <span class="commit-stat-add">+${addCount}</span>
                        <span class="commit-stat-del">-${delCount}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderHeatmap(data) {
        el.heatmap.innerHTML = '';
        const now = new Date();
        const dates = Object.keys(data).sort();
        const maxVal = Math.max(...Object.values(data), 1);

        // Fill 52 weeks (364 days)
        for (let i = 0; i < 371; i++) {
            const d = new Date(now);
            d.setDate(now.getDate() - (370 - i));
            const dateStr = d.toISOString().split('T')[0];
            const val = data[dateStr] || 0;

            const cell = document.createElement('div');
            cell.className = 'heatmap-cell';
            const opacity = val === 0 ? 0.05 : 0.2 + (val / maxVal) * 0.8;
            cell.style.background = `rgba(99, 102, 241, ${opacity})`;
            cell.title = `${dateStr}: ${val} commits`;
            el.heatmap.appendChild(cell);
        }
    }

    function renderChurn(ranking) {
        el.churnRanking.innerHTML = ranking.map(item => `
            <div class="churn-item">
                <div class="churn-meta">
                    <span class="file-name">${item.name.split('/').pop()}</span>
                    <span class="file-count">${item.count} edits</span>
                </div>
                <div class="churn-bar-bg">
                    <div class="churn-bar-fill" style="width: ${Math.min(100, (item.count / ranking[0].count) * 100)}%"></div>
                </div>
            </div>
        `).join('') || '<p class="empty-state">No hay hotspots detectados</p>';
    }

    function renderSynergy(synergy) {
        el.colabNetwork.innerHTML = synergy.map(s => `
            <div class="synergy-card">
                <div class="pair">👥 ${s.source.split(' ')[0]} + ${s.target.split(' ')[0]}</div>
                <div class="weight">${s.weight} archivos</div>
            </div>
        `).join('') || '<p class="empty-state">Equipo trabajando en silos</p>';
    }

    function renderAI(insights) {
        el.aiInsightsList.innerHTML = insights.map(ins => `
            <div class="insight-card ${ins.type}">
                ${ins.text}
            </div>
        `).join('');
    }

    function renderSidebar(files, churnRanking = []) {
        const hotspotSet = new Set(churnRanking.map(item => item.name));
        const topFilesToShow = new Set(files.slice(0, 200));
        
        // Garantizar que los archivos más modificados siempre se muestren
        hotspotSet.forEach(f => topFilesToShow.add(f));

        const tree = {};
        [...topFilesToShow].forEach(f => {
            const parts = f.split('/');
            let current = tree;
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                if (!current[part]) {
                    current[part] = i === parts.length - 1 ? null : {};
                }
                current = current[part];
            }
        });

        function generateHTML(node, depth = 0, currentPath = '') {
            let html = '';
            // Ordenar carpetas primero, luego archivos
            const entries = Object.entries(node).sort((a, b) => {
                const aIsFolder = a[1] !== null;
                const bIsFolder = b[1] !== null;
                if (aIsFolder && !bIsFolder) return -1;
                if (!aIsFolder && bIsFolder) return 1;
                return a[0].localeCompare(b[0]);
            });

            for (const [name, content] of entries) {
                const itemPath = currentPath ? `${currentPath}/${name}` : name;
                if (content === null) {
                    const isHotspot = hotspotSet.has(itemPath);
                    const styleStr = isHotspot 
                        ? `padding-left: ${depth * 15 + 12}px; color: var(--danger); font-weight: bold; background: rgba(248, 81, 73, 0.1); border-left: 3px solid var(--danger); margin-bottom: 2px;` 
                        : `padding-left: ${depth * 15 + 12}px`;
                    const icon = isHotspot ? '🔥' : '📄';
                    html += `<li class="file-item" style="${styleStr}" title="${itemPath}">${icon} ${name}</li>`;
                } else {
                    html += `<li class="file-item" style="padding-left: ${depth * 15 + 12}px; color: var(--text-main); font-weight: 600;" title="${itemPath}">📁 ${name}</li>`;
                    html += generateHTML(content, depth + 1, itemPath);
                }
            }
            return html;
        }

        el.fileList.innerHTML = generateHTML(tree);
    }

    function renderLanguageChart(files) {
        if (!files || files.length === 0) return;
        const counts = {};
        files.forEach(f => {
            if (f.includes('.')) {
                const ext = f.split('.').pop().toLowerCase();
                if (extMap[ext]) {
                    const lang = extMap[ext];
                    counts[lang.name] = counts[lang.name] || { count: 0, color: lang.color };
                    counts[lang.name].count++;
                } else if (!['png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'mp4'].includes(ext)) {
                    // Count unknown code files as "Otros"
                    counts['Otros'] = counts['Otros'] || { count: 0, color: '#8b949e' };
                    counts['Otros'].count++;
                }
            }
        });

        // Convert to array and sort
        const sorted = Object.entries(counts).sort((a, b) => b[1].count - a[1].count).slice(0, 6);
        const labels = sorted.map(item => item[0]);
        const data = sorted.map(item => item[1].count);
        const bgColors = sorted.map(item => item[1].color);

        if (langChartInstance) {
            langChartInstance.destroy();
        }

        const canvas = document.getElementById('languageChart');
        if(!canvas) return;
        const ctx = canvas.getContext('2d');
        
        langChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: bgColors,
                    borderWidth: 2,
                    borderColor: '#161b22', // Match dark background
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%', // Hacer el anillo más delgado y moderno
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { 
                            color: '#e6edf3', 
                            font: { family: 'Inter', size: 12 },
                            usePointStyle: true,
                            boxWidth: 8
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const total = context.chart._metasets[context.datasetIndex].total;
                                const value = context.raw;
                                const percentage = Math.round((value / total) * 100) + '%';
                                return ` ${context.label}: ${value} archivos (${percentage})`;
                            }
                        }
                    }
                }
            }
        });
    }

    function renderSearchResults(commits) {
        if (commits.length === 0) {
            el.searchResults.classList.add('hidden');
            return;
        }
        el.searchResults.innerHTML = commits.slice(0, 5).map(c => `
            <div class="search-item">
                <strong>${c.author}</strong>: ${c.subject} <br>
                <small>${c.date}</small>
            </div>
        `).join('');
        el.searchResults.classList.remove('hidden');
    }

    async function handleUserMsg() {
        const text = el.aiMsgInput.value.trim();
        if (!text) return;

        appendMsg('user', text);
        el.aiMsgInput.value = '';

        if (!currentData) {
            appendMsg('bot', 'Por favor, escanea un repositorio primero para que pueda evaluar las métricas.');
            return;
        }

        // Show typing indicator
        const typingMsg = document.createElement('div');
        typingMsg.className = 'msg bot typing';
        typingMsg.textContent = 'Pensando...';
        el.chatMessages.appendChild(typingMsg);
        el.chatMessages.scrollTop = el.chatMessages.scrollHeight;

        const aiContext = {
            commitsTotal: currentData.commits.length,
            churnRanking: (currentData.metrics.churnRanking || []).slice(0, 15),
            synergy: (currentData.metrics.synergy || []).slice(0, 5),
            filesTotal: currentData.files ? currentData.files.length : 0
        };

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text, context: aiContext })
            });
            if (!res.ok) {
                const text = await res.text();
                let errMsg = 'Error HTTP ' + res.status;
                try { errMsg = JSON.parse(text).error || errMsg; } catch (e) { }
                appendMsg('bot', '⚠️ ' + errMsg);
                return;
            }
            const data = await res.json();

            typingMsg.remove();

            if (data.error) {
                appendMsg('bot', '⚠️ ' + data.error);
            } else {
                appendMsg('bot', data.response);
            }
        } catch (e) {
            typingMsg.remove();
            appendMsg('bot', '⚠️ Error contactando a la IA: ' + e.message);
        }
    }

    function appendMsg(type, text) {
        const msg = document.createElement('div');
        msg.className = `msg ${type}`;
        msg.textContent = text;
        el.chatMessages.appendChild(msg);
        el.chatMessages.scrollTop = el.chatMessages.scrollHeight;
    }

    // Helpers
    async function fetchData(url) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    }

    function showLoader(show, text) {
        el.loader.classList.toggle('hidden', !show);
        el.loaderText.textContent = text;
    }

    function debounce(func, wait) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    async function exportPDF() {
        if (!currentData) return alert('Escanea un repositorio primero');
        showLoader(true, 'Generando Auditoría con Capturas...');

        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();

            // 1. Título y Metadatos
            doc.setFontSize(22);
            doc.text("GIT-SEARCH: Auditoría Técnica", 15, 20);

            doc.setFontSize(14);
            doc.text(`Repositorio: ${el.currentRepoName.textContent}`, 15, 30);
            doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 15, 38);

            // 2. Insertar Captura Visual (Dashboard Completo)
            const mainContent = document.querySelector('.content-area');
            const canvas = await html2canvas(mainContent, { scale: 1.5, backgroundColor: '#0a0c10' });
            const imgData = canvas.toDataURL('image/png');

            // Calcular proproción para ajustar el ancho al PDF
            const imgProps = doc.getImageProperties(imgData);
            const pdfWidth = pageWidth - 30; // 15mm margenes
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

            doc.text("Captura del Dashboard (Screenshot):", 15, 50);
            doc.addImage(imgData, 'PNG', 15, 55, pdfWidth, pdfHeight);

            // 3. Añadir nueva página para datos detallados
            doc.addPage();
            doc.text("Historial de Búsquedas Recientes", 15, 20);

            if (searchHistory.length > 0) {
                doc.autoTable({
                    startY: 25,
                    head: [['Hora', 'Búsqueda (Query)', 'Resultados Encontrados']],
                    body: searchHistory.map(h => [h.time, h.query, h.count]),
                    theme: 'striped'
                });
            } else {
                doc.setFontSize(10);
                doc.text("No se realizaron búsquedas manuales durante esta sesión.", 15, 30);
            }

            let finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 20 : 40;

            doc.setFontSize(14);
            doc.text("Hotspots de Código (Archivos más inestables)", 15, finalY);

            doc.autoTable({
                startY: finalY + 5,
                head: [['Archivo', 'Impacto (Ediciones)']],
                body: currentData.metrics.churnRanking.map(i => [i.name, i.count]),
                theme: 'striped'
            });

            doc.save(`GIT-SEARCH-${el.currentRepoName.textContent}.pdf`);
        } catch (e) {
            console.error(e);
            alert("Error al generar PDF: " + e.message);
        } finally {
            showLoader(false);
        }
    }
});
