# Effortless CRM Marketing Website

Beautiful, conversion-optimized landing page and blog for Effortless CRM.

## Features

### Landing Page (index.html)
- **Hero Section**: Attention-grabbing headline with CTA and browser mockup
- **Features Grid**: 9 feature cards highlighting key capabilities
- **How It Works**: 3-step workflow visualization
- **Pricing**: 3-tier pricing with annual/monthly toggle (3 months free offer)
- **Testimonials**: Social proof from satisfied customers
- **CTA Section**: Email signup form

### Blog (blog.html)
- **Featured Article**: "Why Traditional CRMs Are Broken (And How We Fixed Them)"
- **Articles Grid**: 6 blog posts covering:
  - Voice commands and the future of sales software
  - Real cost of Salesforce
  - Why CRMs should live in Gmail
  - Product comparisons
  - Technical deep-dives
  - Sales automation tips

### Design
- Modern, clean design with purple gradient branding
- Fully responsive (mobile, tablet, desktop)
- Smooth animations and transitions
- Accessibility-friendly

## Setup

1. **Images**: Replace placeholder images in `/assets/` directory:
   - `hero-screenshot.png` - Screenshot of Effortless in Gmail
   - `workflow-*.png` - Workflow diagrams (optional)

2. **Backend Integration**: Update form submissions in `script.js`:
   - Signup form (line 15)
   - Newsletter form (add handler)

3. **Analytics**: Add Google Analytics or your tracking code

4. **Deployment**:
   - GitHub Pages: Push to `gh-pages` branch
   - Netlify: Connect repo and deploy
   - Vercel: Import project

## File Structure

```
website/
├── index.html          # Landing page
├── blog.html           # Blog page
├── styles.css          # Main styles
├── blog.css            # Blog-specific styles
├── script.js           # Interactive features
├── assets/             # Images and media
│   └── hero-screenshot.png
└── README.md           # This file
```

## Pricing Details

**Professional Plan (Featured)**
- Monthly: $35/user
- Annual: $26/user (25% savings)
- **Special Offer**: 3 months free with annual signup

**Annual Calculation**:
- 12 months × $26 = $312/year
- Plus 3 free months = 15 months for $312
- Effective monthly rate: $20.80/user

## Customization

### Colors
Edit CSS variables in `styles.css`:
```css
--primary: #667eea;
--secondary: #764ba2;
--accent: #f093fb;
```

### Copy
Update text directly in HTML files. Key sections:
- Hero headline: `index.html` line 32
- Pricing: `index.html` line 400+
- Blog articles: `blog.html` line 100+

## Performance

- Optimized CSS with minimal dependencies
- Lazy-loading for images (add `loading="lazy"`)
- Minify CSS/JS for production

## SEO

Add to `<head>` sections:
```html
<meta name="description" content="...">
<meta property="og:title" content="...">
<meta property="og:image" content="...">
```

## License

© 2026 Effortless CRM. All rights reserved.
