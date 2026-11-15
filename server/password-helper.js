import crypto from 'node:crypto';
import readline from 'node:readline/promises';
const rl=readline.createInterface({input:process.stdin,output:process.stdout});
const pass=await rl.question('Enter a strong Main Admin password (will be visible while typing): ');rl.close();
if(pass.length<14)throw Error('Choose a password of at least 14 characters');
const salt=crypto.randomBytes(16).toString('hex');const hash=crypto.scryptSync(pass,salt,64).toString('hex');
console.log(`ADMIN_PASSWORD_SALT=${salt}\nADMIN_PASSWORD_HASH=${hash}`);
console.log('Do not save the password in the website source. Move these values into private environment secrets.');
