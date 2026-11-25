/**
 * Distributor Onboarding Wizard Service
 * 
 * Provisions:
 * 1. Tenant (status PENDING unless valid invite code used)
 * 2. Owner User bound to Google OIDC account
 * 3. Delivery Areas / Beats
 * 4. Device registration with hashed 6-digit PIN
 * 5. Server-side session
 * 6. GSTIN verification log (compact, no raw responses)
 * 
 * Executed strictly within ONE atomic database transaction.
 */

import bcrypt from 'bcryptjs';
import { prisma } from '../db/prisma';
import { Role, TenantStatus, GstinStatus } from '@prisma/client';
import { validateGstin, maskGstin } from './gstin';
import { checkDuplicateGstin } from './gst-verifier';
import { validatePinStrength, createServerSession } from './session';

export interface OnboardingWizardInput {
  businessName: string;
  ownerName: string;
  phone?: string; // Optional contact field, never treated as verified
  city: string;
  state?: string;
  areas: string[];
  upiId: string;
  orderCutoffTime?: string; // Default: "18:00"
  gstin?: string;
  gstinException?: boolean;
  gstinExceptionReason?: string;
  termsAccepted: boolean;
  termsVersion: string;
  privacyAccepted: boolean;
  privacyVersion: string;
  inviteCode?: string;
  googleSub: string;
  googleEmail: string;
  deviceFingerprint: string;
  deviceName?: string;
  pin: string; // 6-digit PIN
  userAgent?: string;
  ip?: string;
}

export async function processOwnerOnboarding(input: OnboardingWizardInput) {
  // 1. Validate Terms and Privacy Acceptance
  if (!input.termsAccepted || !input.privacyAccepted) {
    throw new Error('You must accept the Terms of Service and Privacy Notice to register (नियम और गोपनीयता शर्तों को स्वीकार करना अनिवार्य है).');
  }

  // 2. Validate PIN strength
  const pinValidation = validatePinStrength(input.pin);
  if (!pinValidation.valid) {
    throw new Error(pinValidation.error);
  }

  // 3. Validate GSTIN (unless admin exception flag is set)
  let cleanGstin: string | null = null;
  let gstinStatus: GstinStatus = GstinStatus.UNVERIFIED;

  if (input.gstinException) {
    if (!input.gstinExceptionReason || input.gstinExceptionReason.trim().length < 5) {
      throw new Error('A valid reason is required when claiming a GSTIN exception.');
    }
  } else {
    if (!input.gstin) {
      throw new Error('GSTIN is required. If your business is exempt, please check the exemption box and state your reason.');
    }
    const val = validateGstin(input.gstin);
    if (!val.valid) {
      throw new Error(val.errorEn || 'Invalid GSTIN');
    }
    cleanGstin = val.gstin!;
    gstinStatus = GstinStatus.FORMAT_OK;

    // Check duplicate GSTIN across tenants
    const existing = await prisma.tenant.findUnique({
      where: { gstin: cleanGstin },
    });
    if (existing) {
      throw new Error(`GSTIN ${maskGstin(cleanGstin)} is already registered. Please contact support or your distributor administrator.`);
    }
  }

  // 4. Check Pilot Invite Code for Immediate Activation
  // If a valid invite code is provided (e.g. matching PILOT_INVITE_CODE or setting), status starts ACTIVE.
  // Otherwise, tenant starts in PENDING status awaiting admin approval.
  const validInviteCode = process.env.PILOT_INVITE_CODE || 'VITARAK2026';
  const isCodeValid = Boolean(input.inviteCode && input.inviteCode.trim().toUpperCase() === validInviteCode);
  const initialStatus: TenantStatus = isCodeValid ? TenantStatus.ACTIVE : TenantStatus.PENDING;

  const pinHash = await bcrypt.hash(input.pin, 10);
  const now = new Date();

  // 5. Atomic Transaction: Create Tenant, Areas, User, Membership, Device, Session, GstVerification
  return await prisma.$transaction(async (tx) => {
    // A. Create Tenant
    const tenant = await tx.tenant.create({
      data: {
        name: input.businessName.trim(),
        owner_name: input.ownerName.trim(),
        phone: input.phone?.trim() || null,
        email: input.googleEmail,
        upi_id: input.upiId.trim(),
        city: input.city.trim(),
        state: input.state?.trim() || 'Maharashtra',
        timezone: 'Asia/Kolkata',
        order_cutoff_time: input.orderCutoffTime || '18:00',
        status: initialStatus,
        invite_code: input.inviteCode || null,
        enable_gst: false, // OFF by default
        gstin: cleanGstin,
        gstin_status: gstinStatus,
        gstin_exception: Boolean(input.gstinException),
        gstin_exception_reason: input.gstinExceptionReason || null,
        terms_accepted_at: now,
        terms_version: input.termsVersion,
        privacy_accepted_at: now,
        privacy_version: input.privacyVersion,
      },
    });

    // B. Create Delivery Areas
    if (input.areas && input.areas.length > 0) {
      for (let i = 0; i < input.areas.length; i++) {
        const areaName = input.areas[i].trim();
        if (areaName) {
          await tx.area.create({
            data: {
              tenant_id: tenant.id,
              name: areaName,
              notes: `Area ${i + 1}`,
            },
          });
        }
      }
    }

    // C. Upsert Owner User
    let user = await tx.user.findFirst({
      where: {
        OR: [
          { google_sub: input.googleSub },
          { email: input.googleEmail },
        ],
      },
    });

    if (user) {
      user = await tx.user.update({
        where: { id: user.id },
        data: {
          name: input.ownerName.trim(),
          google_sub: input.googleSub,
          google_email: input.googleEmail,
        },
      });
    } else {
      user = await tx.user.create({
        data: {
          name: input.ownerName.trim(),
          email: input.googleEmail,
          google_sub: input.googleSub,
          google_email: input.googleEmail,
          created_at: now,
        },
      });
    }

    // D. Create Owner Membership
    await tx.membership.create({
      data: {
        tenant_id: tenant.id,
        user_id: user.id,
        role: Role.OWNER,
        is_active: true,
      },
    });

    // E. Register Owner Device with PIN
    const device = await tx.device.create({
      data: {
        user_id: user.id,
        device_fingerprint: input.deviceFingerprint,
        device_name: input.deviceName || 'Owner Device',
        pin_hash: pinHash,
        last_active_at: now,
      },
    });

    // F. Create Initial Session
    const rawToken = require('crypto').randomBytes(32).toString('hex');
    const tokenHash = require('crypto').createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const ipHash = input.ip ? require('crypto').createHash('sha256').update(input.ip).digest('hex') : null;

    const session = await tx.session.create({
      data: {
        user_id: user.id,
        device_id: device.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
        unlocked_until: new Date(Date.now() + 15 * 60 * 1000), // Initially unlocked on fresh onboarding
        user_agent: input.userAgent || null,
        ip_hash: ipHash,
      },
    });

    // G. Create Compact GST Verification entry if GSTIN was supplied
    if (cleanGstin) {
      await tx.gstVerification.create({
        data: {
          tenant_id: tenant.id,
          provider: 'MOCK',
          status: gstinStatus,
          legal_name: `${input.businessName} (PAN ${cleanGstin.slice(2, 12)})`,
          trade_name: input.businessName,
          state: input.state || 'Maharashtra',
          checked_by: 'onboarding-wizard',
        },
      });
    }

    return {
      tenant,
      user,
      device,
      session,
      rawToken,
      status: tenant.status,
    };
  });
}
