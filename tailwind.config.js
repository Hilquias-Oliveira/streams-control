/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'soft-bg': '#F3F4F6',
                'soft-white': '#FFFFFF',
                'soft-text': '#1F2937',
                'soft-brand': '#6366F1', // Indigo
            }
        },
    },
    plugins: [],
}
