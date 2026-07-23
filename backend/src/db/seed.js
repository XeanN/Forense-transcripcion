require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('./connection');
const userModel = require('./userModel');

async function seed() {
  const { ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_EMAIL } = process.env;

  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    console.error('ADMIN_USERNAME y ADMIN_PASSWORD deben estar definidos en .env');
    process.exit(1);
  }

  const existing = userModel.findByUsername(ADMIN_USERNAME);
  if (existing) {
    console.log(`El usuario admin "${ADMIN_USERNAME}" ya existe. No se realizaron cambios.`);
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  userModel.create({
    username: ADMIN_USERNAME,
    email: ADMIN_EMAIL,
    passwordHash,
    role: 'admin',
    mustChangePassword: 0,
  });

  console.log(`Usuario admin "${ADMIN_USERNAME}" creado correctamente.`);
}

seed()
  .catch((err) => {
    console.error('Error al crear el usuario admin:', err);
    process.exit(1);
  })
  .finally(() => {
    db.close();
  });
