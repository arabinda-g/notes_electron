// Group Box Styles Configuration

const GroupStyles = {
    // Static styles
    staticStyles: {
        'Gradient Glass': { class: 'style-gradient-glass' },
        'Neon Glow': { class: 'style-neon-glow' },
        'Embossed': { class: 'style-embossed' },
        'Retro': { class: 'style-retro' },
        'Card': { class: 'style-card' },
        'Minimal': { class: 'style-minimal' },
        'Dashed': { class: 'style-dashed' },
        'Double Border': { class: 'style-double-border' },
        'Shadow Panel': { class: 'style-shadow-panel' },
        'Rounded Neon': { class: 'style-rounded-neon' },
        'Holographic': { class: 'style-holographic' },
        'Vintage Paper': { class: 'style-vintage-paper' },
        'Liquid Metal': { class: 'style-liquid-metal' },
        'Cosmic': { class: 'style-cosmic' },
        'Rainbow Spectrum': { class: 'style-rainbow-spectrum' }
    },

    // Animated styles
    animatedStyles: {
        'Aurora Borealis': { class: 'style-aurora', animated: true },
        'Cyber Circuit': { class: 'style-cyber-circuit', animated: true },
        'Fire Lava': { class: 'style-fire-lava', animated: true },
        'Matrix Rain': { class: 'style-matrix', animated: true },
        'Crystal Ice': { class: 'style-crystal-ice' },
        'Plasma Energy': { class: 'style-plasma', animated: true },
        'Ocean Wave': { class: 'style-ocean-wave', animated: true },
        'Electric Storm': { class: 'style-electric-storm', animated: true },
        'Starfield Warp': { class: 'style-starfield' },
        'Heartbeat Pulse': { class: 'style-heartbeat', animated: true },
        'Snowfall': { class: 'style-snowfall' },
        'Cloud Drift': { class: 'style-cloud-drift' },
        'Sparkle Shine': { class: 'style-sparkle', animated: true },
        'Ripple Water': { class: 'style-ripple-water' },
        'Bubbles Float': { class: 'style-bubbles' },
        'Confetti Party': { class: 'style-confetti' },
        'Sunburst Rays': { class: 'style-sunburst' },
        'Cherry Blossom': { class: 'style-cherry-blossom' },
        'Floating Hearts': { class: 'style-floating-hearts' }
    },

    // Get all style names
    getAllStyleNames() {
        return [
            ...Object.keys(this.staticStyles),
            ...Object.keys(this.animatedStyles)
        ];
    },

    // Get style by name
    getStyle(name) {
        return this.staticStyles[name] || this.animatedStyles[name] || null;
    },

    // Get CSS class for style name
    getStyleClass(name) {
        const style = this.getStyle(name);
        return style ? style.class : '';
    },

    // Apply style to group element
    applyStyle(group, styleName) {
        // Remove all existing style classes
        const allClasses = [
            ...Object.values(this.staticStyles),
            ...Object.values(this.animatedStyles)
        ].map(s => s.class);

        allClasses.forEach(cls => group.classList.remove(cls));

        const style = this.getStyle(styleName);
        if (style) {
            group.classList.add(style.class);
        }
    },

    // Remove all styles from group
    removeAllStyles(group) {
        const allClasses = [
            ...Object.values(this.staticStyles),
            ...Object.values(this.animatedStyles)
        ].map(s => s.class);

        allClasses.forEach(cls => group.classList.remove(cls));
    },

    // Get style categories for submenu
    getStyleCategories() {
        return [
            { name: 'Static', styles: Object.keys(this.staticStyles) },
            { name: 'Animated', styles: Object.keys(this.animatedStyles) }
        ];
    },

    // Check if style is animated
    isAnimated(name) {
        const style = this.animatedStyles[name];
        return style ? style.animated === true : false;
    }
};

window.GroupStyles = GroupStyles;
