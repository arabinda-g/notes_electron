// Button Styles Configuration

const ButtonStyles = {
    // Color-based styles (map style name to colors and class)
    colorStyles: {
        'Classic Blue': { bg: '#3498DB', text: '#FFFFFF', class: 'style-classic-blue' },
        'Pastel Pink': { bg: '#FADBD8', text: '#922B21', class: 'style-pastel-pink' },
        'Dark Mode': { bg: '#2C3E50', text: '#ECF0F1', class: 'style-dark-mode' },
        'Neon Green': { bg: '#27AE60', text: '#FFFFFF', class: 'style-neon-green' },
        'Earth Tones': { bg: '#D4AC6E', text: '#3E2723', class: 'style-earth-tones' },
        'Ocean Blue': { bg: '#5DADE2', text: '#FFFFFF', class: 'style-ocean-blue' },
        'Sunset Orange': { bg: '#F39C12', text: '#FFFFFF', class: 'style-sunset-orange' },
        'Monochrome': { bg: '#BDC3C7', text: '#2C3E50', class: 'style-monochrome' },
        'Vibrant Purple': { bg: '#9B59B6', text: '#FFFFFF', class: 'style-vibrant-purple' }
    },

    // 3D effect styles
    effectStyles: {
        '3D Gradient': { class: 'style-3d-gradient' },
        'Glossy 3D': { class: 'style-glossy-3d' },
        'Embossed': { class: 'style-embossed' },
        'Raised Button': { class: 'style-raised-button' },
        'Inset Shadow': { class: 'style-inset-shadow' }
    },

    // Theme styles
    themeStyles: {
        'Retro 80s': { class: 'style-retro-80s' },
        'Cyberpunk': { class: 'style-cyberpunk' },
        'Glassmorphism': { class: 'style-glassmorphism' },
        'Neon Glow': { class: 'style-neon-glow' },
        'Golden Premium': { class: 'style-golden-premium' }
    },

    // Text/minimal styles
    textStyles: {
        'Minimal Clean': { class: 'style-minimal-clean' },
        'Bold Impact': { class: 'style-bold-impact' },
        'Elegant Serif': { class: 'style-elegant-serif' },
        'Playful Comic': { class: 'style-playful-comic' },
        'Professional': { class: 'style-professional' }
    },

    // Button type styles (from .NET custom buttons)
    buttonTypes: {
        'Gradient': { class: 'style-gradient' },
        'Neon': { class: 'style-neon-glow' },
        'Material': { class: 'style-material' },
        'Glass': { class: 'style-glass' },
        'Neumorphism': { class: 'style-neumorphism' },
        'Retro 3D': { class: 'style-retro-3d' },
        'Premium Card': { class: 'style-premium-card' },
        'Outline': { class: 'style-outline' },
        'Pill': { class: 'style-pill' },
        'Skeuomorphic': { class: 'style-skeuomorphic' }
    },

    // Get all style names
    getAllStyleNames() {
        return [
            ...Object.keys(this.colorStyles),
            ...Object.keys(this.effectStyles),
            ...Object.keys(this.themeStyles),
            ...Object.keys(this.textStyles)
        ];
    },

    // Get style by name
    getStyle(name) {
        return this.colorStyles[name] || 
               this.effectStyles[name] || 
               this.themeStyles[name] || 
               this.textStyles[name] ||
               this.buttonTypes[name] ||
               null;
    },

    // Get CSS class for style name
    getStyleClass(name) {
        const style = this.getStyle(name);
        return style ? style.class : '';
    },

    // Apply style to button element
    applyStyle(button, styleName, preserveColors = false) {
        // Remove all existing style classes
        const allClasses = [
            ...Object.values(this.colorStyles),
            ...Object.values(this.effectStyles),
            ...Object.values(this.themeStyles),
            ...Object.values(this.textStyles),
            ...Object.values(this.buttonTypes)
        ].map(s => s.class);

        allClasses.forEach(cls => button.classList.remove(cls));

        const style = this.getStyle(styleName);
        if (style) {
            button.classList.add(style.class);
            
            // Apply colors if this is a color style and we're not preserving
            if (!preserveColors && style.bg) {
                button.style.setProperty('--btn-bg', style.bg);
                button.style.setProperty('--btn-text', style.text);
            }
        }
    },

    // Remove all styles from button
    removeAllStyles(button) {
        const allClasses = [
            ...Object.values(this.colorStyles),
            ...Object.values(this.effectStyles),
            ...Object.values(this.themeStyles),
            ...Object.values(this.textStyles),
            ...Object.values(this.buttonTypes)
        ].map(s => s.class);

        allClasses.forEach(cls => button.classList.remove(cls));
    },

    // Get style categories for submenu
    getStyleCategories() {
        return [
            { name: 'Colors', styles: Object.keys(this.colorStyles) },
            { name: '3D Effects', styles: Object.keys(this.effectStyles) },
            { name: 'Themes', styles: Object.keys(this.themeStyles) },
            { name: 'Text Styles', styles: Object.keys(this.textStyles) }
        ];
    }
};

window.ButtonStyles = ButtonStyles;
