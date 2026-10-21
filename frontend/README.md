# Campus Customs frontend

React 19 + Vite + TypeScript. See the [main README](../README.md) for setup.

```bash
npm install
npm run dev     # http://localhost:5173 (proxies /api and /images to the backend on :8000)
npm run build   # production build in dist/
npm run lint    # oxlint
```

- `src/pages/`: Home, Products, product page, Cart, Checkout, About, Login, Create Account
- `src/components/`: nav bar, chat widget (Handsome Dan), product cards and filters, welcome splash, watercolor art
- `src/store/`: the 3D virtual store at `/store` (three.js + @react-three/fiber)
