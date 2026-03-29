require('dotenv').config();
const bcrypt = require('bcryptjs');
const { User } = require('../src/models');
const { connectDB } = require('../src/config/database');

async function run() {
  try {
    await connectDB();
    const email = 'admin@gmail.com';
    const password = 'admin123';
    const hashed = await bcrypt.hash(password, 12);

    // Update existing admin or create if not exists
    const [user, created] = await User.findOrCreate({
      where: { role: 'admin' },
      defaults: {
        id: require('uuid').v4(),
        tenant_id: '00000000-0000-0000-0000-000000000001',
        nama: 'Administrator',
        email: email,
        password: hashed,
        role: 'admin',
        aktif: true
      }
    });

    if (!created) {
      await user.update({ email: email, password: hashed });
      console.log('✅ Admin credentials updated to:', email);
    } else {
      console.log('✅ New Admin created with:', email);
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Error updating admin:', err.message);
    process.exit(1);
  }
}

run();
