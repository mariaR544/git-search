/**
 * GIT-SEARCH Backend Engine
 * Advanced Analytics for Git Repositories
 */

const express = require('express');
const cors = require('cors');
const { exec, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const Groq = require('groq-sdk');

// Log de inicio ultra-temprano
fs.writeFileSync(path.join(__dirname, '../logs/startup_check.txt'), `GIT-SEARCH iniciado a las ${new Date().toISOString()}\n`);

const os = require('os');
const app = express();
const PORT = 3005;
const TEMP_DIR = path.join(os.tmpdir(), 'git_search_repos');
const CONFIG_FILE = path.join(__dirname, '../config/config.json');

// Cargar configuración persistente
function loadConfig() {
    if (fs.existsSync(CONFIG_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        } catch (e) {
            console.error('Error reading config:', e);
        }
    }
    return { gitPath: 'git' };
}

function saveConfig(config) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

let currentConfig = loadConfig();
const DEBUG_LOG = path.join(__dirname, '../logs/server_debug.log');

function logDebug(msg) {
    const time = new Date().toISOString();
    const entry = `[${time}] ${msg}\n`;
    try {
        if (!fs.existsSync(path.dirname(DEBUG_LOG))) fs.mkdirSync(path.dirname(DEBUG_LOG), { recursive: true });
        fs.appendFileSync(DEBUG_LOG, entry);
    } catch (e) {
        console.error('Error writing to debug log:', e);
    }
    console.log(msg);
}

// Ruta Fija y Permanente de Git solicitada por el usuario
const FIXED_GIT_PATH = 'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\Common7\\IDE\\CommonExtensions\\Microsoft\\TeamFoundation\\Team Explorer\\Git\\cmd\\git.exe';

const commonGitPaths = [
    FIXED_GIT_PATH,
    'git', // PATH del sistema
    'C:\\Program Files\\Git\\cmd\\git.exe',
    'C:\\Program Files\\Git\\bin\\git.exe',
    'C:\\Program Files (x86)\\Git\\cmd\\git.exe',
    path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Git', 'cmd', 'git.exe')
];

function checkGit() {
    for (const p of commonGitPaths) {
        try {
            execSync(`"${p}" --version`, { stdio: 'ignore' });
            return p;
        } catch (e) {
            // console.log(`Git not found at: ${p}`);
        }
    }
    return null;
}

let GIT_BIN = checkGit();

if (GIT_BIN) {
    currentConfig.gitPath = GIT_BIN;
    saveConfig(currentConfig);
} else {
    console.error('ERROR: Git executable not found. Please ensure Git is installed and accessible via PATH or specify its path in config.json.');
    process.exit(1);
}

console.log('--- GIT-SEARCH CORE ENGINE ---');
console.log(`Puerto: ${PORT} | Git: ${currentConfig.gitPath}`);
logDebug(`Usando ejecutable Git: ${currentConfig.gitPath}`);

if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

process.on('uncaughtException', (err) => logDebug(`Excepción no capturada: ${err.stack}`));
process.on('unhandledRejection', (reason) => logDebug(`Rechazo no manejado: ${reason}`));

function ejecutarComandoGit(comando, repoPath) {
    // RUTA FIJA Y PERMANENTE: Se ignora cualquier mala configuración si la fija existe
    const gitExec = fs.existsSync(FIXED_GIT_PATH) ? FIXED_GIT_PATH : (GIT_BIN || currentConfig.gitPath || 'git');
    const cmdFinal = comando.startsWith('git ') 
        ? `"${gitExec}" ${comando.substring(4)}` 
        : comando;

    return new Promise((resolve, reject) => {
        exec(cmdFinal, {
            cwd: path.resolve(repoPath),
            maxBuffer: 1024 * 1024 * 50,
            windowsHide: true,
            shell: true // Dejar que Node use el shell por defecto (cmd.exe)
        }, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(stderr || error.message));
                return;
            }
            resolve(stdout || '');
        });
    });
}

const repoLocks = {};
// Prepara el repositorio (clona si es remoto, valida si es local)
/**
 * Prepara el repositorio (clona si es remoto, valida si es local)
 */
