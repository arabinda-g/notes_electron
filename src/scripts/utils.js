// Utility Functions

const Utils = {
    // Generate unique ID
    generateId() {
        return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 11);
    },

    // Deep clone object
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },

    // Debounce function
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Throttle function
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    // Get contrasting text color
    getContrastColor(hexColor) {
        if (!hexColor) return '#000000';
        const hex = hexColor.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance > 0.5 ? '#000000' : '#FFFFFF';
    },

    // Color to hex
    colorToHex(color) {
        if (!color) return '#FFFFFF';
        if (color.startsWith('#')) return color;
        if (color.startsWith('rgb')) {
            const match = color.match(/\d+/g);
            if (match && match.length >= 3) {
                const r = parseInt(match[0]).toString(16).padStart(2, '0');
                const g = parseInt(match[1]).toString(16).padStart(2, '0');
                const b = parseInt(match[2]).toString(16).padStart(2, '0');
                return `#${r}${g}${b}`;
            }
        }
        return color;
    },

    // ARGB integer to hex color
    argbToHex(argb) {
        if (typeof argb === 'string') return argb;
        const a = (argb >> 24) & 0xFF;
        const r = (argb >> 16) & 0xFF;
        const g = (argb >> 8) & 0xFF;
        const b = argb & 0xFF;
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    },

    // Hex to ARGB integer
    hexToArgb(hex, alpha = 255) {
        const cleaned = hex.replace('#', '');
        const r = parseInt(cleaned.substring(0, 2), 16);
        const g = parseInt(cleaned.substring(2, 4), 16);
        const b = parseInt(cleaned.substring(4, 6), 16);
        return (alpha << 24) | (r << 16) | (g << 8) | b;
    },

    // Check if rectangles overlap
    rectanglesOverlap(rect1, rect2) {
        return !(rect1.x + rect1.width <= rect2.x ||
                 rect2.x + rect2.width <= rect1.x ||
                 rect1.y + rect1.height <= rect2.y ||
                 rect2.y + rect2.height <= rect1.y);
    },

    // Check if point is inside rectangle
    pointInRect(x, y, rect) {
        return x >= rect.x && x <= rect.x + rect.width &&
               y >= rect.y && y <= rect.y + rect.height;
    },

    // Clamp value between min and max
    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    },

    // Format date
    formatDate(date) {
        if (!date) return '';
        const d = new Date(date);
        return d.toLocaleString();
    },

    // Truncate string with ellipsis
    truncate(str, maxLength) {
        if (!str || str.length <= maxLength) return str;
        return str.substring(0, maxLength - 3) + '...';
    },

    // Escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // Parse font string
    parseFont(fontStr) {
        const result = {
            family: 'Segoe UI',
            size: 12,
            bold: false,
            italic: false
        };

        if (!fontStr) return result;

        // Parse font family
        const familyMatch = fontStr.match(/^([^,]+)/);
        if (familyMatch) {
            result.family = familyMatch[1].trim();
        }

        // Parse size
        const sizeMatch = fontStr.match(/(\d+)pt/i);
        if (sizeMatch) {
            result.size = parseInt(sizeMatch[1]);
        }

        // Parse style
        result.bold = /bold/i.test(fontStr);
        result.italic = /italic/i.test(fontStr);

        return result;
    },

    // Build font string
    buildFontString(family, size, bold = false, italic = false) {
        let style = [];
        if (bold) style.push('Bold');
        if (italic) style.push('Italic');
        const styleStr = style.length ? `, ${style.join(' ')}` : '';
        return `${family}, ${size}pt${styleStr}`;
    },

    // Build CSS font
    buildCssFont(family, size, bold = false, italic = false) {
        let style = italic ? 'italic ' : '';
        let weight = bold ? 'bold ' : '';
        return `${style}${weight}${size}px "${family}"`;
    },

    // Get element bounds relative to container
    getRelativeBounds(element, container) {
        const elemRect = element.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        return {
            x: elemRect.left - containerRect.left + container.scrollLeft,
            y: elemRect.top - containerRect.top + container.scrollTop,
            width: elemRect.width,
            height: elemRect.height
        };
    },

    // Sort by date
    sortByDate(items, key = 'createdDate', ascending = true) {
        return [...items].sort((a, b) => {
            const dateA = new Date(a[key] || 0);
            const dateB = new Date(b[key] || 0);
            return ascending ? dateA - dateB : dateB - dateA;
        });
    },

    // Sort by color
    sortByColor(items, key = 'backgroundColor') {
        return [...items].sort((a, b) => {
            const colorA = a[key] || '#FFFFFF';
            const colorB = b[key] || '#FFFFFF';
            return colorA.localeCompare(colorB);
        });
    },

    // HSL to string for debugging
    hexToHsl(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (!result) return { h: 0, s: 0, l: 0 };
        
        let r = parseInt(result[1], 16) / 255;
        let g = parseInt(result[2], 16) / 255;
        let b = parseInt(result[3], 16) / 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }

        return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
    },

    // Button style name to CSS class
    styleToClass(styleName) {
        if (!styleName) return '';
        return 'style-' + styleName.toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');
    },

    // Map .NET button type to style
    mapButtonType(buttonType) {
        const mapping = {
            'GradientButton': 'gradient',
            'NeonGlowButton': 'neon-glow',
            'MaterialButton': 'material',
            'GlassMorphismButton': 'glass',
            'NeumorphismButton': 'neumorphism',
            'Retro3DButton': 'retro-3d',
            'PremiumCardButton': 'premium-card',
            'OutlineButton': 'outline',
            'PillButton': 'pill',
            'SkeuomorphicButton': 'skeuomorphic'
        };
        return mapping[buttonType] || '';
    },

    // Map .NET group type to style
    mapGroupType(groupType) {
        const mapping = {
            'GradientGlassGroupBox': 'gradient-glass',
            'NeonGlowGroupBox': 'neon-glow',
            'EmbossedGroupBox': 'embossed',
            'RetroGroupBox': 'retro',
            'CardGroupBox': 'card',
            'MinimalGroupBox': 'minimal',
            'DashedGroupBox': 'dashed',
            'DoubleBorderGroupBox': 'double-border',
            'ShadowPanelGroupBox': 'shadow-panel',
            'RoundedNeonGroupBox': 'rounded-neon',
            'HolographicGroupBox': 'holographic',
            'VintagePaperGroupBox': 'vintage-paper',
            'LiquidMetalGroupBox': 'liquid-metal',
            'CosmicGroupBox': 'cosmic',
            'RainbowSpectrumGroupBox': 'rainbow-spectrum',
            'AuroraBorealisGroupBox': 'aurora',
            'CyberCircuitGroupBox': 'cyber-circuit',
            'FireLavaGroupBox': 'fire-lava',
            'MatrixRainGroupBox': 'matrix',
            'CrystalIceGroupBox': 'crystal-ice',
            'PlasmaEnergyGroupBox': 'plasma',
            'OceanWaveGroupBox': 'ocean-wave',
            'ElectricStormGroupBox': 'electric-storm',
            'StarfieldWarpGroupBox': 'starfield',
            'HeartbeatPulseGroupBox': 'heartbeat',
            'SnowfallGroupBox': 'snowfall',
            'CloudDriftGroupBox': 'cloud-drift',
            'SparkleShineGroupBox': 'sparkle',
            'RippleWaterGroupBox': 'ripple-water',
            'BubblesFloatGroupBox': 'bubbles',
            'ConfettiPartyGroupBox': 'confetti',
            'SunburstRaysGroupBox': 'sunburst',
            'CherryBlossomGroupBox': 'cherry-blossom',
            'FloatingHeartsGroupBox': 'floating-hearts'
        };
        return mapping[groupType] || '';
    }
};

// Export for use in other modules
window.Utils = Utils;
