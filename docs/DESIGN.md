---
version: kit-theme
---

## Selected themes

| Theme | Canvas | Accent | Slug |
|-------|--------|--------|------|
| Binance | dark | #fcd535 | binance |
| BMW M | dark | #1c69d4 | bmw-m |
| Airbnb | light | #ff385c | airbnb |
| Airtable | light | #181d26 | airtable |

Full CSS variable definitions live in `DASHBOARD.html` under `body[data-theme="<slug>"]`
blocks (or `:root` for Framer). Copy those blocks into your app's stylesheet when
implementing the theme picker.

## Theme picker mandate

All frontend UI **must** include a theme picker that lets users switch between the themes
listed above at runtime. Apply a theme by setting `data-theme="<slug>"` on the root element
(`<html>` or `<body>`; Framer uses no attribute — it is the CSS `:root` default).
The default theme on first load should be **Binance**.
