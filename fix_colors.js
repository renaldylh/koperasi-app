const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'frontend', 'pages');

const replacements = [
  { from: /text-emerald-400/g, to: 'text-blue-600 font-semibold' },
  { from: /text-emerald-300/g, to: 'text-blue-600' },
  { from: /text-emerald-200/g, to: 'text-slate-600' },
  { from: /text-emerald-500/g, to: 'text-blue-600' },
  { from: /text-blue-400/g, to: 'text-blue-600' },
  { from: /text-blue-200/g, to: 'text-blue-700' },
  { from: /text-blue-300/g, to: 'text-blue-600' },
  { from: /text-amber-400/g, to: 'text-amber-600' },
  { from: /text-red-400/g, to: 'text-red-600' },
  { from: /text-slate-400/g, to: 'text-slate-500' },
  { from: /text-slate-300/g, to: 'text-slate-600' },
  { from: /text-white/g, to: 'text-slate-800' },
  { from: /group-hover:text-white/g, to: 'group-hover:text-blue-700' },
  { from: /border-emerald-500\/30/g, to: 'border-blue-600/30' },
  { from: /border-emerald-500\/50/g, to: 'border-blue-600/50' },
  { from: /bg-emerald-600/g, to: 'bg-blue-600' },
  { from: /hover:bg-emerald-500/g, to: 'hover:bg-blue-700' },
  { from: /text-emerald-500\/50/g, to: 'text-blue-600/50' },
  { from: /bg-\[rgba\(16\,185\,129\,0\.05\)\]/g, to: 'bg-[rgba(37,99,235,0.05)]' },
  { from: /bg-\[rgba\(0\,0\,0\,0\.2\)\]/g, to: 'bg-white' }, // Card items in dashboard
  { from: /border-\[rgba\(255\,255\,255\,0\.05\)\]/g, to: 'border-slate-200' },
  { from: /border-\[rgba\(255\,255\,255\,0\.1\)\]/g, to: 'border-slate-200' },
  { from: /bg-\[rgba\(255\,255\,255\,0\.03\)\]/g, to: 'bg-slate-50' }
];

fs.readdirSync(dir).filter(f => f.endsWith('.html')).forEach(f => {
  const fp = path.join(dir, f);
  let content = fs.readFileSync(fp, 'utf8');
  
  // Apply all replacements
  replacements.forEach(r => {
    content = content.replace(r.from, r.to);
  });
  
  // Fix button text-white bug just in case we hit btn-primary text-white
  // The btn-primary uses var(--text-inverse) from CSS anyway!
  
  fs.writeFileSync(fp, content);
  console.log('Fixed colors in', f);
});
console.log('Done script');
