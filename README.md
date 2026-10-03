# 🚀 Ride Bangla IT Team

<p align="center">
  <img src="assets/logo.png" alt="Ride Bangla IT Team Logo" width="180">
</p>

<h2 align="center">Ride Bangla IT Team — Apps, Web, Design & Digital Marketing</h2>

<p align="center">
  <strong>Ride Bangla Limited-এর IT Team-এর অফিসিয়াল স্ট্যাটিক ওয়েবসাইট</strong><br>
  বাংলা ও English bilingual presentation • Responsive • Vercel-ready
</p>

<p align="center">
  <a href="https://it.ridebangla.bd/">Live Website</a>
</p>

---

## 📌 Project Overview

**Ride Bangla IT Team** ওয়েবসাইটটি Ride Bangla Limited-এর IT Team-এর services, team, portfolio, company information এবং contact information সুন্দরভাবে উপস্থাপনের জন্য তৈরি।

বর্তমান project একটি **single-page static website** এবং এর প্রধান application file হলো:

```text
index.html
```

কোনো Node.js/React/Next.js build process বর্তমানে প্রয়োজন নেই। তাই Vercel-এ এটি static site হিসেবে সরাসরি deploy করা যায়।

---

## 🛠️ Technology

- **HTML5** — complete page structure
- **CSS3** — responsive layout, animations, cards, gradients এবং visual styling
- **Vanilla JavaScript** — language switching, interactions, portfolio rendering, form handling ও UI behaviour
- **PNG/JPEG assets** — logo, team, service, director এবং certificate visuals
- **JSON** — portfolio data source
- **Vercel** — static hosting/deployment target
- **GitHub** — source-code repository target

কোনো framework dependency বা `npm install`/`npm run build` requirement বর্তমানে নেই।

---

## 🗂️ Project Structure

```text
Ride-Bangla-It-Tim--main/
│
├── index.html
├── README.md
├── vercel.json
├── .gitignore
│
├── data/
│   └── portfolio.json
│
└── assets/
    ├── certificate.jpg
    ├── company-logo.png
    ├── director.png
    ├── favicon.png
    ├── logo.png
    ├── ridebangla-logo.png
    ├── services-it.jpg
    ├── services-main.jpg
    ├── team.jpg
    └── workspace.jpg              # Required by current design
```

> `portfolio/` এবং `videos/` asset directories-এর reference বর্তমান `index.html`-এ আছে, কিন্তু supplied project archive-এ সেগুলোর actual media files বর্তমানে নেই। নিচে বিস্তারিত দেওয়া আছে।

---

## 🎨 Logo & Image Mapping

| File | Exact Path | Usage |
|---|---|---|
| `logo.png` | `assets/logo.png` | Ride Bangla IT Team-এর প্রধান IT Team logo |
| `company-logo.png` | `assets/company-logo.png` | Main Ride Bangla Limited branding/hero logo |
| `ridebangla-logo.png` | `assets/ridebangla-logo.png` | Header-এর Ride Bangla logo |
| `favicon.png` | `assets/favicon.png` | Browser favicon |
| `services-main.jpg` | `assets/services-main.jpg` | Ride Bangla Limited-এর main services visual |
| `services-it.jpg` | `assets/services-it.jpg` | IT Services section visual |
| `team.jpg` | `assets/team.jpg` | IT Team photo |
| `director.png` | `assets/director.png` | Director profile image |
| `certificate.jpg` | `assets/certificate.jpg` | Certificate/achievement visual |
| `workspace.jpg` | `assets/workspace.jpg` | IT Team dark banner/background |

### Important

`index.html`-এর CSS বর্তমানে এই file-টি ব্যবহার করছে:

```text
assets/workspace.jpg
```

তাই final visual design সম্পূর্ণ করতে **`workspace.jpg` অবশ্যই একই path-এ থাকতে হবে**।

---

## 🧩 Website Sections

### 1. Ride Bangla Limited
- Company introduction
- Ride Share
- Food Delivery
- Parcel Delivery
- Courier
- Marketplace
- Medicine Delivery
- IT Services
- Ride Bangla Pay

### 2. IT Team Hero
- Ride Bangla IT Team branding
- Apps
- Web
- Design
- Digital Marketing

### 3. IT Services
- Web Application
- Mobile Application
- UI/UX Design
- Graphic Design
- Logo Design
- Background Removal
- Digital Marketing
- Hosting & Domain
- Email Solution
- IT Support

### 4. IT Team
বর্তমান HTML-এ নিম্নোক্ত role presentation আছে:

- IT Support Engineer
- UI/UX Designer
- Full Stack Developer
- Web Developer
- Database Administrator

### 5. Our Work
দুটি portfolio category রাখা হয়েছে:

- Design Works
- Work Videos

### 6. About
- Ride Bangla IT Team পরিচিতি
- Director profile
- Certificate/achievement

### 7. Contact
- Contact information
- WhatsApp
- Email
- Social links
- Contact form

