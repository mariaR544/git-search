const fs = require('fs');
const path = require('path');

const root = __dirname;
const dirs = ['src','config','logs','assets','docs'];
dirs.forEach(d => fs.mkdirSync(path.join(root, d), { recursive: true }));

function moveFile(src, dst) {
    try {
        if (fs.existsSync(src)) {
            fs.renameSync(src, dst);
            console.log('Moved:', path.basename(src));
        }
    } catch(e) { console.log('Skip:', path.basename(src), e.message); }
}

// Source files
moveFile(path.join(root, 'app.js'),    path.join(root, 'src', 'app.js'));
moveFile(path.join(root, 'style.css'), path.join(root, 'src', 'style.css'));
moveFile(path.join(root, 'index.html'),path.join(root, 'src', 'index.html'));
moveFile(path.join(root, 'server.js'), path.join(root, 'src', 'server.js'));

// Config
moveFile(path.join(root, 'config.json'), path.join(root, 'config', 'config.json'));

// Logs
['err.log','error.log','out.log','output.log','server_debug.log','startup_check.txt'].forEach(f => {
    moveFile(path.join(root, f), path.join(root, 'logs', f));
});

// Remove temp test files
['check_git.js','new.js','test.txt','test_server.js','test_write_script.js'].forEach(f => {
    const fp = path.join(root, f);
    if (fs.existsSync(fp)) { fs.unlinkSync(fp); console.log('Deleted:', f); }
});

console.log('Restructure COMPLETE');
