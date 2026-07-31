// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import * as React from 'react';
import { ShieldCheck, UserMinus, UserPlus, UserRoundCheck, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TableActionMenu } from '@/components/ui/table-action-menu';
import type { TableRowAction } from '@/types/table';
import { ErrorHandlerService } from '@/services/error/ErrorHandlerService';
import { messageService } from '@/services/message';
import { adminService } from '@/services/admin';
import type { AdministratorSummary, RosterUser } from '@/types/admin';

interface UserRosterProps {
  users: RosterUser[];
  administrators: AdministratorSummary | null;
  isLoading: boolean;
  currentUserEmail: string | undefined;
  onChanged: () => void;
}

/** A person's sign-in history, in the terms an administrator prunes by. */
const signInSummary = (user: RosterUser): string => {
  if (user.lastLoginAt) {
    return new Date(user.lastLoginAt).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
  // Invited but never signed in — distinct from "has an account but has not
  // signed in since last sign-in was first recorded".
  return user.emailVerified ? 'Not since this update' : 'Not yet signed in';
};

type PendingConfirm = {
  title: string;
  description: string;
  actionLabel: string;
  destructive?: boolean;
  run: () => Promise<void>;
};

export function UserRoster({
  users,
  administrators,
  isLoading,
  currentUserEmail,
  onChanged,
}: UserRosterProps) {
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [confirm, setConfirm] = React.useState<PendingConfirm | null>(null);

  const runGuarded = async (operation: () => Promise<void>, context: string) => {
    setIsSubmitting(true);
    try {
      await operation();
      onChanged();
    } catch (error) {
      // Guard refusals arrive as 409s carrying their own explanation — the
      // last-administrator rule, or the Allowlist two-administrator minimum.
      ErrorHandlerService.handleError(error, context);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInvite = async () => {
    await runGuarded(async () => {
      const result = await adminService.invite(inviteEmail.trim());
      setInviteOpen(false);
      setInviteEmail('');

      if (result.invitationEmailSent) {
        messageService.success(
          `${result.user.email} was added as Staff and sent an invitation.`
        );
      } else {
        messageService.info(
          `${result.user.email} was added as Staff, but the invitation email could not be sent. Let them know they can sign in.`
        );
      }
    }, 'adminInviteUser');
  };

  const actionsFor = (user: RosterUser): TableRowAction[] => {
    const isSelf = user.email === currentUserEmail;
    const isAdmin = user.role === 'ADMINISTRATOR';
    const isRevoked = user.accessState === 'REVOKED';

    return [
      isAdmin
        ? {
            label: 'Change to Staff',
            icon: UserMinus,
            onClick: () =>
              setConfirm({
                title: `Change ${user.email} to Staff?`,
                description: isSelf
                  ? 'You will lose access to the Admin page immediately. Another administrator will have to restore it.'
                  : 'They keep full access to FEED, but can no longer manage staff access or view this history.',
                actionLabel: 'Change to Staff',
                run: () =>
                  runGuarded(
                    () => adminService.setRole(user.id, 'STAFF').then(() => {
                      messageService.success(`${user.email} is now Staff.`);
                    }),
                    'adminSetRole'
                  ),
              }),
          }
        : {
            label: 'Make Administrator',
            icon: ShieldCheck,
            onClick: () =>
              setConfirm({
                title: `Make ${user.email} an Administrator?`,
                description:
                  'Administrators can manage staff access, change how sign-in works, and review the activity history.',
                actionLabel: 'Make Administrator',
                run: () =>
                  runGuarded(
                    () =>
                      adminService.setRole(user.id, 'ADMINISTRATOR').then(() => {
                        messageService.success(
                          `${user.email} is now an Administrator.`
                        );
                      }),
                    'adminSetRole'
                  ),
              }),
          },
      isRevoked
        ? {
            label: 'Restore access',
            icon: UserRoundCheck,
            onClick: () =>
              runGuarded(
                () =>
                  adminService.setAccess(user.id, 'ALLOWED').then(() => {
                    messageService.success(`${user.email} can sign in again.`);
                  }),
                'adminSetAccess'
              ),
          }
        : {
            label: 'Revoke access',
            icon: UserMinus,
            variant: 'destructive' as const,
            onClick: () =>
              setConfirm({
                title: `Revoke access for ${user.email}?`,
                description:
                  'They are signed out on their next action and cannot sign in again until access is restored. This holds whichever sign-in mode is active.',
                actionLabel: 'Revoke access',
                destructive: true,
                run: () =>
                  runGuarded(
                    () =>
                      adminService.setAccess(user.id, 'REVOKED').then(() => {
                        messageService.success(
                          `${user.email} can no longer sign in.`
                        );
                      }),
                    'adminSetAccess'
                  ),
              }),
          },
      {
        label: 'Remove from roster',
        icon: Trash2,
        variant: 'destructive' as const,
        onClick: () =>
          setConfirm({
            title: `Remove ${user.email}?`,
            description:
              'This deletes their roster row and its sign-in history. If their mailbox still works, signing in would create a new Staff account — revoke access instead if you want a durable block.',
            actionLabel: 'Remove',
            destructive: true,
            run: () =>
              runGuarded(
                () =>
                  adminService.removeUser(user.id).then(() => {
                    messageService.success(`${user.email} was removed.`);
                  }),
                'adminRemoveUser'
              ),
          }),
      },
    ];
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          {administrators ? (
            <>
              {administrators.eligible} administrator
              {administrators.eligible === 1 ? '' : 's'} can sign in.{' '}
              {administrators.mode === 'ALLOWLIST'
                ? 'Allowlist mode requires at least 2.'
                : 'Domain mode requires at least 1.'}
            </>
          ) : (
            <Skeleton className="h-4 w-64" />
          )}
        </div>
        <Button onClick={() => setInviteOpen(true)} disabled={isSubmitting}>
          <UserPlus className="mr-2 h-4 w-4" />
          Invite
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Access</TableHead>
              <TableHead>Last sign-in</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell colSpan={5}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No one is on the roster yet.
                </TableCell>
              </TableRow>
            ) : (
              users.map(user => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.email}
                    {user.email === currentUserEmail && (
                      <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={user.role === 'ADMINISTRATOR' ? 'default' : 'secondary'}
                    >
                      {user.role === 'ADMINISTRATOR' ? 'Administrator' : 'Staff'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        user.accessState === 'REVOKED' ? 'destructive' : 'outline'
                      }
                    >
                      {user.accessState === 'REVOKED' ? 'Revoked' : 'Allowed'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {signInSummary(user)}
                  </TableCell>
                  <TableCell>
                    <TableActionMenu
                      actions={actionsFor(user)}
                      isLoading={isSubmitting}
                      size="sm"
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite someone to FEED</DialogTitle>
            <DialogDescription>
              They are added as Staff and emailed a link to the sign-in page. The
              email contains no sign-in code — they request one themselves.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="invite-email">Work email address</Label>
            <Input
              id="invite-email"
              type="email"
              autoComplete="off"
              placeholder="name@williamtemple.org"
              value={inviteEmail}
              onChange={event => setInviteEmail(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' && inviteEmail.trim()) {
                  event.preventDefault();
                  void handleInvite();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleInvite()}
              disabled={!inviteEmail.trim() || isSubmitting}
            >
              Send invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirm !== null}
        onOpenChange={open => {
          if (!open) setConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={
                confirm?.destructive
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : undefined
              }
              onClick={() => {
                const pending = confirm;
                setConfirm(null);
                void pending?.run();
              }}
            >
              {confirm?.actionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