---

## 🌐 Language Support

Website-এর UI-তে বাংলা এবং English language switching-এর ব্যবস্থা আছে।

Default language:

```text
বাংলা
```

Language switch করলে:

```text
বাংলা ↔ English
```

interface text পরিবর্তন হয়।

---

## 📱 Responsive Design

Websiteটি desktop, tablet এবং mobile viewport-এর জন্য responsive CSS ব্যবহার করে তৈরি।

মূল responsive areas:

- Navigation
- Hero sections
- Service cards
- Team cards
- Director section
- Portfolio cards
- Contact section

---

## 🖼️ Portfolio System

`index.html` বর্তমানে এই data source ব্যবহার করে:

```text
data/portfolio.json
```

এবং fallback হিসেবে HTML-এর ভিতরে default portfolio data রাখা আছে।

Portfolio JSON structure:

```json
{
  "designs": [],
  "videos": []
}
```

Design item:

```json
{
  "src": "assets/portfolio/example.jpg",
  "title": {
    "bn": "বাংলা শিরোনাম",
    "en": "English Title"
  },
  "tag": "Web Design"
}
```

Video item:

```json
{
  "src": "assets/videos/work-1.mp4",
  "poster": "assets/videos/work-1.jpg",
  "title": {
    "bn": "বাংলা শিরোনাম",
    "en": "English Title"
  }
}
```

---

## ⚠️ Current Asset Audit

ZIP integrity পরীক্ষা করে দেখা হয়েছে এবং archive corruption পাওয়া যায়নি।

বর্তমান archive-এ থাকা প্রধান files:

```text
index.html
assets/certificate.jpg
assets/company-logo.png
assets/director.png
assets/favicon.png
assets/logo.png
assets/ridebangla-logo.png
assets/services-it.jpg
assets/services-main.jpg
assets/team.jpg
```

### Missing files referenced by the current code

#### Required by CSS

```text
assets/workspace.jpg
```

#### Referenced portfolio data

```text
assets/portfolio/
```

এর মধ্যে বর্তমানে HTML-এর default data অনুযায়ী 11টি design image reference আছে।

#### Referenced video media

```text
assets/videos/
```

এর মধ্যে 7টি MP4 এবং তাদের poster image reference আছে।

### Important conclusion

Website-এর মূল HTML/CSS/JS structure static deployment-এর জন্য প্রস্তুত হলেও **portfolio media এবং `workspace.jpg` না দিলে সব visual reference সম্পূর্ণ হবে না**।

---

## 🚀 Vercel Deployment

এই project-এর জন্য কোনো framework build command প্রয়োজন নেই।

### Vercel settings

```text
Framework Preset: Other
Build Command: None
Output Directory: .
Install Command: None
```

Root directory:

```text
/
```

Entry point:

```text
index.html
```

`vercel.json` রাখা হয়েছে deployment behaviour স্পষ্ট রাখার জন্য।

---

## 🔧 Local Test

যেকোনো static HTTP server দিয়ে চালানো যায়।

উদাহরণ:

```bash
python3 -m http.server 8000
```

তারপর:

```text
http://localhost:8000/
```

> `file://` দিয়ে সরাসরি `index.html` খোলার পরিবর্তে HTTP server ব্যবহার করা ভালো, কারণ portfolio JSON `fetch()` করে load করা হয়।

---

## 📦 GitHub Upload

Repository root-এ এগুলো রাখতে হবে:

```text
index.html
README.md
vercel.json
.gitignore
data/portfolio.json
assets/
```

GitHub-এ repository open করলে README-তে উপরের IT Team logo automatically দেখা যাবে:

```text
assets/logo.png
```

---

## 🔐 Security / Configuration

বর্তমান static project-এ কোনো server-side secret বা API key রাখা হয়নি।

যদি ভবিষ্যতে admin portfolio API যুক্ত করা হয়, তাহলে secret/API key কখনো `index.html`-এর client-side JavaScript-এ রাখা উচিত নয়।

---

## 📍 Production Checklist

Before final production deployment:

- [x] ZIP integrity verified
- [x] `index.html` present
- [x] Main logos present
- [x] Team image present
- [x] Director image present
- [x] Certificate image present
- [x] IT services image present
- [x] Main services image present
- [x] Favicon present
- [x] Static Vercel configuration prepared
- [x] GitHub README prepared
- [x] Portfolio JSON prepared
- [ ] `assets/workspace.jpg` added
- [ ] `assets/portfolio/*` media added
- [ ] `assets/videos/*` media added
- [ ] Final production visual QA

---

## 📄 License / Ownership

© Ride Bangla Limited. All rights reserved.

This project is intended for Ride Bangla Limited / Ride Bangla IT Team use unless otherwise authorized.

---

<p align="center">
  <strong>Ride Bangla IT Team</strong><br>
  Apps • Web • Design • Digital Marketing • IT Solutions
</p>
