/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,html}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Rubik', 'Arial', 'sans-serif'],
      },
      colors: {
        /* ---------------------------------------------------------------
           Paper and ink.
           The surface family: warm off-white paper at the top of the ramp,
           warm near-black ink at the bottom. Nothing here is chromatic
           enough to compete with the accent.
           --------------------------------------------------------------- */
        sand: {
          50: '#faf7f2',
          100: '#f2ede4',
          200: '#e6ded1',
          300: '#d3c8b7',
          400: '#b0a494',
          500: '#7d7161',
          600: '#66594b',
          700: '#4e4438',
          800: '#3a322a',
          900: '#241f1a',
        },
        /* ---------------------------------------------------------------
           The single accent: aged brass / ochre. Wood and lacquer, not
           candy amber. Dark enough at 500 to carry white text.
           Named `honey` for backwards compatibility with templates.
           --------------------------------------------------------------- */
        honey: {
          50: '#fdf8ee',
          100: '#f7ead2',
          200: '#ecd5a9',
          300: '#dab97c',
          400: '#c49a4f',
          500: '#946927',
          600: '#7c5720',
          700: '#63451a',
          800: '#4d3616',
          900: '#3b2a13',
        },
        /* ---------------------------------------------------------------
           Secondary signal: slate. Cool, desaturated, used only for
           informational states (replay mode, the coach panel) so it never
           reads as success or danger. Replaces the old violet `orchid`;
           the name is kept because templates reference it.
           --------------------------------------------------------------- */
        orchid: {
          50: '#eff3f4',
          100: '#dde5e7',
          200: '#c0ced2',
          300: '#98aeb4',
          400: '#6b8892',
          500: '#4d6a75',
          600: '#405a64',
          700: '#354a53',
          800: '#2b3c43',
          900: '#223038',
        },
        /* Semantic only. Muted so they sit inside the warm palette instead
           of shouting out of it. These override Tailwind's defaults. */
        green: {
          50: '#f0f4ee',
          100: '#dee8db',
          200: '#c1d3bd',
          300: '#9bb695',
          400: '#71916c',
          500: '#4f7049',
          600: '#3f5c3b',
          700: '#334a31',
          800: '#2a3c28',
          900: '#213021',
        },
        rose: {
          50: '#fbf1ef',
          100: '#f6e0dc',
          200: '#ecc4bd',
          300: '#dc9a90',
          400: '#c46f63',
          500: '#a94f43',
          600: '#8f3f36',
          700: '#75342c',
          800: '#5c2a24',
          900: '#48211d',
        },
      },
      /* -----------------------------------------------------------------
         A deliberate radius ladder instead of one blob size for everything:
         small controls stay tight, panels open up, cards are the roundest.
         ----------------------------------------------------------------- */
      borderRadius: {
        'xl': '0.625rem',   // small controls, chips, dots
        '2xl': '0.75rem',   // buttons, icon tiles
        '3xl': '1rem',      // strips, toolbars, inner panels
        '4xl': '1.25rem',   // cards
        '5xl': '1.5rem',    // hero card
        'blob': '1.25rem',
      },
      /* -----------------------------------------------------------------
         Two elevations, not five.
         Level 1 (`soft`, `lift`) is a hairline lift for resting surfaces.
         Level 2 (`float`) is for things that genuinely leave the page:
         dialogs and the board.
         ----------------------------------------------------------------- */
      boxShadow: {
        'soft': '0 1px 2px rgba(36, 31, 26, 0.06), 0 2px 6px -4px rgba(36, 31, 26, 0.10)',
        'lift': '0 1px 2px rgba(36, 31, 26, 0.06), 0 2px 6px -4px rgba(36, 31, 26, 0.10)',
        'float': '0 2px 6px rgba(36, 31, 26, 0.08), 0 20px 44px -20px rgba(36, 31, 26, 0.38)',
        'inner-soft': 'inset 0 1px 0 rgba(255, 255, 255, 0.16)',
        'glow-honey': '0 0 0 3px rgba(148, 105, 39, 0.32)',
        'glow-orchid': '0 0 0 3px rgba(77, 106, 117, 0.30)',
      },
      /* -----------------------------------------------------------------
         Motion: short, mostly linear-ish, no overshoot. Entrances fade and
         travel a few pixels; nothing springs. The one animation allowed to
         have character is the piece drop, which lives on the board.
         ----------------------------------------------------------------- */
      keyframes: {
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.98)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-side': {
          '0%': { opacity: '0', transform: 'translateX(-5px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'breathe': {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'drop-in': {
          '0%': { opacity: '0', transform: 'scale(0.92)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'pop-in': 'pop-in 0.16s cubic-bezier(0.2, 0, 0, 1) both',
        'slide-up': 'slide-up 0.22s cubic-bezier(0.2, 0, 0, 1) both',
        'slide-side': 'slide-side 0.16s cubic-bezier(0.2, 0, 0, 1) both',
        'breathe': 'breathe 1.8s ease-in-out infinite',
        'shimmer': 'shimmer 2.4s linear infinite',
        'drop-in': 'drop-in 0.2s cubic-bezier(0.2, 0, 0, 1) both',
      },
      letterSpacing: {
        'label': '0.13em',
      },
    },
  },
  plugins: [],
}
