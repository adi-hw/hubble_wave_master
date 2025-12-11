import * as argon2 from 'argon2';

async function generateHash() {
  const password = 'Admin123!';
  const hash = await argon2.hash(password);
  console.log('Password Hash for "Admin123!":');
  console.log(hash);
  console.log('\nUpdate the seed-test-user.sql file with this hash (argon2id)');
}

generateHash();
