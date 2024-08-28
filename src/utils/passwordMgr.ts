import crypto from 'node:crypto';


export function generatePasswordHash(password: string, salt: string): string {
  const combinedString = password + salt;
  return crypto.createHash('md5').update(combinedString).digest('hex');
}
