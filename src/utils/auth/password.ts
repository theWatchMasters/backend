import bcrypt from 'bcrypt';
/*
 * This file provides utility functions for handling password hashing and validation using bcrypt.
 */

const SALT_ROUNDS = 10; // The number of salt rounds to use when hashing passwords, which determines the computational cost of computing the hash.

/**
 * Validates a plaintext password against a hashed password stored in the database.
 * @param password The plaintext password provided by the user during login
 * @param hash The hashed password stored in the database for the user
 * @returns A promise that resolves to whether the password and hash match
 */
export async function validatePassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a bcrypt hash of a plaintext password for database storage
 * @param password The plaintext password to hash
 * @returns A promise that resolves to the hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}
