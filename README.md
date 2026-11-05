# Steadfast Paws — Landing Page

Static landing page for Steadfast Paws (vetted, same-sitter-every-trip pet sitting).

- `index.html` — the full landing page (self-contained; images and fonts are bundled inline, React loads from unpkg).
- `netlify.toml` — tells Netlify to publish the repo root as-is. No build step.

## Deploy on Netlify

1. In Netlify, choose **Add new site → Import an existing project** and pick this repo.
2. Branch: `main`. Build command: leave empty. Publish directory: `.` (already set in `netlify.toml`).
3. Deploy.
