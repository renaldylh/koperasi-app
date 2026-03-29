const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'frontend', 'pages');

const footer = `    <div class="sidebar-footer">
      <div class="user-avatar" x-text="user?.nama?.charAt(0) || 'U'"></div>
      <div class="user-info">
        <div class="name truncate w-24" x-text="user?.nama">User</div>
        <div class="role uppercase" x-text="user?.role">Role</div>
      </div>
      <i class="ri-logout-box-r-line logout-btn" @click="logout()" title="Logout"></i>
    </div>
  </aside>`;

fs.readdirSync(dir).filter(f => f.endsWith('.html')).forEach(f => {
  const fp = path.join(dir, f);
  let content = fs.readFileSync(fp, 'utf8');
  if (!content.includes('sidebar-footer') && content.includes('</aside>')) {
    content = content.replace(/\s*<\/aside>/, '\n' + footer);
    fs.writeFileSync(fp, content);
    console.log('Added footer to', f);
  }
});
console.log('Done script');
