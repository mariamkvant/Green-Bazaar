# Green Bazaar — Developer Guide

## What is this project?
A plant marketplace website for Georgia (bazaar.green). Built with HTML/CSS/JavaScript for the frontend and Node.js + PostgreSQL for the backend. Deployed on Railway.

---

## How the pieces connect

```
Your Laptop (Kiro)
      ↓  push changes
   GitHub
(mariamkvant/Green-Bazaar)
      ↓  auto-deploys
   Railway
(green-bazaar-production.up.railway.app)
      ↓  connected to
   PostgreSQL Database
(stores users, listings, orders, messages)
      ↓  accessible at
   bazaar.green
```

---

## First time setup (do this once)

**Step 1 — Open terminal in Kiro**
- In Kiro: click Terminal (top menu) → New Terminal

**Step 2 — Download the project**
```
git clone https://github.com/mariamkvant/Green-Bazaar.git
```
A browser will open asking you to sign into GitHub. Sign in.

**Step 3 — Open the folder in Kiro**
- File → Open Folder → select the Green-Bazaar folder

Done! You now have the full project.

---

## How to make changes (every time)

```
1. Make changes in Kiro (edit files)
        ↓
2. Ask Kiro AI what you want to change
   (just describe it in plain English)
        ↓
3. Kiro makes the changes for you
        ↓
4. Push to GitHub (Kiro does this automatically,
   or you can ask "push my changes")
        ↓
5. Railway auto-deploys in ~2 minutes
        ↓
6. Visit bazaar.green to see your changes
```

---

## Key files to know

| File | What it does |
|------|-------------|
| `index.html` | The entire website structure |
| `styles.css` | All the visual design (colors, fonts, layout) |
| `app.js` | Frontend logic (what happens when you click things) |
| `store.js` | Connects frontend to the backend API |
| `i18n.js` | Translations (English, Georgian, French) |
| `funfacts.js` | Fun facts shown on plant detail pages |
| `server/index.ts` | Backend server entry point |
| `server/database.ts` | Database setup and tables |
| `server/routes/` | API endpoints (users, listings, orders, etc.) |

---

## How to ask Kiro for help

Just describe what you want in plain English. Examples:

- "Add a new filter for indoor plants"
- "Make the header font bigger"
- "Add a phone number field to the listing form"
- "Fix the bug where notifications don't show"
- "Add a new page for plant care tips"

Kiro will write the code and push it for you.

---

## Important accounts & access

| Service | What it's for | Who has access |
|---------|--------------|----------------|
| GitHub (mariamkvant/Green-Bazaar) | Code storage | Mariam + collaborators |
| Railway | Hosting & deployment | Mariam |
| GoDaddy | Domain (bazaar.green) | Mariam |
| Resend | Email sending | Mariam (Boomerang account) |
| PostgreSQL | Database | Auto-managed by Railway |

---

## If something breaks

1. Check Railway → Deployments → View logs (look for red errors)
2. Ask Kiro: "The deployment failed, here's the error: [paste error]"
3. Kiro will fix it and push again

---

## The database has these main tables

- **users** — everyone who registered
- **listings** — all plant listings
- **orders** — purchases (with escrow status)
- **messages** — chat between users
- **reviews** — ratings and photos after orders
- **disputes** — when something goes wrong
- **favorites** — saved listings
- **notifications** — in-app alerts

---

## Admin access

Mariam's account (mariamkvant@gmail.com) is the admin.
Go to bazaar.green → log in → click avatar → Admin Dashboard.
From there you can: verify users, resolve disputes, see platform stats.

---

## Quick reference — common tasks

**Add a new page:**
Ask Kiro: "Add a new page called [name] that shows [content]"

**Change colors:**
Edit `styles.css` — the color palette is at the top:
- Dark green: `#2A4139`
- Terracotta: `#B8704B`
- Cream background: `#F5F0E8`
- Sage: `#8B9E7C`

**Add a new API endpoint:**
Ask Kiro: "Add an API endpoint that [does something]"

**Update sample data:**
Call: `POST https://green-bazaar-production.up.railway.app/api/admin/reseed?secret=gb-admin-2026`
Then: `POST https://green-bazaar-production.up.railway.app/api/admin/seed?secret=gb-admin-2026`
