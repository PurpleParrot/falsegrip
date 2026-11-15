import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Source is a full-bleed photo: no padding, so it fills the icon on every platform.
const full = { padding: 0, resizeOptions: { background: '#1d4552' } }

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, ...full },
    maskable: { ...minimal2023Preset.maskable, ...full },
    apple: { ...minimal2023Preset.apple, ...full },
  },
  images: ['assets/icon-source.png'],
})