async function prepararRepositorio(inputPath) {
    let finalPath = inputPath.trim();
    logDebug(`>> PrepararRepositorio: "${finalPath}"`);
    
    if (finalPath.includes('github.com') && !finalPath.startsWith('http') && !finalPath.startsWith('git@')) {
        finalPath = `https://${finalPath}`;
    }

    const isUrl = finalPath.startsWith('http') || finalPath.startsWith('git@');

    if (!isUrl) {
        const absolutePath = path.isAbsolute(finalPath) ? finalPath : path.resolve(process.cwd(), finalPath);
        if (!fs.existsSync(absolutePath)) throw new Error(`La ruta local no existe: ${absolutePath}`);
        try {
            await ejecutarComandoGit('git rev-parse --is-inside-work-tree', absolutePath);
            return absolutePath;
        } catch (e) {
            throw new Error(`La ruta no es un repositorio Git válido: ${absolutePath}`);
        }
    }

    const repoName = finalPath.split('/').pop().replace('.git', '').replace(/[^a-zA-Z0-9_-]/g, '_');
    const localPath = path.join(TEMP_DIR, repoName);

    if (repoLocks[localPath]) {
        await repoLocks[localPath];
        return localPath;
    }

    const performPreparation = async () => {
        if (fs.existsSync(localPath)) {
            try {
                await ejecutarComandoGit('git fetch --all', localPath);
                await ejecutarComandoGit('git reset --hard FETCH_HEAD --quiet', localPath);
            } catch (e) {
                fs.rmSync(localPath, { recursive: true, force: true });
                await ejecutarComandoGit(`git clone --depth 1 ${finalPath} ${repoName}`, TEMP_DIR);
            }
        } else {
            await ejecutarComandoGit(`git clone --depth 1 ${finalPath} ${repoName}`, TEMP_DIR);
        }
    };

    repoLocks[localPath] = performPreparation();
    try {
        await repoLocks[localPath];
    } finally {
        setTimeout(() => { delete repoLocks[localPath]; }, 10000);
    }

    return localPath;
}

/**
 * API: Analizar Commits y Metatada Avanzada
 */
app.get('/api/analytics', async (req, res) => {
    let repoPath = req.query.path || process.cwd();
    try {
        repoPath = await prepararRepositorio(repoPath);
        
        const format = 'COMMIT_START::%H::%an::%ae::%ad::%as::%s';
        const logData = await ejecutarComandoGit(`git --no-pager log --pretty=format:"${format}" --numstat`, repoPath);
        
        const commits = [];
        const churnMap = {};
        const coAuthMap = {};
        const heatmapData = {}; // keyed by YYYY-MM-DD
        
        const blocks = logData.split('COMMIT_START::').filter(Boolean);

        blocks.forEach(block => {
            const lines = block.split('\n').filter(l => l.trim());
            if (lines.length === 0) return;

            const [meta, ...fileLines] = lines;
            const metaParts = meta.split('::');
            if (metaParts.length < 6) return;

            const [hash, author, email, dateRaw, dateISO, subject] = metaParts;
            const commitDate = new Date(dateRaw);
            const dateStr = dateISO; // YYYY-MM-DD

            // Update Heatmap
            heatmapData[dateStr] = (heatmapData[dateStr] || 0) + 1;

            const commit = {
                hash,
                autor: author,
                email,
                fecha: commitDate,
                dateStr,
                mensaje: subject,
                archivos: []
            };

            const touchedFiles = [];

            fileLines.forEach(fLine => {
                const parts = fLine.split(/\s+/);
                if (parts.length >= 3) {
                    const [added, deleted, name] = parts;
                    const additions = (added === '-' ? 0 : parseInt(added)) || 0;
                    const deletions = (deleted === '-' ? 0 : parseInt(deleted)) || 0;
                    
                    commit.archivos.push({ adiciones: additions, eliminaciones: deletions, nombre: name });
                    touchedFiles.push(name);

                    // Update Churn
                    churnMap[name] = (churnMap[name] || 0) + 1;
                }
            });

            // Co-author detection (Simplified: authors working on same files in same commit range)
            // For a single commit we just track author-file affinity
            if (!coAuthMap[author]) coAuthMap[author] = new Set();
            touchedFiles.forEach(f => coAuthMap[author].add(f));

            commits.push(commit);
        });

        // Calculate Churn Ranking
        const churnRanking = Object.entries(churnMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([name, count]) => ({ name, count }));

        // Calculate Collaboration Synergy (Authors sharing files)
        const authors = Object.keys(coAuthMap);
        const synergy = [];
        for (let i = 0; i < authors.length; i++) {
            for (let j = i + 1; j < authors.length; j++) {
                const a1 = authors[i];
                const a2 = authors[j];
                const shared = [...coAuthMap[a1]].filter(f => coAuthMap[a2].has(f));
                if (shared.length > 0) {
                    synergy.push({ source: a1, target: a2, weight: shared.length });
                }
            }
        }

        // AI Insight Generation (Local)
        const aiInsights = generateInsights({ commits, churnRanking, synergy });

        res.json({ 
            commits, 
            metrics: { 
                churnRanking, 
                synergy, 
                heatmapData,
                aiInsights 
            } 
        });
    } catch (err) {
        res.status(500).json({ error: 'GIT-SEARCH: Error en análisis: ' + err.message });
    }
});

