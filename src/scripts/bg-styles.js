// Background Styles Configuration

const BgStyles = {
    // Solid / Subtle backgrounds
    solidStyles: {
        'Warm Cream': { class: 'bg-warm-cream' },
        'Cool Slate': { class: 'bg-cool-slate' },
        'Midnight': { class: 'bg-midnight' },
        'Soft Lavender': { class: 'bg-soft-lavender' },
        'Muted Sage': { class: 'bg-muted-sage' }
    },

    // Gradient backgrounds
    gradientStyles: {
        'Ocean Breeze': { class: 'bg-ocean-breeze' },
        'Sunset Horizon': { class: 'bg-sunset-horizon' },
        'Aurora Sky': { class: 'bg-aurora-sky' },
        'Forest Canopy': { class: 'bg-forest-canopy' },
        'Twilight Purple': { class: 'bg-twilight-purple' },
        'Rose Dawn': { class: 'bg-rose-dawn' },
        'Arctic Frost': { class: 'bg-arctic-frost' },
        'Golden Hour': { class: 'bg-golden-hour' }
    },

    // Pattern backgrounds
    patternStyles: {
        'Dot Grid': { class: 'bg-dot-grid' },
        'Graph Paper': { class: 'bg-graph-paper' },
        'Diagonal Lines': { class: 'bg-diagonal-lines' },
        'Honeycomb': { class: 'bg-honeycomb' },
        'Circuit Board': { class: 'bg-circuit-board' },
        'Topographic': { class: 'bg-topographic' }
    },

    // Textured backgrounds
    texturedStyles: {
        'Noise Grain': { class: 'bg-noise-grain' },
        'Linen Fabric': { class: 'bg-linen-fabric' },
        'Concrete': { class: 'bg-concrete' },
        'Paper': { class: 'bg-paper' },
        'Wood Grain': { class: 'bg-wood-grain' }
    },

    // Animated backgrounds
    animatedStyles: {
        'Gradient Shift': { class: 'bg-gradient-shift', animated: true },
        'Aurora Wave': { class: 'bg-aurora-wave', animated: true },
        'Plasma Pulse': { class: 'bg-plasma-pulse', animated: true },
        'Neon Glow': { class: 'bg-neon-glow', animated: true },
        'Starfield': { class: 'bg-starfield', animated: true },
        'Deep Ocean': { class: 'bg-deep-ocean', animated: true },
        'Cosmic Drift': { class: 'bg-cosmic-drift', animated: true },
        'Matrix Rain': { class: 'bg-matrix-rain', animated: true },
        'Solar Flare': { class: 'bg-solar-flare', animated: true },
        'Nebula Storm': { class: 'bg-nebula-storm', animated: true },
        'Electric Grid': { class: 'bg-electric-grid', animated: true },
        'Lava Lamp': { class: 'bg-lava-lamp', animated: true },
        'Wormhole': { class: 'bg-wormhole', animated: true },
        'Fireflies': { class: 'bg-fireflies', animated: true },
        'Thunderstorm': { class: 'bg-thunderstorm', animated: true },
        'Holographic Waves': { class: 'bg-holographic', animated: true },
        'Supernova': { class: 'bg-supernova', animated: true },
        'Ocean Abyss': { class: 'bg-ocean-abyss', animated: true },
        'Isometric City': { class: 'bg-isometric-city', animated: true }
    },

    // Modern backgrounds
    modernStyles: {
        'Glassmorphism': { class: 'bg-glassmorphism' },
        'Mesh Gradient': { class: 'bg-mesh-gradient' },
        'Duotone': { class: 'bg-duotone' },
        'Minimal Wave': { class: 'bg-minimal-wave' },
        'Bokeh': { class: 'bg-bokeh' }
    },

    // Unique / Awesome backgrounds
    uniqueStyles: {
        'Northern Lights': { class: 'bg-northern-lights', animated: true },
        'Cyber City': { class: 'bg-cyber-city' },
        'Retrowave': { class: 'bg-retrowave' },
        'Galaxy': { class: 'bg-galaxy', animated: true },
        'Liquid Chrome': { class: 'bg-liquid-chrome', animated: true }
    },

    getAllStyleNames() {
        return [
            ...Object.keys(this.solidStyles),
            ...Object.keys(this.gradientStyles),
            ...Object.keys(this.patternStyles),
            ...Object.keys(this.texturedStyles),
            ...Object.keys(this.animatedStyles),
            ...Object.keys(this.modernStyles),
            ...Object.keys(this.uniqueStyles)
        ];
    },

    getStyle(name) {
        return this.solidStyles[name] ||
               this.gradientStyles[name] ||
               this.patternStyles[name] ||
               this.texturedStyles[name] ||
               this.animatedStyles[name] ||
               this.modernStyles[name] ||
               this.uniqueStyles[name] ||
               null;
    },

    getStyleClass(name) {
        const style = this.getStyle(name);
        return style ? style.class : '';
    },

    applyStyle(container, styleName) {
        this.removeAllStyles(container);
        container.style.removeProperty('background-image');
        container.style.removeProperty('background-size');
        container.style.removeProperty('background-position');
        container.style.removeProperty('background-repeat');

        const style = this.getStyle(styleName);
        if (style) {
            container.classList.add(style.class);
        }
    },

    removeAllStyles(container) {
        const allClasses = [
            ...Object.values(this.solidStyles),
            ...Object.values(this.gradientStyles),
            ...Object.values(this.patternStyles),
            ...Object.values(this.texturedStyles),
            ...Object.values(this.animatedStyles),
            ...Object.values(this.modernStyles),
            ...Object.values(this.uniqueStyles)
        ].map(s => s.class);

        allClasses.forEach(cls => container.classList.remove(cls));
    },

    applyCustomImage(container, imageUrl) {
        this.removeAllStyles(container);
        container.style.backgroundImage = `url("${imageUrl.replace(/\\/g, '/')}")`;
        container.style.backgroundSize = 'cover';
        container.style.backgroundPosition = 'center';
        container.style.backgroundRepeat = 'no-repeat';
    },

    removeCustomImage(container) {
        container.style.removeProperty('background-image');
        container.style.removeProperty('background-size');
        container.style.removeProperty('background-position');
        container.style.removeProperty('background-repeat');
    },

    getStyleCategories() {
        return [
            { name: 'Solid / Subtle', styles: Object.keys(this.solidStyles) },
            { name: 'Gradients', styles: Object.keys(this.gradientStyles) },
            { name: 'Patterns', styles: Object.keys(this.patternStyles) },
            { name: 'Textures', styles: Object.keys(this.texturedStyles) },
            { name: 'Animated', styles: Object.keys(this.animatedStyles) },
            { name: 'Modern', styles: Object.keys(this.modernStyles) },
            { name: 'Unique', styles: Object.keys(this.uniqueStyles) }
        ];
    },

    isAnimated(name) {
        const style = this.getStyle(name);
        return style ? style.animated === true : false;
    }
};

window.BgStyles = BgStyles;
