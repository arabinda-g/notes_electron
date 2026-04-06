// CDP Test Runner for Notes Electron App
// Run with: node run-tests.js

const http = require('http');
const WebSocket = require('ws');

async function getPages() {
    return new Promise((resolve, reject) => {
        http.get('http://localhost:9222/json', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
            res.on('error', reject);
        }).on('error', reject);
    });
}

async function connectToPage(wsUrl) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(wsUrl);
        let id = 0;
        const callbacks = new Map();

        ws.on('open', () => {
            const send = (method, params = {}) => {
                return new Promise((res, rej) => {
                    const msgId = ++id;
                    callbacks.set(msgId, { resolve: res, reject: rej });
                    ws.send(JSON.stringify({ id: msgId, method, params }));
                });
            };
            resolve({ ws, send });
        });

        ws.on('message', (data) => {
            const msg = JSON.parse(data);
            if (msg.id && callbacks.has(msg.id)) {
                const { resolve, reject } = callbacks.get(msg.id);
                callbacks.delete(msg.id);
                if (msg.error) reject(msg.error);
                else resolve(msg.result);
            }
        });

        ws.on('error', reject);
    });
}

async function runTests() {
    console.log('=== Notes Electron App CDP Tests ===\n');

    try {
        const pages = await getPages();
        const notesPage = pages.find(p => p.title === 'Notes');
        
        if (!notesPage) {
            console.error('Notes page not found. Make sure the app is running with --remote-debugging-port=9222');
            process.exit(1);
        }

        console.log(`Connecting to: ${notesPage.title}`);
        const { ws, send } = await connectToPage(notesPage.webSocketDebuggerUrl);

        // Enable Runtime for evaluating JavaScript
        await send('Runtime.enable');

        const tests = [
            // Core objects
            ['App object exists', 'typeof App !== "undefined"'],
            ['Utils object exists', 'typeof Utils !== "undefined"'],
            ['Dialogs object exists', 'typeof Dialogs !== "undefined"'],
            ['ButtonStyles object exists', 'typeof ButtonStyles !== "undefined"'],
            ['GroupStyles object exists', 'typeof GroupStyles !== "undefined"'],

            // DOM elements
            ['Panel container exists', '!!document.getElementById("panel-container")'],
            ['Status bar exists', '!!document.getElementById("status-bar")'],
            ['Add Note dialog exists', '!!document.getElementById("add-note-dialog")'],
            ['Edit Note dialog exists', '!!document.getElementById("edit-note-dialog")'],
            ['Group dialog exists', '!!document.getElementById("group-dialog")'],
            ['Settings dialog exists', '!!document.getElementById("settings-dialog")'],
            ['About dialog exists', '!!document.getElementById("about-dialog")'],
            ['Font dialog exists', '!!document.getElementById("font-dialog")'],
            ['Note context menu exists', '!!document.getElementById("note-context-menu")'],
            ['Group context menu exists', '!!document.getElementById("group-context-menu")'],

            // Utils functions
            ['Utils.generateId works', 'Utils.generateId().startsWith("id_")'],
            ['Utils.getContrastColor works', 'Utils.getContrastColor("#FFFFFF") === "#000000"'],
            ['Utils.deepClone works', '(() => { const o = {a:1}; const c = Utils.deepClone(o); c.a = 2; return o.a === 1; })()'],

            // Styles
            ['ButtonStyles has 20+ styles', 'ButtonStyles.getAllStyleNames().length >= 20'],
            ['GroupStyles has 30+ styles', 'GroupStyles.getAllStyleNames().length >= 30'],

            // Data structure
            ['App.data exists', '!!App.data'],
            ['App.data.units exists', '!!App.data.units'],
            ['App.data.groups exists', '!!App.data.groups'],
            ['Notes exist', 'Object.keys(App.data.units).length > 0'],

            // Config
            ['Config exists', '!!App.getConfig()'],
            ['Config.general exists', '!!App.getConfig().general'],
            ['Config.hotkey exists', '!!App.getConfig().hotkey'],
            ['Config.window exists', '!!App.getConfig().window'],
            ['Config.unitStyle exists', '!!App.getConfig().unitStyle'],

            // Theme
            ['Theme is set', '["light", "dark"].includes(document.documentElement.getAttribute("data-theme"))'],

            // Undo manager
            ['UndoManager exists', '!!App.undoManager'],

            // Selection
            ['selectedNotes is a Set', 'App.selectedNotes instanceof Set'],

            // Methods exist
            ['App.addNote exists', 'typeof App.addNote === "function"'],
            ['App.updateNote exists', 'typeof App.updateNote === "function"'],
            ['App.deleteNote exists', 'typeof App.deleteNote === "function"'],
            ['App.addGroup exists', 'typeof App.addGroup === "function"'],
            ['App.updateGroup exists', 'typeof App.updateGroup === "function"'],
            ['App.deleteGroup exists', 'typeof App.deleteGroup === "function"'],
            ['App.undo exists', 'typeof App.undo === "function"'],
            ['App.redo exists', 'typeof App.redo === "function"'],
            ['App.showStatus exists', 'typeof App.showStatus === "function"'],
            ['App.saveData exists', 'typeof App.saveData === "function"'],
            ['Dialogs.showDialog exists', 'typeof Dialogs.showDialog === "function"'],
            ['Dialogs.closeDialog exists', 'typeof Dialogs.closeDialog === "function"'],
        ];

        let passed = 0;
        let failed = 0;

        for (const [name, expression] of tests) {
            try {
                const result = await send('Runtime.evaluate', { expression, returnByValue: true });
                if (result.result.value === true) {
                    console.log(`✓ ${name}`);
                    passed++;
                } else {
                    console.error(`✗ ${name}: returned ${result.result.value}`);
                    failed++;
                }
            } catch (e) {
                console.error(`✗ ${name}: ${e.message || e}`);
                failed++;
            }
        }

        // Test: Add a note
        console.log('\n--- Functional Tests ---');
        
        try {
            const addResult = await send('Runtime.evaluate', {
                expression: `
                    (() => {
                        const id = Utils.generateId();
                        const count = Object.keys(App.data.units).length;
                        App.addNote({
                            id, title: 'CDP Test Note', content: 'Test', contentType: 'Text',
                            backgroundColor: '#FF0000', textColor: '#FFF', fontFamily: 'Arial', fontSize: 12,
                            x: 150, y: 150, createdDate: new Date().toISOString(), modifiedDate: new Date().toISOString()
                        });
                        const newCount = Object.keys(App.data.units).length;
                        const elementExists = !!document.getElementById('note-' + id);
                        // Cleanup
                        delete App.data.units[id];
                        document.getElementById('note-' + id)?.remove();
                        return { success: newCount === count + 1 && elementExists, id };
                    })()
                `,
                returnByValue: true
            });
            if (addResult.result.value.success) {
                console.log('✓ Add note creates note and DOM element');
                passed++;
            } else {
                console.error('✗ Add note failed');
                failed++;
            }
        } catch (e) {
            console.error('✗ Add note test error:', e.message);
            failed++;
        }

        // Test: Show/hide dialog
        try {
            const dialogResult = await send('Runtime.evaluate', {
                expression: `
                    (() => {
                        Dialogs.showDialog('about-dialog');
                        const shown = document.getElementById('about-dialog').style.display === 'flex';
                        Dialogs.closeDialog('about-dialog');
                        const hidden = document.getElementById('about-dialog').style.display === 'none';
                        return shown && hidden;
                    })()
                `,
                returnByValue: true
            });
            if (dialogResult.result.value === true) {
                console.log('✓ Show/hide dialog works');
                passed++;
            } else {
                console.error('✗ Show/hide dialog failed');
                failed++;
            }
        } catch (e) {
            console.error('✗ Dialog test error:', e.message);
            failed++;
        }

        // Test: Status message
        try {
            const statusResult = await send('Runtime.evaluate', {
                expression: `
                    (() => {
                        App.showStatus('Test message from CDP');
                        return document.getElementById('status-label').textContent === 'Test message from CDP';
                    })()
                `,
                returnByValue: true
            });
            if (statusResult.result.value === true) {
                console.log('✓ Status message works');
                passed++;
            } else {
                console.error('✗ Status message failed');
                failed++;
            }
        } catch (e) {
            console.error('✗ Status message test error:', e.message);
            failed++;
        }

        console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
        
        ws.close();
        process.exit(failed > 0 ? 1 : 0);

    } catch (e) {
        console.error('Test runner error:', e);
        process.exit(1);
    }
}

runTests();
