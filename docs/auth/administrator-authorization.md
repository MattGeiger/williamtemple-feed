# Administrator Authorization

## Status

Design approved; implementation deferred until after the Data Management and
OFB procurement-import pilot.

## Roles

FEED remains one shared organization-wide workspace. Roles authorize actions;
they do not partition feature data.

- **Staff**: ordinary authenticated application workflows.
- **Administrator**: Staff capabilities plus user-role management and sensitive
  system operations such as future sanitized backup/restore controls.

The Admin page is omitted from Staff navigation, but every privileged backend
route must independently enforce Administrator authority. A hidden page is not
authorization.

## Fresh-instance bootstrap

The first successfully verified user on a genuinely fresh deployment becomes
the initial Administrator. This must be an atomic server-side decision so two
simultaneous first logins cannot both exploit an unsafe check-then-write race.
Bootstrap must not run merely because all Administrators were later revoked or
deleted; that condition requires an explicit operator recovery path.

The implementation should add an auditable role assignment model rather than a
client-only flag. Administrator actions should record actor, target, action,
and timestamp. User identity is still never used to scope shared inventory,
translations, templates, procurement, or analytics data.

## Admin surface

The future Admin page may include:

- designate or revoke Administrator authority;
- manage Staff access;
- review privileged-action audit history;
- initialize or rotate encryption;
- configure fresh AI provider keys after a sanitized restore;
- generate and restore sanitized in-app backups.

These capabilities must not be implemented as part of the initial procurement
import. Until role enforcement exists, database recovery remains an operator-
controlled deployment task.
