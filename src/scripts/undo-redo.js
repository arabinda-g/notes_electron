// Undo/Redo System

class UndoRedoManager {
    constructor(maxLevels = 20) {
        this.maxLevels = maxLevels;
        this.undoStack = [];
        this.redoStack = [];
        this.isPerformingAction = false;
    }

    // Set max undo levels
    setMaxLevels(levels) {
        this.maxLevels = levels;
        this.trimStack();
    }

    // Save current state
    saveState(state, description = '') {
        if (this.isPerformingAction) return;

        // Clone the state
        const clonedState = Utils.deepClone(state);
        
        this.undoStack.push({
            state: clonedState,
            description: description,
            timestamp: Date.now()
        });

        // Clear redo stack on new action
        this.redoStack = [];

        // Trim if exceeds max
        this.trimStack();
    }

    // Trim stack to max levels
    trimStack() {
        while (this.undoStack.length > this.maxLevels) {
            this.undoStack.shift();
        }
    }

    // Undo last action
    undo(currentState) {
        if (this.undoStack.length === 0) return null;

        this.isPerformingAction = true;

        // Save current state to redo stack
        this.redoStack.push({
            state: Utils.deepClone(currentState),
            description: 'Redo',
            timestamp: Date.now()
        });

        // Pop and return previous state
        const previousState = this.undoStack.pop();
        
        this.isPerformingAction = false;
        
        return previousState.state;
    }

    // Redo last undone action
    redo(currentState) {
        if (this.redoStack.length === 0) return null;

        this.isPerformingAction = true;

        // Save current state to undo stack
        this.undoStack.push({
            state: Utils.deepClone(currentState),
            description: 'Undo',
            timestamp: Date.now()
        });

        // Pop and return redo state
        const redoState = this.redoStack.pop();
        
        this.isPerformingAction = false;
        
        return redoState.state;
    }

    // Check if can undo
    canUndo() {
        return this.undoStack.length > 0;
    }

    // Check if can redo
    canRedo() {
        return this.redoStack.length > 0;
    }

    // Clear all history
    clear() {
        this.undoStack = [];
        this.redoStack = [];
    }

    // Get undo stack size
    getUndoCount() {
        return this.undoStack.length;
    }

    // Get redo stack size
    getRedoCount() {
        return this.redoStack.length;
    }
}

window.UndoRedoManager = UndoRedoManager;