function generateInsights({ commits, churnRanking, synergy }) {
    const insights = [];
    
    // Insight 1: High Churn
    if (churnRanking.length > 0) {
        const topFile = churnRanking[0];
        if (topFile.count > 10) {
            insights.push({
                type: 'warning',
                text: `El archivo **${topFile.name}** presenta una inestabilidad crítica (${topFile.count} modificaciones). Considera refactorizar para reducir la deuda técnica.`
            });
        }
    }

    // Insight 2: Activity pattern
    const total = commits.length;
    if (total > 0) {
        const topAuthor = [...new Set(commits.map(c => c.autor))].sort((a,b) => 
            commits.filter(c => c.autor === b).length - commits.filter(c => c.autor === a).length
        )[0];
        insights.push({
            type: 'info',
            text: `**${topAuthor}** es el motor principal del repositorio. Su conocimiento es clave para este proyecto.`
        });
    }

    // Insight 3: Synergy
    if (synergy.length > 0) {
        const bestDuo = synergy.sort((a, b) => b.weight - a.weight)[0];
        insights.push({
            type: 'success',
            text: `Detectada alta sinergia entre **${bestDuo.source}** y **${bestDuo.target}**. Colaboran estrechamente en los mismos módulos.`
        });
    } else if (commits.length > 20) {
        insights.push({
            type: 'neutral',
            text: "El equipo trabaja de forma aislada. Podría ser útil fomentar más revisiones de código cruzadas."
        });
    }

    return insights;
}

app.get('/api/search', async (req, res) => {
    const { path: repoPath, query } = req.query;
    if (!query) return res.json({ commits: [] });
    
    try {
        const finalPath = await prepararRepositorio(repoPath || process.cwd());
        const data = await ejecutarComandoGit(`git log --grep="${query}" --pretty=format:"%H::%an::%ad::%s"`, finalPath);
        const commits = data.split('\n').filter(Boolean).map(line => {
            const [hash, author, date, subject] = line.split('::');
            return { hash, author, date, subject };
        });
        res.json({ commits });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/tree', async (req, res) => {
    let repoPath = req.query.path || process.cwd();
    try {
        repoPath = await prepararRepositorio(repoPath);
        const output = await ejecutarComandoGit('git --no-pager ls-tree -r --name-only HEAD', repoPath);
        const files = output.split('\n').filter(Boolean);
        res.json({ files });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/config', (req, res) => {
    res.json(currentConfig);
});

app.post('/api/config', express.json(), (req, res) => {
    const { gitPath, groqKey, groqModel } = req.body;
    if (gitPath !== undefined) currentConfig.gitPath = gitPath;
    if (groqKey !== undefined) currentConfig.groqKey = groqKey;
    if (groqModel !== undefined) currentConfig.groqModel = groqModel;
    saveConfig(currentConfig);
    res.json({ success: true, config: currentConfig });
});

app.get('/api/download-zip', async (req, res) => {
    try {
        const queryPath = req.query.path;
        if (!queryPath) return res.status(400).send('Ruta de repositorio requerida');
        
        // Clona si es remoto, o usa el local si ya existe
        const finalPath = await prepararRepositorio(queryPath);
        
        const folderName = path.basename(finalPath);
        res.attachment(`${folderName}-source.zip`);
        
        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.on('error', err => { throw err; });
        archive.pipe(res);
        
        archive.glob('**/*', {
            cwd: finalPath,
            ignore: ['**/.git/**']
        });
        
        await archive.finalize();
    } catch (err) {
        if (!res.headersSent) res.status(500).send("Error generando ZIP: " + err.message);
    }
});

app.post('/api/chat', express.json({ limit: '50mb' }), async (req, res) => {
    try {
        const { message, context } = req.body;
        const key = currentConfig.groqKey;
        if (!key) return res.status(401).json({ error: "Falta Groq API Key. Ve a Configuración y agrega tu clave gratuita de https://console.groq.com" });
        
        const groq = new Groq({ apiKey: key });
        const modelName = currentConfig.groqModel || "llama3-8b-8192";
        
        const systemPrompt = `Eres GIT-SEARCH AI, un asistente experto en ingeniería de software.
        El usuario está analizando un repositorio Git con las siguientes métricas:
        - Commits analizados: ${context.commitsTotal}
        - Archivos más inestables (Churn): ${JSON.stringify(context.churnRanking)}
        - Pares con mayor colaboración: ${JSON.stringify(context.synergy)}
        - Total archivos: ${context.filesTotal}
        Responde en español, de forma clara y concisa (máx 3 párrafos). Sé técnico pero amigable.`;
        
        const completion = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: message }
            ],
            model: modelName,
            max_tokens: 600
        });
        
        res.json({ response: completion.choices[0].message.content });
    } catch (err) {
        let errMsg = err.message;
        if (err.message.includes('401')) errMsg = "Groq API Key inválida. Verifica tu clave en https://console.groq.com";
        if (err.message.includes('429')) errMsg = "Límite de solicitudes de Groq alcanzado. Espera unos segundos e intenta de nuevo.";
        res.status(500).json({ error: errMsg });
    }
});

app.get('/api/test-git', async (req, res) => {
    try {
        const output = await ejecutarComandoGit('git --version', process.cwd());
        res.json({ success: true, output });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`GIT-SEARCH OPERATIONAL :: http://localhost:${PORT}`);
});
