import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/connection.js';

export interface UserRecord {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  status: 'active' | 'suspended' | 'deleted';
  created_at: string;
  updated_at: string;
}

export class UserService {
  public async createUser(data: { email: string; passwordHash: string; name: string }): Promise<UserRecord> {
    const id = uuidv4();
    const email = data.email.toLowerCase().trim();

    await db.execute(
      `INSERT INTO users (id, email, password_hash, name, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [id, email, data.passwordHash, data.name.trim()]
    );

    const user = await this.getUserById(id);
    if (!user) throw new Error('Failed to create user record.');
    return user;
  }

  public async getUserByEmail(email: string): Promise<UserRecord | null> {
    return db.queryOne<UserRecord>(
      'SELECT * FROM users WHERE email = $1 AND status != \'deleted\'',
      [email.toLowerCase().trim()]
    );
  }

  public async getUserById(id: string): Promise<UserRecord | null> {
    return db.queryOne<UserRecord>(
      'SELECT * FROM users WHERE id = $1 AND status != \'deleted\'',
      [id]
    );
  }

  public async deleteUser(id: string): Promise<boolean> {
    const res = await db.execute(
      `UPDATE users SET status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id]
    );
    return res.rowCount > 0;
  }
}

export const userService = new UserService();
