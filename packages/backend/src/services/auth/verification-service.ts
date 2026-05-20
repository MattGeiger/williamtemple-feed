// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import prisma from '../../db';
import { TokenService } from './token-service';
import { ResendService } from '../email/resend-service';

const MAGIC_LINK_EXPIRY = 10 * 60 * 1000; // 10 minutes
const OTP_EXPIRY = 3 * 60 * 1000; // 3 minutes
const MAX_OTP_ATTEMPTS = 10; // Generous for small team
const LOCKOUT_DURATION = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS_PER_HOUR = 10;

export class VerificationService {
  /**
   * Create and send magic link
   * @throws Error with user-friendly message
   */
  static async sendMagicLink(email: string): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();

    // Check rate limit
    await this.checkRateLimit(normalizedEmail, 'magic_link');

    // Generate token
    const token = TokenService.generateVerificationToken();
    const hashedToken = TokenService.hashToken(token);
    const expires = new Date(Date.now() + MAGIC_LINK_EXPIRY);

    // Delete any existing magic links for this email
    await prisma.verificationToken.deleteMany({
      where: {
        identifier: normalizedEmail,
        type: 'magic_link'
      }
    });

    // Store hashed token
    await prisma.verificationToken.create({
      data: {
        identifier: normalizedEmail,
        token: hashedToken,
        type: 'magic_link',
        expires
      }
    });

    // Send email with plain token
    await ResendService.sendMagicLink(normalizedEmail, token);
  }

  /**
   * Verify magic link token
   * @returns userId if valid, null if invalid/expired
   */
  static async verifyMagicLink(email: string, token: string): Promise<string | null> {
    const normalizedEmail = email.toLowerCase().trim();
    const hashedToken = TokenService.hashToken(token);

    // Find valid token
    const verification = await prisma.verificationToken.findFirst({
      where: {
        identifier: normalizedEmail,
        token: hashedToken,
        type: 'magic_link',
        expires: { gt: new Date() }
      }
    });

    if (!verification) {
      return null;
    }

    // Delete token (one-time use)
    await prisma.verificationToken.delete({
      where: {
        identifier_token: {
          identifier: normalizedEmail,
          token: hashedToken
        }
      }
    });

    // Get or create user
    const user = await this.findOrCreateUser(normalizedEmail);
    return user.id;
  }

  /**
   * Create and send OTP code
   * @throws Error with user-friendly message
   */
  static async sendOTP(email: string): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();

    // Check lockout and rate limit
    await this.checkOTPLockout(normalizedEmail);
    await this.checkRateLimit(normalizedEmail, 'otp');

    // Generate code
    const code = TokenService.generateOTP();
    const hashedCode = TokenService.hashToken(code);
    const expires = new Date(Date.now() + OTP_EXPIRY);

    // Delete any existing OTP for this email
    await prisma.verificationToken.deleteMany({
      where: {
        identifier: normalizedEmail,
        type: 'otp'
      }
    });

    // Store hashed code
    await prisma.verificationToken.create({
      data: {
        identifier: normalizedEmail,
        token: hashedCode,
        type: 'otp',
        expires
      }
    });

    // Update OtpFailure record
    await prisma.otpFailure.upsert({
      where: { email: normalizedEmail },
      create: { 
        email: normalizedEmail, 
        attempts: 0, 
        lastRequest: new Date() 
      },
      update: { lastRequest: new Date() }
    });

    // Send email with plain code
    await ResendService.sendOTP(normalizedEmail, code);
  }

  /**
   * Verify OTP code
   * @returns userId if valid, null if invalid/expired
   * @throws Error with user-friendly message on lockout
   */
  static async verifyOTP(email: string, code: string): Promise<string | null> {
    const normalizedEmail = email.toLowerCase().trim();

    // Check lockout
    await this.checkOTPLockout(normalizedEmail);

    const hashedCode = TokenService.hashToken(code);

    // Find valid code
    const verification = await prisma.verificationToken.findFirst({
      where: {
        identifier: normalizedEmail,
        token: hashedCode,
        type: 'otp',
        expires: { gt: new Date() }
      }
    });

    if (!verification) {
      // Increment failure count
      await this.recordOTPFailure(normalizedEmail);
      return null;
    }

    // Delete code (one-time use)
    await prisma.verificationToken.delete({
      where: {
        identifier_token: {
          identifier: normalizedEmail,
          token: hashedCode
        }
      }
    });

    // Reset failure count
    await prisma.otpFailure.upsert({
      where: { email: normalizedEmail },
      create: { 
        email: normalizedEmail, 
        attempts: 0 
      },
      update: { 
        attempts: 0, 
        lockedUntil: null 
      }
    });

    // Get or create user
    const user = await this.findOrCreateUser(normalizedEmail);
    return user.id;
  }

  /**
   * Check if account is locked due to failed OTP attempts
   * @throws Error if locked
   */
  private static async checkOTPLockout(email: string): Promise<void> {
    const failure = await prisma.otpFailure.findUnique({
      where: { email }
    });

    if (failure?.lockedUntil && failure.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((failure.lockedUntil.getTime() - Date.now()) / 60000);
      throw new Error(`Too many failed attempts. Please try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.`);
    }
  }

  /**
   * Record failed OTP attempt and lock if threshold reached
   */
  private static async recordOTPFailure(email: string): Promise<void> {
    const failure = await prisma.otpFailure.findUnique({
      where: { email }
    });

    const attempts = (failure?.attempts || 0) + 1;
    const lockedUntil = attempts >= MAX_OTP_ATTEMPTS
      ? new Date(Date.now() + LOCKOUT_DURATION)
      : null;

    await prisma.otpFailure.upsert({
      where: { email },
      create: { 
        email, 
        attempts, 
        lockedUntil 
      },
      update: { 
        attempts, 
        lockedUntil 
      }
    });
  }

  /**
   * Check rate limit for verification requests
   * @throws Error if rate limit exceeded
   */
  private static async checkRateLimit(email: string, type: 'magic_link' | 'otp'): Promise<void> {
    const oneHourAgo = new Date(Date.now() - RATE_LIMIT_WINDOW);

    const recentCount = await prisma.verificationToken.count({
      where: {
        identifier: email,
        type,
        createdAt: { gt: oneHourAgo }
      }
    });

    if (recentCount >= MAX_REQUESTS_PER_HOUR) {
      throw new Error('Too many requests. Please wait before requesting another code.');
    }
  }

  /**
   * Find existing user or create new one
   */
  private static async findOrCreateUser(email: string) {
    const existing = await prisma.user.findUnique({
      where: { email }
    });

    if (existing) {
      return existing;
    }

    return await prisma.user.create({
      data: {
        email,
        emailVerified: new Date()
      }
    });
  }
}
